/**
 * Public business directory read functions.
 * Uses a server-local publishable-key client so anon SELECT policies apply.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listPublicBusinesses = createServerFn({ method: "GET" })
  .inputValidator((input: { category?: string } | undefined) =>
    z.object({ category: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb
      .from("businesses")
      .select("id,slug,name,category_key,tagline,hero_url,logo_url,city,region,country,verified_at,premium_until")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.category) q = q.eq("category_key", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("business_categories")
    .select("key,label,icon,sort_order")
    .order("sort_order");
  if (error) throw new Response(error.message, { status: 500 });
  return data ?? [];
});

export const getBusinessProfile = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: biz, error } = await sb
      .from("businesses")
      .select(
        "id,slug,name,category_key,tagline,description,hero_url,logo_url,website,phone,email,address,city,region,country,lat,lng,hours_json,amenities_json,gallery_json,social_json,policies_json,highlights_json,faq_json,year_founded,verified_at,premium_until",
      )
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!biz) throw new Response("Not found", { status: 404 });

    const [servicesRes, reviewsRes, boatsRes, chartersRes, productsRes, slipsRes, postsRes] = await Promise.all([
      sb
        .from("bookable_services")
        .select("id,slug,kind,title,description,hero_url,duration_minutes,capacity,base_price_cents,deposit_cents,target_species,departure_location,charter_id,boat_id")
        .eq("business_id", biz.id)
        .eq("is_published", true)
        .order("base_price_cents", { ascending: true })
        .limit(24),
      sb
        .from("reviews")
        .select("id,rating,body,response_body,created_at,angler_id")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false })
        .limit(20),
      sb
        .from("boats")
        .select("id,name,make,model,length_ft,capacity,home_port,description,hero_image_url,image_urls")
        .eq("business_id", biz.id)
        .eq("is_active", true)
        .limit(12),
      sb
        .from("charters")
        .select("id,name,boat_id")
        .eq("business_id", biz.id)
        .eq("is_published", true)
        .order("created_at", { ascending: true })
        .limit(24),
      sb
        .from("inventory_products")
        .select("id,title,description,category,price_cents,compare_at_cents,stock_qty,images")
        .eq("business_id", biz.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(12),
      sb
        .from("marina_slips")
        .select("id,slip_number,length_ft,beam_ft,draft_ft,amperage,monthly_rate_cents,nightly_rate_cents,status")
        .eq("business_id", biz.id)
        .order("slip_number")
        .limit(24),
      sb
        .from("business_posts")
        .select("id,body,media_json,created_at")
        .eq("business_id", biz.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const reviews = reviewsRes.data ?? [];
    const anglerIds = Array.from(new Set(reviews.map((r) => r.angler_id).filter(Boolean)));
    let anglerMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (anglerIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", anglerIds as string[]);
      for (const p of profs ?? []) anglerMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
    }

    const ratings = reviews.map((r) => r.rating).filter((n): n is number => typeof n === "number");
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const buckets = [0, 0, 0, 0, 0];
    ratings.forEach((r) => { if (r >= 1 && r <= 5) buckets[r - 1]++; });

    const services = servicesRes.data ?? [];

    // Operator media lives in a private bucket — resolve to signed URLs so the
    // storefront renders fleet and listing photos on every host.
    const { signMediaUrls } = await import("@/lib/media-urls.server");
    const boatsRaw = boatsRes.data ?? [];
    const flat: (string | null | undefined)[] = [];
    for (const bt of boatsRaw) flat.push(bt.hero_image_url, ...((bt.image_urls ?? []) as string[]));
    for (const s of services) flat.push(s.hero_url);
    const signed = await signMediaUrls(flat);
    let i = 0;
    const boats = boatsRaw.map((bt) => {
      const hero = signed[i++] ?? null;
      const gallery = ((bt.image_urls ?? []) as string[]).map(() => signed[i++] ?? "").filter(Boolean);
      return { ...bt, hero_image_url: hero ?? gallery[0] ?? null, image_urls: gallery };
    });
    const servicesSigned = services.map((s) => ({ ...s, hero_url: signed[i++] ?? s.hero_url }));

    const productRows = productsRes.data ?? [];
    const productImgs = await signMediaUrls(
      productRows.map((p) => {
        const imgs = Array.isArray(p.images) ? (p.images as unknown[]).filter((x): x is string => typeof x === "string") : [];
        return imgs[0] ?? null;
      }),
    );
    const products = productRows.map((p, idx) => ({ ...p, image: productImgs[idx] ?? null }));

    return {
      business: biz,
      services: servicesSigned,
      boats,
      charters: chartersRes.data ?? [],
      products,
      slips: slipsRes.data ?? [],
      posts: postsRes.data ?? [],
      reviews: reviews.map((r) => ({
        ...r,
        angler: anglerMap[r.angler_id ?? ""] ?? null,
      })),
      ratingSummary: { average: avg, count: ratings.length, buckets },
    };
  });


export const getBusinessBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: biz, error } = await sb
      .from("businesses")
      .select(
        "id,slug,name,category_key,tagline,description,hero_url,logo_url,website,phone,email,address,city,region,country,lat,lng,hours_json,amenities_json,gallery_json,social_json,policies_json,highlights_json,faq_json,year_founded,verified_at,premium_until",
      )
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!biz) throw new Response("Not found", { status: 404 });
    return biz;
  });

/**
 * Public availability for one published listing — anonymous anglers can see
 * released days, seats left and instant-book eligibility before signing in.
 */
export const getPublicServiceAvailability = createServerFn({ method: "GET" })
  .inputValidator((input: { serviceId: string }) =>
    z.object({ serviceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: svc, error: svcErr } = await sb
      .from("bookable_services")
      .select("id,capacity,base_price_cents,instant_book,accept_window_hours,duration_minutes")
      .eq("id", data.serviceId)
      .eq("is_published", true)
      .maybeSingle();
    if (svcErr) throw new Response(svcErr.message, { status: 500 });
    if (!svc) throw new Response("Listing not found", { status: 404 });

    // Time-block aware: the RPC drops any departure that overlaps a window the
    // operator is already booked out for (their boat/crew can only run one trip
    // at a time), so anglers never see a slot that clashes with a live trip.
    const { data: rows, error } = await sb.rpc("public_service_slots", {
      _service_id: data.serviceId,
    });
    if (error) throw new Response(error.message, { status: 500 });

    const slots = (rows ?? []).map((s: any) => ({
      id: s.id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      seatsLeft: Math.max((s.seats_available ?? 0) - (s.seats_booked ?? 0), 0),
      seatsTotal: s.seats_available ?? 0,
      priceCents: s.price_cents ?? svc.base_price_cents ?? 0,
    }));

    return {
      serviceId: svc.id,
      instantBook: svc.instant_book !== false,
      acceptWindowHours: svc.accept_window_hours ?? 24,
      durationMinutes: svc.duration_minutes,
      capacity: svc.capacity ?? 0,
      slots,
    };
  });
