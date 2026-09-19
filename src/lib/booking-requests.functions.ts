/**
 * Request-to-book: operator accepts or declines a `pending_confirmation`
 * booking. Money moves first (capture / cancel the authorised PaymentIntent),
 * then the state machine RPC records the transition and emits the event.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const respondToBookingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        action: z.enum(["accept", "decline"]),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id,status,captain_id,business_id,stripe_payment_intent_id,accept_deadline_at")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!booking) throw new Response("Booking not found", { status: 404 });

    // RLS also exposes this row to the angler — only the operator side may decide.
    let authorized = booking.captain_id === userId;
    if (!authorized && booking.business_id) {
      const { data: ok } = await supabase.rpc("is_business_member", {
        _business_id: booking.business_id,
        _user_id: userId,
        _min_role: "staff",
      });
      authorized = ok === true;
    }
    if (!authorized) throw new Response("Forbidden", { status: 403 });

    if (booking.status !== "pending_confirmation") {
      throw new Response(`This request is no longer awaiting a response (${booking.status}).`, {
        status: 400,
      });
    }

    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const pi = booking.stripe_payment_intent_id;

    if (stripe && pi) {
      try {
        const intent = await stripe.paymentIntents.retrieve(pi);
        if (data.action === "accept") {
          let captured = intent;
          if (intent.status === "requires_capture") {
            captured = await stripe.paymentIntents.capture(pi, undefined, {
              idempotencyKey: `capture-${booking.id}`,
            });
          }
          if (captured.status === "succeeded") {
            const chargeId =
              typeof captured.latest_charge === "string" ? captured.latest_charge : null;
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("bookings")
              .update({
                escrow_state: "held",
                ...(chargeId ? { stripe_charge_id: chargeId } : {}),
                updated_at: new Date().toISOString(),
              })
              .eq("id", booking.id);
          }
        } else if (["requires_capture", "requires_payment_method", "requires_confirmation"].includes(intent.status)) {
          await stripe.paymentIntents.cancel(pi, undefined, {
            idempotencyKey: `cancel-${booking.id}`,
          });
        } else if (intent.status === "succeeded") {
          await stripe.refunds.create(
            { payment_intent: pi, reason: "requested_by_customer" },
            { idempotencyKey: `decline-refund-${booking.id}` },
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Response(`Payment step failed: ${msg}`, { status: 400 });
      }
    }

    const { data: row, error: rpcErr } = await supabase.rpc("transition_booking", {
      _booking_id: data.bookingId,
      _to_status: data.action === "accept" ? "confirmed" : "declined",
      _reason: data.reason ?? (data.action === "accept" ? "captain_accept" : "captain_decline"),
      _metadata: {} as never,
    });
    if (rpcErr) throw new Response(rpcErr.message, { status: 400 });

    return row;
  });

/** Operator/angler view of pending requests awaiting an accept decision. */
export const listPendingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ businessId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("bookings")
      .select(
        "id,trip_date,start_time,party_size,total_cents,deposit_cents,balance_due_cents,accept_deadline_at,angler_id,notes,service:bookable_services(title,kind,hero_url)",
      )
      .eq("status", "pending_confirmation");
    if (data.businessId) q = q.eq("business_id", data.businessId);
    const { data: rows, error } = await q
      .order("accept_deadline_at", { ascending: true })
      .limit(50);
    if (error) {
      console.error("[booking-requests] listPendingRequests failed", error);
      return [];
    }
    return rows ?? [];
  });

/**
 * Booking workflow list for any vertical (marina slips, lodging, guided trips).
 * Mirrors the charter bookings table so non-charter operators get parity.
 */
export const listOperatorBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        scope: z.enum(["upcoming", "past", "all"]).default("upcoming"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    let q = context.supabase
      .from("bookings")
      .select(
        "id,trip_date,start_time,status,party_size,total_cents,deposit_cents,balance_due_cents,balance_collected_at,escrow_state,accept_deadline_at,service:bookable_services(title,kind)",
      )
      .eq("business_id", data.businessId);

    if (data.scope === "upcoming") q = q.gte("trip_date", today);
    if (data.scope === "past") q = q.lt("trip_date", today);

    const { data: rows, error } = await q
      .order("trip_date", { ascending: data.scope !== "past" })
      .limit(100);
    if (error) {
      console.error("[booking-requests] listOperatorBookings failed", error);
      return [];
    }
    return rows ?? [];
  });

