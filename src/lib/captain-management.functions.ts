/**
 * Captain management server functions: bookings list, services CRUD,
 * earnings breakdown, and message conversations. All scoped to the user's
 * primary business via RLS on business_members / bookable_services / bookings.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];
type ServiceKind = Database["public"]["Enums"]["service_kind"];

async function pickBusinessId(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("business_members")
    .select("role,business_id")
    .eq("user_id", userId);
  if (error) throw new Response(error.message, { status: 500 });
  const primary = (data ?? []).find((m: any) => m.role === "owner") ?? data?.[0];
  return primary?.business_id ?? null;
}

/* ---------------- BOOKINGS ---------------- */

export const listCaptainBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: BookingStatus | "all" }) => i ?? { status: "all" })
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) return { businessId: null, rows: [] };
    let q = context.supabase
      .from("bookings")
      .select("id,trip_date,start_time,status,total_cents,party_size,customer:customers(full_name,email),service:bookable_services(title,hero_url)")
      .eq("business_id", businessId)
      .order("trip_date", { ascending: false })
      .limit(100);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return { businessId, rows: rows ?? [] };
  });

/* ---------------- SERVICES CRUD ---------------- */

const serviceInput = z.object({
  id: z.string().uuid().optional(),
  charter_id: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(120),
  // Captain listings are always charters — the "kind" selector is gone from the
  // UI; default it so the DB enum (service_kind) is always satisfied.
  kind: z.literal("charter_trip").default("charter_trip"),
  description: z.string().max(4000).optional().nullable(),
  // NOT a URL: our own uploader returns a relative `/api/public/media/...` path,
  // which `z.string().url()` rejected — the reason captain hero uploads never saved.
  hero_url: z.string().max(2000).optional().nullable(),
  water_type: z.string().max(40).optional().nullable(),
  boat_id: z.string().uuid().optional().nullable(),
  base_price_cents: z.number().int().min(0),
  deposit_cents: z.number().int().min(0).default(0),
  capacity: z.number().int().min(1).max(50).default(4),
  duration_minutes: z.number().int().min(30).max(24 * 60).optional().nullable(),
  departure_location: z.string().max(200).optional().nullable(),
  target_species: z.array(z.string()).default([]),
  includes: z.array(z.string()).default([]),
  is_published: z.boolean().default(false),
});

export const upsertCaptainService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => serviceInput.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("No business found", { status: 400 });

    let inheritedHero: string | null = null;
    // If a charter_id was provided, ensure that charter exists under this business
    if (data.charter_id) {
      const { data: charter } = await context.supabase
        .from("charters")
        .select("id,hero_url,image_urls")
        .eq("id", data.charter_id)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!charter) throw new Response("Charter not found or not in your business", { status: 404 });
      inheritedHero = charter.hero_url ?? (charter.image_urls as string[] | null)?.[0] ?? null;
    }

    const payload = {
      ...data,
      // Packages without their own image inherit the parent charter's image so
      // trip/booking cards never render imageless.
      hero_url: data.hero_url || inheritedHero,
      business_id: businessId,
      kind: data.kind as ServiceKind,
    };
    const { data: row, error } = data.id
      ? await context.supabase.from("bookable_services").update(payload).eq("id", data.id).eq("business_id", businessId).select().single()
      : await context.supabase.from("bookable_services").insert(payload).select().single();
    if (error) throw new Response(error.message, { status: 400 });
    if (row?.is_published) {
      const { ensureFutureAvailability } = await import("./availability-seed.server");
      await ensureFutureAvailability(context.supabase, row);
    }
    return row;
  });


export const deleteCaptainService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("No business", { status: 400 });
    const { error } = await context.supabase.from("bookable_services").delete().eq("id", data.id).eq("business_id", businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const toggleServicePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_published: boolean }) =>
    z.object({ id: z.string().uuid(), is_published: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("No business", { status: 400 });
    const { error } = await context.supabase
      .from("bookable_services")
      .update({ is_published: data.is_published })
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/* ---------------- EARNINGS ---------------- */

export const getCaptainEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) return { monthly: [], byService: [], totals: { grossCents: 0, feeCents: 0, netCents: 0, escrowCents: 0 } };

    const earned: BookingStatus[] = ["completed", "reviewed"];
    const escrow: BookingStatus[] = ["confirmed", "in_progress"];

    const [earnedRes, escrowRes] = await Promise.all([
      context.supabase
        .from("bookings")
        .select("total_cents,trip_date,service:bookable_services(title)")
        .eq("business_id", businessId)
        .in("status", earned)
        .order("trip_date", { ascending: false })
        .limit(500),
      context.supabase
        .from("bookings")
        .select("total_cents")
        .eq("business_id", businessId)
        .in("status", escrow),
    ]);
    if (earnedRes.error) throw new Response(earnedRes.error.message, { status: 500 });
    if (escrowRes.error) throw new Response(escrowRes.error.message, { status: 500 });

    const rows = earnedRes.data ?? [];
    const grossCents = rows.reduce((s: number, r: any) => s + (r.total_cents ?? 0), 0);
    const feeCents = Math.round(grossCents * 0.1); // 10% platform fee
    const netCents = grossCents - feeCents;
    const escrowCents = (escrowRes.data ?? []).reduce((s: number, r: any) => s + (r.total_cents ?? 0), 0);

    const bucket = new Map<string, number>();
    const svcBucket = new Map<string, number>();
    for (const r of rows) {
      const ym = String(r.trip_date).slice(0, 7);
      bucket.set(ym, (bucket.get(ym) ?? 0) + (r.total_cents ?? 0));
      const t = (r as any).service?.title ?? "Untitled";
      svcBucket.set(t, (svcBucket.get(t) ?? 0) + (r.total_cents ?? 0));
    }
    const monthly = [...bucket.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, cents]) => ({ ym, cents }));
    const byService = [...svcBucket.entries()].sort((a, b) => b[1] - a[1]).map(([title, cents]) => ({ title, cents }));

    return { monthly, byService, totals: { grossCents, feeCents, netCents, escrowCents } };
  });

/* ---------------- MESSAGES ---------------- */

export const listCaptainConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) return [];

    const { data: bookings, error } = await context.supabase
      .from("bookings")
      .select("id,customer_id,angler_id,trip_date,start_time,party_size,status,service:bookable_services(title,hero_url),customer:customers(full_name)")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(40);
    if (error) throw new Response(error.message, { status: 500 });
    if (!bookings?.length) return [];

    const ids = bookings.map((b: any) => b.id);
    const { data: msgs, error: mErr } = await context.supabase
      .from("booking_messages")
      .select("booking_id,body,created_at,sender_id,read_at")
      .in("booking_id", ids)
      .order("created_at", { ascending: false });
    if (mErr) throw new Response(mErr.message, { status: 500 });

    const latestByBooking = new Map<string, any>();
    const unreadByBooking = new Map<string, number>();
    for (const m of msgs ?? []) {
      if (!latestByBooking.has(m.booking_id)) latestByBooking.set(m.booking_id, m);
      if (!m.read_at && m.sender_id !== context.userId) {
        unreadByBooking.set(m.booking_id, (unreadByBooking.get(m.booking_id) ?? 0) + 1);
      }
    }

    return bookings
      .map((b: any) => ({
        booking_id: b.id,
        customer_name: b.customer?.full_name ?? "Guest",
        trip_title: b.service?.title ?? "Charter",
        trip_date: b.trip_date,
        start_time: b.start_time,
        party_size: b.party_size,
        angler_id: b.angler_id,
        status: b.status,
        last_message: latestByBooking.get(b.id) ?? null,
        unread_count: unreadByBooking.get(b.id) ?? 0,
      }))
      .sort((a, b) => (b.last_message.created_at ?? "").localeCompare(a.last_message.created_at ?? ""));
  });

/** One booking thread for the operator side (messages + guest context). */
export const getCaptainThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bookingRes = await supabase
      .from("bookings")
      .select(
        "id,status,trip_date,start_time,party_size,business_id,angler_id,service:bookable_services(title,hero_url),customer:customers(full_name)",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bookingRes.error) throw new Response(bookingRes.error.message, { status: 500 });
    const booking: any = bookingRes.data;
    if (!booking) throw new Response("Booking not found", { status: 404 });

    const messagesRes = await supabase
      .from("booking_messages")
      .select("id,body,sender_id,created_at,read_at,is_deleted,reply_to_id")
      .eq("booking_id", data.bookingId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (messagesRes.error) throw new Response(messagesRes.error.message, { status: 500 });

    const msgIds = (messagesRes.data ?? []).map((m: any) => m.id);
    const reactionsRes = msgIds.length
      ? await supabase
          .from("booking_message_reactions")
          .select("message_id,emoji,user_id")
          .in("message_id", msgIds)
      : { data: [], error: null };


    let angler: any = null;
    if (booking.angler_id) {
      const res = await supabase
        .from("profiles")
        .select("id,full_name,display_name,avatar_url")
        .eq("id", booking.angler_id)
        .maybeSingle();
      angler = res.data ?? null;
    }

    return {
      booking,
      angler,
      guestName: angler?.display_name || angler?.full_name || booking.customer?.full_name || "Guest",
      messages: messagesRes.data ?? [],
      viewerId: userId,
    };
  });
