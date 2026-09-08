/**
 * Shared booking-payout settlement used by the admin console.
 *
 * Takes the operator's share out of the platform balance (Stripe transfer),
 * then pushes it on to their bank account, and records the ledger row.
 * Server-only — load inside a handler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any, "public", any>;

const RELEASABLE = ["confirmed", "in_progress", "completed", "reviewed"];

export async function releaseBookingPayoutCore(
  admin: Admin,
  bookingId: string,
  actorId: string,
) {
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id,business_id,status,escrow_state,total_cents,deposit_cents,payout_cents,application_fee_cents,refunded_cents,stripe_charge_id,stripe_payment_intent_id,stripe_transfer_id,payout_released_at",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found.");

  if (booking.payout_released_at || booking.escrow_state === "released") {
    return { ok: true as const, alreadyReleased: true, transferId: booking.stripe_transfer_id };
  }
  if (!RELEASABLE.includes(String(booking.status))) {
    throw new Error(`This trip isn't payable yet (currently ${booking.status}).`);
  }
  if (booking.escrow_state === "frozen") throw new Error("Payout is frozen while a dispute is open.");
  if (!booking.stripe_charge_id && !booking.stripe_payment_intent_id) {
    throw new Error("No captured payment is attached to this booking.");
  }

  const { data: dispute } = await admin
    .from("disputes")
    .select("id")
    .eq("booking_id", booking.id)
    .in("status", ["open", "investigating"])
    .maybeSingle();
  if (dispute) throw new Error("A dispute is open on this booking — payout stays frozen.");

  const { data: biz } = await admin
    .from("businesses")
    .select("id,stripe_account_id,payouts_enabled")
    .eq("id", booking.business_id ?? "")
    .maybeSingle();
  if (!biz?.stripe_account_id || !biz.payouts_enabled) {
    throw new Error("This operator hasn't finished connecting their bank account.");
  }

  const vendorCents = Math.max(0, (booking.payout_cents ?? 0) - (booking.refunded_cents ?? 0));
  if (vendorCents <= 0) throw new Error("Nothing left to pay out on this booking.");

  const { requireStripe } = await import("./stripe.server");
  const stripe = requireStripe();

  const transfer = await stripe.transfers.create(
    {
      amount: vendorCents,
      currency: "usd",
      destination: biz.stripe_account_id,
      ...(booking.stripe_charge_id ? { source_transaction: booking.stripe_charge_id } : {}),
      metadata: {
        booking_id: booking.id,
        platform_fee_cents: String(booking.application_fee_cents ?? 0),
      },
    },
    { idempotencyKey: `booking-payout-${booking.id}` },
  );

  const { settleToBank } = await import("./stripe-payout.server");
  const bank = await settleToBank(stripe, biz.stripe_account_id, vendorCents, {
    booking_id: booking.id,
    source_id: `booking-${booking.id}`,
  });

  const now = new Date().toISOString();
  await admin
    .from("bookings")
    .update({
      escrow_state: "released",
      stripe_transfer_id: transfer.id,
      payout_released_at: now,
      updated_at: now,
    })
    .eq("id", booking.id);

  await admin.from("payouts").insert({
    business_id: biz.id,
    booking_id: booking.id,
    stripe_payout_id: bank.bankPayoutId ?? transfer.id,
    stripe_transfer_id: transfer.id,
    stripe_bank_payout_id: bank.bankPayoutId,
    destination_account_id: biz.stripe_account_id,
    amount_cents: vendorCents,
    currency: "usd",
    status: bank.status,
    arrival_date: bank.arrivalDate,
    failure_message: bank.error,
    ...(bank.status === "paid" ? { paid_at: now } : {}),
  });

  await admin.from("domain_events").insert({
    topic: "payout.released",
    aggregate_type: "booking",
    aggregate_id: booking.id,
    payload: {
      booking_id: booking.id,
      amount_cents: vendorCents,
      transfer_id: transfer.id,
      bank_payout_id: bank.bankPayoutId,
      released_by: actorId,
    },
  });

  return {
    ok: true as const,
    alreadyReleased: false,
    transferId: transfer.id,
    amountCents: vendorCents,
    bankStatus: bank.status,
    arrivalDate: bank.arrivalDate,
  };
}
