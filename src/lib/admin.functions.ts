/**
 * Platform admin console data + actions: the verification queue, the payout
 * ledger and the dispute tracker.
 *
 * Every function proves the caller holds the `admin` role through their own
 * RLS-scoped client BEFORE the service-role client is loaded.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access only");
}

export const isPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: Boolean(data) };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [verifs, payouts, disputes, businesses] = await Promise.all([
      supabaseAdmin
        .from("verification_requests")
        .select("id,business_id,status,notes,doc_urls,created_at,decided_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("payouts")
        .select("id,business_id,booking_id,amount_cents,currency,status,paid_at,arrival_date,failure_message,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("disputes")
        .select("id,booking_id,kind,status,description,resolution_note,created_at,resolved_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("businesses")
        .select("id,name,slug,category_key,city,region,verified_at,charges_enabled,payouts_enabled")
        .limit(1000),
    ]);

    const bizById = new Map(
      (businesses.data ?? []).map((b) => [b.id, b]),
    );
    const named = <T extends { business_id?: string | null }>(rows: T[] | null) =>
      (rows ?? []).map((r) => ({
        ...r,
        business: r.business_id ? bizById.get(r.business_id) ?? null : null,
      }));

    return {
      verifications: named(verifs.data),
      payouts: named(payouts.data),
      disputes: disputes.data ?? [],
      businesses: businesses.data ?? [],
      totals: {
        pendingVerifications: (verifs.data ?? []).filter((v) => v.status === "pending").length,
        openDisputes: (disputes.data ?? []).filter((d) => d.status !== "resolved" && d.status !== "withdrawn").length,
        pendingPayoutCents: (payouts.data ?? [])
          .filter((p) => p.status !== "paid")
          .reduce((s, p) => s + (p.amount_cents ?? 0), 0),
        paidPayoutCents: (payouts.data ?? [])
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + (p.amount_cents ?? 0), 0),
      },
    };
  });

export const decideVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        requestId: z.string().uuid(),
        approve: z.boolean(),
        note: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("verification_requests")
      .select("id,business_id,status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Verification request not found");

    const status = data.approve ? "approved" : "rejected";
    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update({
        status,
        notes: data.note ?? null,
        reviewer_id: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    // Approving a request is what actually flips the badge on the storefront.
    await supabaseAdmin
      .from("businesses")
      .update({ verified_at: data.approve ? new Date().toISOString() : null })
      .eq("id", req.business_id);

    return { ok: true, status };
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        disputeId: z.string().uuid(),
        note: z.string().min(3).max(2000),
        outcome: z.enum(["resolved", "rejected"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("disputes")
      .update({
        status: data.outcome,
        resolution_note: data.note,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ payoutId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payout, error: payErr } = await supabaseAdmin
      .from("payouts")
      .select("id,business_id,booking_id,amount_cents,currency,status,stripe_payout_id,paid_at")
      .eq("id", data.payoutId)
      .maybeSingle();
    if (payErr) throw new Error(payErr.message);
    if (!payout) throw new Error("Payout not found");
    if (payout.status === "paid" && payout.stripe_payout_id) {
      return { ok: true as const, alreadyPaid: true, transferId: payout.stripe_payout_id };
    }

    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("id,name,stripe_account_id,payouts_enabled")
      .eq("id", payout.business_id ?? "")
      .maybeSingle();
    if (!biz?.stripe_account_id || !biz.payouts_enabled) {
      throw new Error(`${biz?.name ?? "This business"} hasn't finished bank setup — no money can be sent yet.`);
    }

    const amount = Math.max(0, payout.amount_cents ?? 0);
    if (amount <= 0) throw new Error("This payout has no amount to send.");

    // The source charge, when we know it, keeps the transfer tied to the
    // buyer's payment instead of drawing on the platform's own balance.
    let sourceCharge: string | null = null;
    if (payout.booking_id) {
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("stripe_charge_id")
        .eq("id", payout.booking_id)
        .maybeSingle();
      sourceCharge = (booking?.stripe_charge_id as string | null) ?? null;
    }

    const { requireStripe } = await import("./stripe.server");
    const stripe = requireStripe();

    let transferId: string;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount,
          currency: (payout.currency ?? "usd").toLowerCase(),
          destination: biz.stripe_account_id,
          ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
          metadata: {
            payout_id: payout.id,
            ...(payout.booking_id ? { booking_id: payout.booking_id } : {}),
            approved_by: context.userId,
          },
        },
        { idempotencyKey: `admin-payout-${payout.id}` },
      );
      transferId = transfer.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[stripe] admin payout transfer failed", message);
      await supabaseAdmin
        .from("payouts")
        .update({ status: "failed", failure_message: message.slice(0, 400) })
        .eq("id", payout.id);
      throw new Error(`Payout failed: ${message}`);
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("payouts")
      .update({ status: "paid", paid_at: now, stripe_payout_id: transferId, failure_message: null })
      .eq("id", payout.id);

    if (payout.booking_id) {
      await supabaseAdmin
        .from("bookings")
        .update({ escrow_state: "released", payout_released_at: now, stripe_transfer_id: transferId })
        .eq("id", payout.booking_id)
        .is("payout_released_at", null);
    }

    await supabaseAdmin.from("domain_events").insert({
      topic: "payout.released",
      aggregate_type: "payout",
      aggregate_id: payout.id,
      payload: {
        payout_id: payout.id,
        business_id: biz.id,
        amount_cents: amount,
        transfer_id: transferId,
        approved_by: context.userId,
      },
    });

    return { ok: true as const, alreadyPaid: false, transferId, amountCents: amount };
  });

/**
 * Daily payout reconciliation: every payout matched against the booking or
 * shop order it belongs to. Rows are produced by the scheduled
 * `reconcile_payouts` routine; admins can also re-run it on demand.
 */
export const getPayoutReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("payout_reconciliations")
      .select(
        "id,run_date,scope,status,payout_id,booking_id,order_id,business_id,expected_cents,actual_cents,delta_cents,detail,created_at",
      )
      .order("run_date", { ascending: false })
      .order("status", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const latestRun = list[0]?.run_date ?? null;
    const today = list.filter((r) => r.run_date === latestRun);

    const bizIds = Array.from(
      new Set(today.map((r) => r.business_id).filter(Boolean) as string[]),
    );
    const { data: bizRows } = bizIds.length
      ? await supabaseAdmin.from("businesses").select("id,name").in("id", bizIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((bizRows ?? []).map((b) => [b.id, b.name]));

    const withNames = today.map((r) => ({
      ...r,
      business_name: r.business_id ? nameById.get(r.business_id) ?? null : null,
    }));

    return {
      runDate: latestRun,
      rows: withNames,
      totals: {
        checked: withNames.length,
        matched: withNames.filter((r) => r.status === "matched").length,
        problems: withNames.filter((r) => r.status !== "matched").length,
        deltaCents: withNames
          .filter((r) => r.status !== "matched")
          .reduce((s, r) => s + (r.delta_cents ?? 0), 0),
      },
    };
  });

export const runPayoutReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("reconcile_payouts", {});
    if (error) throw new Error(error.message);
    return { ok: true as const, summary: data };
  });

/**
 * Every booked trip on the platform for a given month, with the operator that
 * runs it and the money state (escrow / payout) behind it. Admin only.
 */
export const getAdminTripCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ month: z.string().regex(/^\d{4}-\d{2}$/) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [y, m] = data.month.split("-").map(Number) as [number, number];
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id,trip_date,start_time,status,total_cents,payout_cents,party_size,escrow_state,payout_released_at,business_id,service:bookable_services(title)",
      )
      .gte("trip_date", iso(start))
      .lt("trip_date", iso(end))
      .order("trip_date", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const bizIds = Array.from(new Set(list.map((r) => r.business_id).filter(Boolean) as string[]));
    const ids = list.map((r) => r.id);

    const [{ data: bizRows }, { data: payRows }] = await Promise.all([
      bizIds.length
        ? supabaseAdmin.from("businesses").select("id,name,category_key").in("id", bizIds)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin
            .from("payouts")
            .select("id,booking_id,amount_cents,status,paid_at,arrival_date,stripe_bank_payout_id,failure_message")
            .in("booking_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const bizById = new Map((bizRows ?? []).map((b: any) => [b.id, b]));
    const payByBooking = new Map((payRows ?? []).map((p: any) => [p.booking_id, p]));

    const trips = list.map((r) => {
      const payout = r.business_id ? payByBooking.get(r.id) ?? null : payByBooking.get(r.id) ?? null;
      const payoutStatus = payout?.status === "paid"
        ? "paid"
        : payout?.status === "in_transit"
          ? "to bank"
          : payout
            ? "scheduled"
            : r.payout_released_at
              ? "paid"
              : r.escrow_state === "held"
                ? "in escrow"
                : "pending";
      const releasable =
        !payout &&
        !r.payout_released_at &&
        r.escrow_state === "held" &&
        ["confirmed", "in_progress", "completed", "reviewed"].includes(String(r.status));
      return {
        id: r.id,
        tripDate: r.trip_date,
        startTime: r.start_time,
        status: r.status,
        title: (r.service as any)?.title ?? "Trip",
        partySize: r.party_size,
        totalCents: r.total_cents ?? 0,
        payoutCents: payout?.amount_cents ?? r.payout_cents ?? 0,
        payoutStatus,
        paidAt: payout?.paid_at ?? r.payout_released_at ?? null,
        operator: r.business_id ? bizById.get(r.business_id)?.name ?? "Unknown operator" : "Unknown operator",
        category: r.business_id ? bizById.get(r.business_id)?.category_key ?? null : null,
      };
    });

    const settled = trips.filter((t) => t.payoutStatus === "paid");
    return {
      month: data.month,
      trips,
      totals: {
        trips: trips.length,
        grossCents: trips.reduce((s, t) => s + t.totalCents, 0),
        paidOutCents: settled.reduce((s, t) => s + t.payoutCents, 0),
        awaitingPayoutCents: trips
          .filter((t) => t.payoutStatus !== "paid")
          .reduce((s, t) => s + t.payoutCents, 0),
      },
    };
  });
