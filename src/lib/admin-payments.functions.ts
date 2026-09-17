/**
 * Platform admin: money view across every operator — payout history, money
 * still held in escrow, deposits collected and Stripe Connect status.
 *
 * Admin role is proven through the caller's own RLS-scoped client before the
 * service-role client is ever loaded.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access only");
}

const HELD = new Set(["held", "holding", "pending", "escrow", "captured"]);
const DEAD = new Set([
  "cancelled_angler",
  "cancelled_captain",
  "declined",
  "expired",
  "no_show",
  "refunded",
  "weather_cancelled",
]);

export const getAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [bizRes, payRes, bookRes, ordRes] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select(
          "id,name,category_key,city,stripe_account_id,stripe_account_type,charges_enabled,payouts_enabled",
        )
        .limit(1000),
      supabaseAdmin
        .from("payouts")
        .select(
          "id,business_id,amount_cents,currency,status,paid_at,created_at,stripe_transfer_id,stripe_payout_id",
        )
        .order("created_at", { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from("bookings")
        .select(
          "id,business_id,status,escrow_state,total_cents,deposit_cents,payout_cents,refunded_cents,payout_released_at,trip_date,created_at",
        )
        .limit(5000),
      supabaseAdmin
        .from("product_orders")
        .select("id,business_id,status,total_cents,created_at")
        .limit(5000),
    ]);

    if (bizRes.error) throw new Error(bizRes.error.message);

    type Row = {
      id: string;
      name: string;
      category_key: string | null;
      city: string | null;
      connect: "live" | "restricted" | "not_connected";
      accountType: string | null;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      heldCents: number;
      releasedCents: number;
      depositsCents: number;
      refundedCents: number;
      paidOutCents: number;
      pendingPayoutCents: number;
      lastPaidAt: string | null;
      payoutCount: number;
      bookingCount: number;
      orderGrossCents: number;
    };

    const byId = new Map<string, Row>();
    for (const b of bizRes.data ?? []) {
      const connected = Boolean(b.stripe_account_id);
      byId.set(b.id, {
        id: b.id,
        name: b.name,
        category_key: b.category_key,
        city: b.city ?? null,
        connect: !connected
          ? "not_connected"
          : b.charges_enabled && b.payouts_enabled
            ? "live"
            : "restricted",
        accountType: b.stripe_account_type ?? null,
        chargesEnabled: Boolean(b.charges_enabled),
        payoutsEnabled: Boolean(b.payouts_enabled),
        heldCents: 0,
        releasedCents: 0,
        depositsCents: 0,
        refundedCents: 0,
        paidOutCents: 0,
        pendingPayoutCents: 0,
        lastPaidAt: null,
        payoutCount: 0,
        bookingCount: 0,
        orderGrossCents: 0,
      });
    }

    for (const bk of bookRes.data ?? []) {
      const row = bk.business_id ? byId.get(bk.business_id) : undefined;
      if (!row) continue;
      const dead = DEAD.has(String(bk.status));
      row.bookingCount += 1;
      row.refundedCents += bk.refunded_cents ?? 0;
      if (dead) continue;
      row.depositsCents += bk.deposit_cents ?? 0;
      if (bk.payout_released_at) row.releasedCents += bk.payout_cents ?? 0;
      else if (HELD.has(String(bk.escrow_state ?? "held")))
        row.heldCents += bk.payout_cents ?? 0;
    }

    for (const o of ordRes.data ?? []) {
      const row = o.business_id ? byId.get(o.business_id) : undefined;
      if (!row) continue;
      if (String(o.status) === "cancelled" || String(o.status) === "refunded") continue;
      row.orderGrossCents += o.total_cents ?? 0;
    }

    const payouts = (payRes.data ?? []).map((p) => ({
      ...p,
      businessName: (p.business_id && byId.get(p.business_id)?.name) || "—",
    }));

    for (const p of payRes.data ?? []) {
      const row = p.business_id ? byId.get(p.business_id) : undefined;
      if (!row) continue;
      row.payoutCount += 1;
      if (p.status === "paid" || p.paid_at) {
        row.paidOutCents += p.amount_cents ?? 0;
        if (!row.lastPaidAt || (p.paid_at ?? "") > row.lastPaidAt)
          row.lastPaidAt = p.paid_at ?? row.lastPaidAt;
      } else {
        row.pendingPayoutCents += p.amount_cents ?? 0;
      }
    }

    const operators = Array.from(byId.values())
      .filter(
        (r) =>
          r.bookingCount > 0 ||
          r.payoutCount > 0 ||
          r.orderGrossCents > 0 ||
          r.connect !== "not_connected",
      )
      .sort((a, b) => b.heldCents + b.pendingPayoutCents - (a.heldCents + a.pendingPayoutCents));

    const totals = operators.reduce(
      (acc, r) => ({
        held: acc.held + r.heldCents,
        released: acc.released + r.releasedCents,
        deposits: acc.deposits + r.depositsCents,
        refunded: acc.refunded + r.refundedCents,
        paidOut: acc.paidOut + r.paidOutCents,
        pendingPayout: acc.pendingPayout + r.pendingPayoutCents,
        connected: acc.connected + (r.connect === "live" ? 1 : 0),
        restricted: acc.restricted + (r.connect === "restricted" ? 1 : 0),
        notConnected: acc.notConnected + (r.connect === "not_connected" ? 1 : 0),
      }),
      {
        held: 0,
        released: 0,
        deposits: 0,
        refunded: 0,
        paidOut: 0,
        pendingPayout: 0,
        connected: 0,
        restricted: 0,
        notConnected: 0,
      },
    );

    return { operators, payouts: payouts.slice(0, 200), totals };
  });
