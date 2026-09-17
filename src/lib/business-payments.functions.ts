/**
 * Payments & payouts overview for any business vertical.
 *
 * Runs as the signed-in user through requireSupabaseAuth, so RLS decides what
 * the caller can read: business members see their business's bookings and
 * orders, managers/owners additionally see the payout ledger.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const money = (n: unknown) => (typeof n === "number" ? n : 0);

export const getBusinessPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const businessId = data.businessId;

    // The public "published businesses" policy is row-level only, so an RLS
    // read alone would hand a business's commission/payout terms to any
    // signed-in user. Require staff membership before touching the data.
    const { data: isMember, error: memberErr } = await supabase.rpc("is_business_member", {
      _business_id: businessId,
      _user_id: context.userId,
      _min_role: "staff",
    });
    if (memberErr) throw new Error(memberErr.message);
    if (!isMember) throw new Error("You don't have access to this business's payments.");

    const [bizRes, bookingRes, payoutRes, orderRes, refundLess] = await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,commission_rate,product_commission_rate,deposit_rate,charges_enabled,payouts_enabled,payout_delay_days")
        .eq("id", businessId)
        .maybeSingle(),

      supabase
        .from("bookings")
        .select(
          "id,trip_date,status,escrow_state,total_cents,deposit_cents,balance_due_cents,balance_collected_at,payout_cents,application_fee_cents,refunded_cents,payout_released_at,completed_at,dispute_window_ends_at,created_at,service:bookable_services(title)",
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payouts")
        .select("id,amount_cents,status,currency,paid_at,arrival_date,created_at,booking_id,failure_message")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("product_orders")
        .select(
          "id,status,total_cents,payout_cents,application_fee_cents,paid_at,payout_due_at,payout_released_at,delivered_at,stripe_transfer_id,created_at,buyer_name",
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100),
      Promise.resolve(null),
    ]);

    if (bizRes.error) throw new Response(bizRes.error.message, { status: 403 });
    if (!bizRes.data) throw new Response("Business not found", { status: 404 });
    void refundLess;

    const bookings = bookingRes.data ?? [];
    const payouts = payoutRes.data ?? [];
    const orders = orderRes.data ?? [];

    const paidStatuses = new Set(["confirmed", "in_progress", "completed", "reviewed"]);

    let grossCents = 0;
    let depositsCents = 0;
    let feesCents = 0;
    let escrowCents = 0;
    let releasedCents = 0;
    let refundedCents = 0;
    let balanceOutstandingCents = 0;

    for (const b of bookings) {
      if (!paidStatuses.has(String(b.status))) {
        refundedCents += money(b.refunded_cents);
        continue;
      }
      grossCents += money(b.total_cents);
      depositsCents += money(b.deposit_cents);
      feesCents += money(b.application_fee_cents);
      refundedCents += money(b.refunded_cents);
      if (b.escrow_state === "held" || b.escrow_state === "frozen") escrowCents += money(b.payout_cents);
      if (b.payout_released_at) releasedCents += money(b.payout_cents);
      if (!b.balance_collected_at) balanceOutstandingCents += money(b.balance_due_cents);
    }

    let orderRevenueCents = 0;
    let orderFeesCents = 0;
    let orderPendingPayoutCents = 0;
    for (const o of orders) {
      if (!o.paid_at) continue;
      orderRevenueCents += money(o.total_cents);
      orderFeesCents += money(o.application_fee_cents);
      if (!o.payout_released_at) orderPendingPayoutCents += money(o.payout_cents);
    }

    // Last 6 months of gross, for the chart.
    const monthly: Array<{ ym: string; cents: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const ym = `${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const cents =
        bookings
          .filter((b) => paidStatuses.has(String(b.status)) && String(b.trip_date).startsWith(key))
          .reduce((s, b) => s + money(b.total_cents), 0) +
        orders
          .filter((o) => o.paid_at && String(o.paid_at).startsWith(key))
          .reduce((s, o) => s + money(o.total_cents), 0);
      monthly.push({ ym, cents });
    }

    const transactions = [
      ...bookings.slice(0, 40).map((b) => ({
        id: b.id,
        kind: "booking" as const,
        label: (b.service as any)?.title ?? "Booking",
        date: (b.trip_date as string) ?? (b.created_at as string),
        status: String(b.status),
        grossCents: money(b.total_cents),
        depositCents: money(b.deposit_cents),
        balanceDueCents: b.balance_collected_at ? 0 : money(b.balance_due_cents),
        feeCents: money(b.application_fee_cents),
        netCents: money(b.payout_cents),
        escrowState: String(b.escrow_state ?? "none"),
        releasedAt: b.payout_released_at as string | null,
        payoutDueAt: (b.dispute_window_ends_at as string | null) ?? null,
        settleable: false,
      })),
      ...orders.slice(0, 40).map((o) => ({
        id: o.id,
        kind: "order" as const,
        label: o.buyer_name ? `Order — ${o.buyer_name}` : "Product order",
        date: (o.paid_at as string) ?? (o.created_at as string),
        status: String(o.status),
        grossCents: money(o.total_cents),
        depositCents: money(o.total_cents),
        balanceDueCents: 0,
        feeCents: money(o.application_fee_cents),
        netCents: money(o.payout_cents),
        escrowState: o.payout_released_at ? "released" : "held",
        releasedAt: o.payout_released_at as string | null,
        // Shops settle their own orders from the ledger once funds clear.
        payoutDueAt: (o.payout_due_at as string | null) ?? null,
        settleable:
          Boolean(o.paid_at) &&
          !o.payout_released_at &&
          !o.stripe_transfer_id &&
          !["refunded", "cancelled"].includes(String(o.status)) &&
          (!o.payout_due_at || new Date(o.payout_due_at as string) <= new Date()),
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    return {
      business: bizRes.data,
      totals: {
        grossCents: grossCents + orderRevenueCents,
        depositsCents,
        feesCents: feesCents + orderFeesCents,
        escrowCents: escrowCents + orderPendingPayoutCents,
        releasedCents,
        refundedCents,
        balanceOutstandingCents,
      },
      monthly,
      transactions,
      payouts,
    };
  });
