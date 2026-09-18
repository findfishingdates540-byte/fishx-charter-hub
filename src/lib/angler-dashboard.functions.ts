/**
 * Server functions powering the angler dashboard.
 * All queries run as the signed-in user via requireSupabaseAuth (RLS applies).
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const UPCOMING_STATUSES: BookingStatus[] = [
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "in_progress",
];

const ESCROW_STATUSES: BookingStatus[] = ["confirmed", "in_progress"];


export const getAnglerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const today = new Date().toISOString().slice(0, 10);

    const [profileRes, upcomingRes, completedRes] = await Promise.all([
      supabase.from("profiles").select("display_name,full_name,avatar_url").eq("id", userId).maybeSingle(),
      supabase
        .from("bookings")
        .select(
          "id,trip_date,start_time,status,total_cents,party_size,escrow_state,service:bookable_services(id,title,hero_url,departure_location),business:businesses(id,slug,name,city,region,hero_url,logo_url,verified_at)",
        )
        .eq("angler_id", userId)
        .in("status", UPCOMING_STATUSES)
        .gte("trip_date", today)
        .order("trip_date", { ascending: true })
        .limit(10),
      supabase
        .from("bookings")
        .select("id,total_cents,status")
        .eq("angler_id", userId)
        .in("status", ["completed", "reviewed"] satisfies BookingStatus[]),
    ]);

    if (profileRes.error) throw new Response(profileRes.error.message, { status: 500 });
    if (upcomingRes.error) throw new Response(upcomingRes.error.message, { status: 500 });
    if (completedRes.error) throw new Response(completedRes.error.message, { status: 500 });

    const upcoming = upcomingRes.data ?? [];
    const escrowCents = upcoming
      .filter((b) => ESCROW_STATUSES.includes(b.status))
      .reduce((sum, b) => sum + (b.total_cents ?? 0), 0);

    return {
      profile: profileRes.data,
      upcoming,
      completedCount: completedRes.data?.length ?? 0,
      escrowCents,
      upcomingCount: upcoming.length,
    };
  });

/** Public: recommended charters for the "picked for you" strip. */
export const listRecommendedCharters = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb
    .from("bookable_services")
    .select(
      "id,slug,title,hero_url,base_price_cents,departure_location,business:businesses(id,slug,name,city,region,verified_at)",
    )
    .eq("is_published", true)
    .in("kind", ["charter_trip", "guided_trip"])
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw new Response(error.message, { status: 500 });
  return data ?? [];
});
