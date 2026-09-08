/**
 * Escrow release job — invoked every 15 minutes by pg_cron.
 *
 * Releases the vendor's 80% share via a Stripe transfer to their connected
 * account, but only when ALL of the following hold:
 *   - booking.status = 'completed'
 *   - completed_at is at least 24h in the past
 *   - escrow_state = 'held' (never released before)
 *   - no open/investigating dispute on the booking (payout frozen)
 *   - the vendor's connected account has payouts enabled
 */
import { createFileRoute } from "@tanstack/react-router";
import { assertCronCaller } from "@/lib/cron-auth.server";

const BATCH_SIZE = 25;

export const Route = createFileRoute("/api/public/hooks/release-escrow")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronCaller(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getStripe, splitAmount, ESCROW_HOLD_HOURS } = await import("@/lib/stripe.server");

        const cutoff = new Date(Date.now() - ESCROW_HOLD_HOURS * 3600 * 1000).toISOString();

        const { data: rows, error } = await supabaseAdmin
          .from("bookings")
          .select(
            "id,business_id,total_cents,payout_cents,application_fee_cents,stripe_charge_id,stripe_payment_intent_id,completed_at,business:businesses(id,stripe_account_id,payouts_enabled,commission_rate)",
          )
          .eq("status", "completed")
          .eq("escrow_state", "held")
          .lte("completed_at", cutoff)
          .limit(BATCH_SIZE);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const bookings = rows ?? [];
        if (bookings.length === 0) return Response.json({ ok: true, released: 0, frozen: 0, skipped: 0 });

        const ids = bookings.map((b) => b.id);
        const { data: disputes } = await supabaseAdmin
          .from("disputes")
          .select("booking_id,status")
          .in("booking_id", ids)
          .in("status", ["open", "investigating"]);
        const frozenIds = new Set((disputes ?? []).map((d) => d.booking_id));

        const stripe = getStripe();
        let released = 0;
        let frozen = 0;
        let skipped = 0;

        for (const b of bookings) {
          if (frozenIds.has(b.id)) {
            frozen++;
            await supabaseAdmin.from("bookings").update({ escrow_state: "frozen" }).eq("id", b.id);
            continue;
          }

          const biz = b.business as {
            stripe_account_id: string | null;
            payouts_enabled: boolean | null;
            commission_rate: number | null;
          } | null;

          const gross = b.total_cents ?? 0;
          const rate = Number(biz?.commission_rate ?? 0.2);
          const platformFeeCents = b.application_fee_cents ?? Math.round(gross * rate);
          const vendorCents = b.payout_cents ?? splitAmount(gross).vendorCents;

          if (!stripe || !biz?.stripe_account_id || !biz.payouts_enabled) {
            skipped++;
            continue;
          }

          try {
            const transfer = await stripe.transfers.create(
              {
                amount: vendorCents,
                currency: "usd",
                destination: biz.stripe_account_id,
                ...(b.stripe_charge_id ? { source_transaction: b.stripe_charge_id } : {}),
                metadata: {
                  booking_id: b.id,
                  platform_fee_cents: String(platformFeeCents),
                },
              },
              { idempotencyKey: `booking-payout-${b.id}` },
            );

            const { settleToBank } = await import("@/lib/stripe-payout.server");
            const bank = await settleToBank(stripe, biz.stripe_account_id, vendorCents, {
              booking_id: b.id,
              source_id: `booking-${b.id}`,
            });

            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from("bookings")
              .update({
                escrow_state: "released",
                stripe_transfer_id: transfer.id,
                payout_released_at: nowIso,
              })
              .eq("id", b.id);

            await supabaseAdmin.from("payouts").insert({
              business_id: b.business_id!,
              booking_id: b.id,
              stripe_payout_id: bank.bankPayoutId ?? transfer.id,
              stripe_transfer_id: transfer.id,
              stripe_bank_payout_id: bank.bankPayoutId,
              destination_account_id: biz.stripe_account_id,
              amount_cents: vendorCents,
              currency: "usd",
              status: bank.status,
              arrival_date: bank.arrivalDate,
              failure_message: bank.error,
              ...(bank.status === "paid" ? { paid_at: nowIso } : {}),
            });

            released++;
          } catch (err) {
            skipped++;
            console.error(`[escrow] transfer failed for booking ${b.id}`, err);
          }
        }

        return Response.json({ ok: true, released, frozen, skipped });
      },
    },
  },
});
