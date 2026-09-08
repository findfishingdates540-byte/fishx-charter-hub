/**
 * Post-booking money operations for operators:
 * - collecting the on-the-day balance (the 75% Fish-X never touches)
 * - refunding the online deposit (partial or full) through Stripe
 *
 * Authorization runs through the caller's RLS-scoped client first; only then
 * do we load the admin client for the ledger writes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BALANCE_METHODS = ["cash", "card_in_person", "bank_transfer", "other"] as const;

type BookingMoneyRow = {
  id: string;
  status: string;
  captain_id: string;
  total_cents: number;
  deposit_cents: number;
  balance_due_cents: number;
  balance_collected_at: string | null;
  refunded_cents: number;
  escrow_state: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  payout_released_at: string | null;
  business_id: string | null;
  payout_cents: number;
  application_fee_cents: number | null;
};

const SELECT =
  "id,status,captain_id,total_cents,deposit_cents,balance_due_cents,balance_collected_at,refunded_cents,escrow_state,stripe_payment_intent_id,stripe_charge_id,stripe_transfer_id,payout_released_at,business_id,payout_cents,application_fee_cents";

async function loadOwnedBooking(
  supabase: any,
  bookingId: string,
  userId: string,
): Promise<BookingMoneyRow> {
  // RLS lets anglers read their own bookings too — money actions are operator-only.
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Booking not found", { status: 404 });

  let authorized = data.captain_id === userId;
  if (!authorized && data.business_id) {
    const { data: ok } = await supabase.rpc("is_business_member", {
      _business_id: data.business_id,
      _user_id: userId,
      _min_role: "staff",
    });
    authorized = ok === true;
  }
  if (!authorized) throw new Response("Forbidden", { status: 403 });

  return data as BookingMoneyRow;
}

/** Captain records that the remaining balance was collected in person. */
export const markBalanceCollected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        method: z.enum(BALANCE_METHODS).default("cash"),
        amountCents: z.number().int().min(0).optional(),
        note: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const booking = await loadOwnedBooking(context.supabase, data.bookingId, context.userId);
    if (booking.balance_collected_at) {
      return { ok: true as const, alreadyCollected: true, collectedAt: booking.balance_collected_at };
    }
    const expected = booking.balance_due_cents || Math.max(0, booking.total_cents - booking.deposit_cents);
    const amount = data.amountCents ?? expected;

    const now = new Date().toISOString();
    // Caller is already verified as captain or business staff; non-captain staff
    // have no UPDATE policy on bookings, so the ledger write runs with admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ balance_collected_at: now, balance_due_cents: Math.max(0, expected - amount), updated_at: now })
      .eq("id", booking.id);
    if (error) throw new Response(error.message, { status: 400 });

    await supabaseAdmin.from("domain_events").insert({
      topic: "booking.balance_collected",
      aggregate_type: "booking",
      aggregate_id: booking.id,
      payload: {
        booking_id: booking.id,
        amount_cents: amount,
        method: data.method,
        note: data.note ?? null,
        collected_by: context.userId,
      },
    });

    return {
      ok: true as const,
      alreadyCollected: false,
      collectedAt: now,
      amountCents: amount,
      remainingCents: Math.max(0, expected - amount),
    };
  });

/** Refunds part or all of the online deposit back to the guest. */
export const refundBookingDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        amountCents: z.number().int().positive().optional(),
        reason: z.string().max(300).optional(),
        policy: z.string().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const booking = await loadOwnedBooking(context.supabase, data.bookingId, context.userId);
    const paid = booking.deposit_cents || booking.total_cents;
    const refundable = Math.max(0, paid - (booking.refunded_cents ?? 0));
    if (refundable === 0) throw new Response("Nothing left to refund on this booking.", { status: 400 });
    if (booking.payout_released_at) {
      throw new Response(
        "This payout has already been released — open a resolution case instead of a direct refund.",
        { status: 400 },
      );
    }

    const amount = Math.min(data.amountCents ?? refundable, refundable);
    const paymentIntentId = booking.stripe_payment_intent_id;
    if (!paymentIntentId && !booking.stripe_charge_id) {
      throw new Response("No online payment is attached to this booking.", { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ledger, error: ledgerErr } = await supabaseAdmin
      .from("refunds")
      .insert({
        booking_id: booking.id,
        amount_cents: amount,
        reason: data.reason ?? null,
        policy_applied: data.policy ?? null,
        created_by: context.userId,
        status: "pending",
      })
      .select("id")
      .single();
    if (ledgerErr) throw new Response(ledgerErr.message, { status: 500 });

    const { requireStripe } = await import("./stripe.server");
    const stripe = requireStripe();

    try {
      const refund = await stripe.refunds.create(
        {
          ...(paymentIntentId
            ? { payment_intent: paymentIntentId }
            : { charge: booking.stripe_charge_id! }),
          amount,
          metadata: { booking_id: booking.id, refund_id: ledger.id },
        },
        { idempotencyKey: `refund_${ledger.id}` },
      );

      const totalRefunded = (booking.refunded_cents ?? 0) + amount;
      const fullyRefunded = totalRefunded >= paid;

      await supabaseAdmin
        .from("refunds")
        .update({
          stripe_refund_id: refund.id,
          status: refund.status ?? "succeeded",
          succeeded_at: refund.status === "succeeded" ? new Date().toISOString() : null,
        })
        .eq("id", ledger.id);

      await supabaseAdmin
        .from("bookings")
        .update({
          refunded_cents: totalRefunded,
          escrow_state: fullyRefunded ? "refunded" : "partially_refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      await supabaseAdmin.from("domain_events").insert({
        topic: fullyRefunded ? "booking.refunded" : "booking.partially_refunded",
        aggregate_type: "booking",
        aggregate_id: booking.id,
        payload: {
          booking_id: booking.id,
          amount_cents: amount,
          total_refunded_cents: totalRefunded,
          reason: data.reason ?? null,
          refunded_by: context.userId,
        },
      });

      return {
        ok: true as const,
        refundId: ledger.id,
        amountCents: amount,
        totalRefundedCents: totalRefunded,
        fullyRefunded,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("refunds")
        .update({ status: "failed", failure_message: message.slice(0, 500) })
        .eq("id", ledger.id);
      console.error("[stripe] refund failed", message);
      throw new Response(`Refund failed: ${message}`, { status: 400 });
    }
  });

/**
 * Releases the operator's share of the captured deposit as a Stripe transfer
 * to their connected account, and optionally records the on-the-day balance
 * as collected in the same step.
 *
 * Guards: booking must be confirmed (or further along), the deposit must be
 * captured and held in escrow, no open dispute, payouts enabled on Connect.
 */
export const releaseBookingPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        markBalanceCollected: z.boolean().default(false),
        balanceMethod: z.enum(BALANCE_METHODS).default("cash"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const booking = await loadOwnedBooking(context.supabase, data.bookingId, context.userId);

    if (booking.payout_released_at || booking.escrow_state === "released") {
      return { ok: true as const, alreadyReleased: true, transferId: booking.stripe_transfer_id };
    }
    const releasable = ["confirmed", "in_progress", "completed", "reviewed"];
    if (!releasable.includes(booking.status)) {
      throw new Response(`Payout can only be released once the trip is confirmed (currently ${booking.status}).`, {
        status: 400,
      });
    }
    if (booking.escrow_state === "frozen") {
      throw new Response("This payout is frozen while a dispute is open.", { status: 400 });
    }
    if (!booking.stripe_charge_id && !booking.stripe_payment_intent_id) {
      throw new Response("No captured deposit is attached to this booking yet.", { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id")
      .eq("booking_id", booking.id)
      .in("status", ["open", "investigating"])
      .maybeSingle();
    if (dispute) throw new Response("A dispute is open on this booking — payout stays frozen.", { status: 400 });

    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("id,stripe_account_id,payouts_enabled")
      .eq("id", booking.business_id ?? "")
      .maybeSingle();
    if (!biz?.stripe_account_id || !biz.payouts_enabled) {
      throw new Response("Finish Stripe payouts setup before releasing this payout.", { status: 400 });
    }

    const paidCents = booking.deposit_cents || booking.total_cents;
    const vendorCents = Math.max(0, (booking.payout_cents ?? 0) - (booking.refunded_cents ?? 0));
    if (vendorCents <= 0) throw new Response("Nothing left to pay out on this booking.", { status: 400 });
    if (vendorCents > paidCents) {
      throw new Response("Payout exceeds the captured deposit — review this booking.", { status: 400 });
    }

    const { requireStripe } = await import("./stripe.server");
    const stripe = requireStripe();

    let transferId: string;
    try {
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
      transferId = transfer.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[stripe] booking transfer failed", message);
      throw new Response(`Payout failed: ${message}`, { status: 400 });
    }

    // Move it the rest of the way — from the connected account's Stripe
    // balance into the operator's actual bank account.
    const { settleToBank } = await import("./stripe-payout.server");
    const bank = await settleToBank(stripe, biz.stripe_account_id, vendorCents, {
      booking_id: booking.id,
      source_id: `booking-${booking.id}`,
    });

    const now = new Date().toISOString();
    const expectedBalance =
      booking.balance_due_cents || Math.max(0, booking.total_cents - booking.deposit_cents);
    const collectBalance = data.markBalanceCollected && !booking.balance_collected_at;

    await supabaseAdmin
      .from("bookings")
      .update({
        escrow_state: "released",
        stripe_transfer_id: transferId,
        payout_released_at: now,
        ...(collectBalance ? { balance_collected_at: now, balance_due_cents: 0 } : {}),
        updated_at: now,
      })
      .eq("id", booking.id);

    await supabaseAdmin.from("payouts").insert({
      business_id: biz.id,
      booking_id: booking.id,
      stripe_payout_id: transferId,
      amount_cents: vendorCents,
      currency: "usd",
      status: "paid",
      paid_at: now,
    });

    await supabaseAdmin.from("domain_events").insert({
      topic: "payout.released",
      aggregate_type: "booking",
      aggregate_id: booking.id,
      payload: {
        booking_id: booking.id,
        amount_cents: vendorCents,
        transfer_id: transferId,
        released_by: context.userId,
      },
    });

    if (collectBalance) {
      await supabaseAdmin.from("domain_events").insert({
        topic: "booking.balance_collected",
        aggregate_type: "booking",
        aggregate_id: booking.id,
        payload: {
          booking_id: booking.id,
          amount_cents: expectedBalance,
          method: data.balanceMethod,
          collected_by: context.userId,
        },
      });
    }

    return {
      ok: true as const,
      alreadyReleased: false,
      transferId,
      amountCents: vendorCents,
      balanceCollected: collectBalance,
      balanceCents: collectBalance ? expectedBalance : 0,
    };
  });
