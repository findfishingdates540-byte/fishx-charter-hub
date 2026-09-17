/**
 * Captain-side server functions for a single booking detail view.
 * Verifies the caller is a member of the booking's business (RLS + explicit check).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

export const getCaptainBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const bookingRes = await supabase
      .from("bookings")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (bookingRes.error) throw new Response(bookingRes.error.message, { status: 500 });
    if (!bookingRes.data) throw new Response("Booking not found", { status: 404 });
    const booking = bookingRes.data;

    // Authorization: caller must be a member of the business (or captain themselves).
    let authorized = booking.captain_id === userId;
    if (!authorized && booking.business_id) {
      const { data: mem } = await supabase
        .from("business_members")
        .select("role")
        .eq("business_id", booking.business_id)
        .eq("user_id", userId)
        .maybeSingle();
      authorized = !!mem;
    }
    if (!authorized) throw new Response("Forbidden", { status: 403 });

    const [serviceRes, businessRes, anglerRes, messagesRes] = await Promise.all([
      booking.service_id
        ? supabase
            .from("bookable_services")
            .select("id,title,kind,hero_url,departure_location,duration_minutes,base_price_cents")
            .eq("id", booking.service_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      booking.business_id
        ? supabase
            .from("businesses")
            .select("id,name,city,region")
            .eq("id", booking.business_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      booking.angler_id
        ? supabase
            .from("profiles")
            .select("id,full_name,display_name,avatar_url,bio,home_port,favorite_species")
            .eq("id", booking.angler_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("booking_messages")
        .select("id,body,sender_id,created_at")
        .eq("booking_id", data.id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);
    if (messagesRes.error) throw new Response(messagesRes.error.message, { status: 500 });

    return {
      booking,
      service: serviceRes.data,
      business: businessRes.data,
      angler: anglerRes.data,
      messages: messagesRes.data ?? [],
      viewerId: userId,
    };
  });

export const captainSendMessage = createServerFn({ method: "POST" })
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

export const weatherCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        bookingId: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const to: BookingStatus = "weather_cancelled";
    const { data: row, error } = await context.supabase.rpc("transition_booking", {
      _booking_id: data.bookingId,
      _to_status: to,
      _reason: data.note ?? "Weather call by captain",
      _metadata: { source: "captain_weather_call" },
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const, booking: row };
  });

export const markTripComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const to: BookingStatus = "completed";
    const { data: row, error } = await context.supabase.rpc("transition_booking", {
      _booking_id: data.bookingId,
      _to_status: to,
      _reason: "Trip completed by captain",
      _metadata: {},
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const, booking: row };
  });
