/**
 * Server functions for the angler Messages screen.
 * All queries run as the signed-in user via requireSupabaseAuth (RLS applies) —
 * booking_messages rows are visible only to the parties on the booking.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Thread list for the angler: one thread per booking, newest activity first. */
export const listMessageThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const bookingsRes = await supabase
      .from("bookings")
      .select("id,status,trip_date,start_time,service_id,business_id,captain_id")
      .eq("angler_id", userId)
      .order("trip_date", { ascending: false })
      .limit(100);
    if (bookingsRes.error) throw new Response(bookingsRes.error.message, { status: 500 });
    const bookings = bookingsRes.data ?? [];
    if (bookings.length === 0) return { threads: [] };

    const bookingIds = bookings.map((b) => b.id);

    const messagesRes = await supabase
      .from("booking_messages")
      .select("id,booking_id,body,sender_id,created_at,read_at,is_deleted")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (messagesRes.error) throw new Response(messagesRes.error.message, { status: 500 });
    const messages = (messagesRes.data ?? []).map((m: any) => ({
      ...m,
      body: m.is_deleted ? "Message deleted" : m.body,
    }));


    // Derive per-booking activity in JS (one query for all threads).
    type LastMessage = { body: string | null; created_at: string; sender_id: string };
    const lastByBooking = new Map<string, LastMessage>();
    const unreadByBooking = new Map<string, number>();
    const countByBooking = new Map<string, number>();
    for (const m of messages) {
      // messages are already ordered ascending, so the final write wins as "last".
      lastByBooking.set(m.booking_id, {
        body: m.body,
        created_at: m.created_at,
        sender_id: m.sender_id,
      });
      countByBooking.set(m.booking_id, (countByBooking.get(m.booking_id) ?? 0) + 1);
      if (m.read_at === null && m.sender_id !== userId) {
        unreadByBooking.set(m.booking_id, (unreadByBooking.get(m.booking_id) ?? 0) + 1);
      }
    }

    const serviceIds = [...new Set(bookings.map((b) => b.service_id).filter(Boolean))] as string[];
    const businessIds = [...new Set(bookings.map((b) => b.business_id).filter(Boolean))] as string[];
    const captainIds = [...new Set(bookings.map((b) => b.captain_id).filter(Boolean))] as string[];

    const [servicesRes, businessesRes, captainsRes] = await Promise.all([
      serviceIds.length
        ? supabase.from("bookable_services").select("id,title,hero_url").in("id", serviceIds)
        : Promise.resolve({ data: [], error: null }),
      businessIds.length
        ? supabase.from("businesses").select("id,name,logo_url,hero_url").in("id", businessIds)
        : Promise.resolve({ data: [], error: null }),
      captainIds.length
        ? supabase.from("profiles").select("id,full_name,display_name,avatar_url").in("id", captainIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const services = new Map((servicesRes.data ?? []).map((s) => [s.id, s]));
    const businesses = new Map((businessesRes.data ?? []).map((b) => [b.id, b]));
    const captains = new Map((captainsRes.data ?? []).map((c) => [c.id, c]));

    const threads = bookings.map((b) => ({
      booking: b,
      service: b.service_id ? services.get(b.service_id) ?? null : null,
      business: b.business_id ? businesses.get(b.business_id) ?? null : null,
      captain: b.captain_id ? captains.get(b.captain_id) ?? null : null,
      lastMessage: lastByBooking.get(b.id) ?? null,
      unread: unreadByBooking.get(b.id) ?? 0,
      messageCount: countByBooking.get(b.id) ?? 0,
    }));

    // Newest conversation first; threads with no messages sink to the bottom.
    threads.sort((a, b) => {
      const at = a.lastMessage ? Date.parse(a.lastMessage.created_at) : -Infinity;
      const bt = b.lastMessage ? Date.parse(b.lastMessage.created_at) : -Infinity;
      return bt - at;
    });

    return { threads };
  });

/** One booking's full thread (with counterpart context). */
export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const bookingRes = await supabase
      .from("bookings")
      .select("id,status,trip_date,start_time,party_size,service_id,business_id,captain_id,angler_id")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bookingRes.error) throw new Response(bookingRes.error.message, { status: 500 });
    if (!bookingRes.data) throw new Response("Booking not found", { status: 404 });
    const booking = bookingRes.data;
    if (booking.angler_id !== userId) throw new Response("Forbidden", { status: 403 });

    const [serviceRes, businessRes, captainRes, messagesRes] = await Promise.all([
      booking.service_id
        ? supabase.from("bookable_services").select("id,title,hero_url").eq("id", booking.service_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      booking.business_id
        ? supabase.from("businesses").select("id,name,logo_url,hero_url").eq("id", booking.business_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      booking.captain_id
        ? supabase
            .from("profiles")
            .select("id,full_name,display_name,avatar_url")
            .eq("id", booking.captain_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("booking_messages")
        .select("id,body,sender_id,created_at,read_at")
        .eq("booking_id", data.bookingId)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (messagesRes.error) throw new Response(messagesRes.error.message, { status: 500 });

    return {
      booking,
      service: serviceRes.data,
      business: businessRes.data,
      captain: captainRes.data,
      messages: messagesRes.data ?? [],
      viewerId: userId,
    };
  });

/** Post a message to a booking thread. */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ bookingId: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("booking_messages").insert({
      booking_id: data.bookingId,
      sender_id: userId,
      body: data.body.trim(),
    });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/** Best-effort read receipts: mark the counterpart's unread messages read. */
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Non-fatal: if the RLS UPDATE policy rejects this, we still report ok.
    try {
      await supabase
        .from("booking_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("booking_id", data.bookingId)
        .is("read_at", null)
        .neq("sender_id", userId);
    } catch {
      // read receipts are best-effort — swallow and continue.
    }
    return { ok: true as const };
  });
