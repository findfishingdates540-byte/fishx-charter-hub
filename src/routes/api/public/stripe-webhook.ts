/**
 * Stripe webhook (platform + Connect events).
 *
 * Verified with STRIPE_WEBHOOK_SECRET before anything is written.
 * Handles:
 *  - payment_intent.succeeded  -> booking becomes confirmed, escrow held
 *  - payment_intent.payment_failed -> booking left pending_payment
 *  - charge.refunded           -> refunded amount tracked
 *  - charge.dispute.created    -> escrow frozen (payout blocked)
 *  - account.updated           -> Connect capability flags synced
 */
import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const signature = request.headers.get("stripe-signature");
        const body = await request.text();

        if (!secret || !signature) {
          return new Response("Webhook not configured", { status: 503 });
        }

        const { getStripe } = await import("@/lib/stripe.server");
        const stripe = getStripe();
        if (!stripe) return new Response("Stripe not configured", { status: 503 });

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, secret);
        } catch (err) {
          console.error("[stripe] signature verification failed", err);
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: ignore events we've already stored.
        const { data: seen } = await supabaseAdmin
          .from("payment_events")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle();
        if (seen) return Response.json({ received: true, duplicate: true });

        const bookingIdOf = (obj: { metadata?: Stripe.Metadata | null }) =>
          (obj.metadata?.["booking_id"] as string | undefined) ?? null;

        const orderIdsOf = (obj: { metadata?: Stripe.Metadata | null }) => {
          if (obj.metadata?.["kind"] !== "product_order") return [];
          return (obj.metadata?.["order_ids"] ?? "").split(",").filter(Boolean);
        };

        /**
         * Marks vendor product orders paid, decrements stock and transfers the
         * vendor's share (order total minus the 8% platform fee) to their
         * connected account. Retail has no dispute
         * window, so the transfer goes out as soon as the charge lands.
         */
        const settleProductOrders = async (
          orderIds: string[],
          paymentIntentId: string | null,
          chargeId: string | null,
          buyer?: {
            shippingAddress?: Record<string, unknown> | null;
            email?: string | null;
            phone?: string | null;
            name?: string | null;
          },
        ) => {
          for (const orderId of orderIds) {
            const { data: order } = await supabaseAdmin
              .from("product_orders")
              .select("id,business_id,total_cents,payout_cents,paid_at,stripe_transfer_id")
              .eq("id", orderId)
              .maybeSingle();
            if (!order || order.paid_at) continue;

            await supabaseAdmin
              .from("product_orders")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
                ...(buyer?.shippingAddress ? { shipping_address: buyer.shippingAddress as never } : {}),
                ...(buyer?.email ? { buyer_email: buyer.email } : {}),
                ...(buyer?.name ? { buyer_name: buyer.name } : {}),
              })
              .eq("id", orderId);

            // Draw down inventory for each line.
            const { data: items } = await supabaseAdmin
              .from("product_order_items")
              .select("product_id,quantity")
              .eq("order_id", orderId);
            for (const item of items ?? []) {
              if (!item.product_id) continue;
              const { data: prod } = await supabaseAdmin
                .from("inventory_products")
                .select("stock_qty")
                .eq("id", item.product_id)
                .maybeSingle();
              if (!prod) continue;
              await supabaseAdmin
                .from("inventory_products")
                .update({ stock_qty: Math.max(0, (prod.stock_qty ?? 0) - item.quantity) })
                .eq("id", item.product_id);
            }

            // Funds stay in escrow on the platform balance; the shop settles
            // the payout itself from its Payments screen once the hold clears.
            const { data: biz } = await supabaseAdmin
              .from("businesses")
              .select("payout_delay_days")
              .eq("id", order.business_id)
              .maybeSingle();
            const delayDays = biz?.payout_delay_days ?? 3;
            const dueAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString();
            await supabaseAdmin
              .from("product_orders")
              .update({ payout_due_at: dueAt })
              .eq("id", orderId);
            void chargeId;
          }
        };

        let bookingId: string | null = null;

        const { settlePaidBooking } = await import("@/lib/booking-settle.server");

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              bookingId = bookingIdOf(session);
              const piId =
                typeof session.payment_intent === "string" ? session.payment_intent : null;
              // `unpaid` here means a manual-capture authorisation on a
              // request-to-book listing — still a valid hold.
              if (bookingId && (session.payment_status === "paid" || piId)) {
                await settlePaidBooking(supabaseAdmin as never, bookingId, {
                  paymentIntentId: piId,
                });
              }
              const orderIds = orderIdsOf(session);
              if (orderIds.length && session.payment_status === "paid") {
                let chargeId: string | null = null;
                if (piId) {
                  const pi = await stripe.paymentIntents.retrieve(piId);
                  chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;
                }
                const details = session.customer_details;
                const shipping =
                  (session as unknown as { shipping_details?: { name?: string | null; address?: Record<string, unknown> | null } })
                    .shipping_details ?? null;
                const address = shipping?.address ?? details?.address ?? null;
                await settleProductOrders(orderIds, piId, chargeId, {
                  shippingAddress: address
                    ? {
                        ...address,
                        name: shipping?.name ?? details?.name ?? null,
                        phone: details?.phone ?? null,
                      }
                    : null,
                  email: details?.email ?? null,
                  phone: details?.phone ?? null,
                  name: shipping?.name ?? details?.name ?? null,
                });
              }
              break;
            }

            case "payment_intent.amount_capturable_updated":
            case "payment_intent.succeeded": {
              const pi = event.data.object as Stripe.PaymentIntent;
              bookingId = bookingIdOf(pi);
              if (bookingId) {
                await settlePaidBooking(supabaseAdmin as never, bookingId, {
                  paymentIntentId: pi.id,
                  chargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
                });
              }
              const piOrderIds = orderIdsOf(pi);
              if (piOrderIds.length && event.type === "payment_intent.succeeded") {
                await settleProductOrders(
                  piOrderIds,
                  pi.id,
                  typeof pi.latest_charge === "string" ? pi.latest_charge : null,
                );
              }
              break;
            }


            case "payment_intent.payment_failed": {
              const pi = event.data.object as Stripe.PaymentIntent;
              bookingId = bookingIdOf(pi);
              if (bookingId) {
                await supabaseAdmin
                  .from("bookings")
                  .update({ status: "pending_payment", escrow_state: "none" })
                  .eq("id", bookingId);
              }
              break;
            }
            case "charge.refunded": {
              const charge = event.data.object as Stripe.Charge;
              bookingId = bookingIdOf(charge);
              if (bookingId) {
                await supabaseAdmin
                  .from("bookings")
                  .update({ refunded_cents: charge.amount_refunded, escrow_state: "refunded" })
                  .eq("id", bookingId);
              }
              break;
            }
            case "charge.dispute.created": {
              const dispute = event.data.object as Stripe.Dispute;
              const charge = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
              const { data: booking } = await supabaseAdmin
                .from("bookings")
                .select("id")
                .eq("stripe_charge_id", charge)
                .maybeSingle();
              bookingId = booking?.id ?? null;
              if (bookingId) {
                // Freeze the payout while the dispute is live.
                await supabaseAdmin
                  .from("bookings")
                  .update({ escrow_state: "frozen" })
                  .eq("id", bookingId);
              }
              break;
            }
            case "account.updated": {
              const account = event.data.object as Stripe.Account;
              await supabaseAdmin
                .from("businesses")
                .update({
                  charges_enabled: account.charges_enabled,
                  payouts_enabled: account.payouts_enabled,
                  ...(account.charges_enabled && account.payouts_enabled
                    ? { onboarding_completed_at: new Date().toISOString() }
                    : {}),
                })
                .eq("stripe_account_id", account.id);
              break;
            }
            // Connected-account bank payouts: this is the money actually
            // leaving Stripe and landing in the operator's bank.
            case "payout.paid":
            case "payout.failed":
            case "payout.canceled": {
              const payout = event.data.object as Stripe.Payout;
              const paid = event.type === "payout.paid";
              await supabaseAdmin
                .from("payouts")
                .update({
                  status: paid ? "paid" : "failed",
                  ...(paid ? { paid_at: new Date().toISOString() } : {}),
                  ...(payout.arrival_date
                    ? { arrival_date: new Date(payout.arrival_date * 1000).toISOString().slice(0, 10) }
                    : {}),
                  failure_message: paid ? null : payout.failure_message ?? event.type,
                })
                .eq("stripe_bank_payout_id", payout.id);
              break;
            }
            // Automatic-schedule accounts: Stripe pays out on its own, so the
            // transfer landing in their balance is our settlement signal.
            case "transfer.created": {
              const transfer = event.data.object as Stripe.Transfer;
              await supabaseAdmin
                .from("payouts")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("stripe_transfer_id", transfer.id)
                .is("stripe_bank_payout_id", null);
              break;
            }
            case "transfer.reversed": {
              const transfer = event.data.object as Stripe.Transfer;
              await supabaseAdmin
                .from("payouts")
                .update({ status: "reversed", failure_message: "Transfer reversed" })
                .eq("stripe_transfer_id", transfer.id);
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error(`[stripe] handler failed for ${event.type}`, err);
          return new Response("Handler error", { status: 500 });
        }

        await supabaseAdmin.from("payment_events").insert({
          stripe_event_id: event.id,
          event_type: event.type,
          payload: JSON.parse(body),
          booking_id: bookingId,
          processed_at: new Date().toISOString(),
        });

        return Response.json({ received: true });
      },
    },
  },
});
