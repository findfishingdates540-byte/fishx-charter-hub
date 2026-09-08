/**
 * Shop-side payout settlement: moves the vendor's share of a paid product
 * order out of the platform balance and into the shop's connected account,
 * mirroring `releaseBookingPayout` for charters.
 *
 * Authorization runs through the caller's RLS-scoped client first (business
 * members only); the service-role client is loaded afterwards for the writes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ORDER_SELECT =
  "id,business_id,status,total_cents,payout_cents,application_fee_cents,paid_at,delivered_at,payout_due_at,payout_released_at,stripe_transfer_id,stripe_payment_intent_id";

export const releaseProductOrderPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // RLS keeps this to orders belonging to a business the caller works for.
    const { data: order, error } = await context.supabase
      .from("product_orders")
      .select(ORDER_SELECT)
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found, or it isn't yours to settle.");

    if (order.payout_released_at || order.stripe_transfer_id) {
      return { ok: true as const, alreadyReleased: true, transferId: order.stripe_transfer_id };
    }
    if (!order.paid_at) throw new Error("This order hasn't been paid yet.");
    if (String(order.status) === "refunded" || String(order.status) === "cancelled") {
      throw new Error("Cancelled and refunded orders can't be paid out.");
    }
    if (order.payout_due_at && new Date(order.payout_due_at) > new Date()) {
      throw new Error(
        `Funds clear on ${new Date(order.payout_due_at).toLocaleDateString()} — the buyer window is still open.`,
      );
    }

    const vendorCents = Math.max(0, order.payout_cents ?? 0);
    if (vendorCents <= 0) throw new Error("Nothing left to pay out on this order.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("id,stripe_account_id,payouts_enabled")
      .eq("id", order.business_id)
      .maybeSingle();
    if (!biz?.stripe_account_id || !biz.payouts_enabled) {
      throw new Error("Finish your bank setup before settling payouts.");
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
          transfer_group: `order_${order.id}`,
          metadata: {
            order_id: order.id,
            platform_fee_cents: String(order.application_fee_cents ?? 0),
          },
        },
        { idempotencyKey: `order-payout-${order.id}` },
      );
      transferId = transfer.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[stripe] order transfer failed", message);
      throw new Error(`Payout failed: ${message}`);
    }

    const { settleToBank } = await import("./stripe-payout.server");
    const bank = await settleToBank(stripe, biz.stripe_account_id, vendorCents, {
      order_id: order.id,
      source_id: `order-${order.id}`,
    });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("product_orders")
      .update({ stripe_transfer_id: transferId, payout_released_at: now, updated_at: now })
      .eq("id", order.id);

    await supabaseAdmin.from("payouts").insert({
      business_id: biz.id,
      order_id: order.id,
      stripe_payout_id: bank.bankPayoutId ?? transferId,
      stripe_transfer_id: transferId,
      stripe_bank_payout_id: bank.bankPayoutId,
      destination_account_id: biz.stripe_account_id,
      amount_cents: vendorCents,
      currency: "usd",
      status: bank.status,
      arrival_date: bank.arrivalDate,
      failure_message: bank.error,
      ...(bank.status === "paid" ? { paid_at: now } : {}),
    });

    await supabaseAdmin.from("domain_events").insert({
      topic: "payout.released",
      aggregate_type: "product_order",
      aggregate_id: order.id,
      payload: {
        order_id: order.id,
        amount_cents: vendorCents,
        transfer_id: transferId,
        released_by: context.userId,
      },
    });

    return { ok: true as const, alreadyReleased: false, transferId, amountCents: vendorCents };
  });
