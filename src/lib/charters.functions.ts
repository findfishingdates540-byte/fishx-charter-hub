/**
 * Public charter discovery: destinations (state / port) + filtered search.
 * Uses a publishable-key server client so anon SELECT policies apply.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    // Opaque sb_ publishable keys aren't JWTs: send them only as `apikey`.
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}


const CHARTER_KINDS = ["charter_trip", "guided_trip"] as const;

const LISTING_COLS =
  "id,slug,title,hero_url,description,duration_minutes,capacity,base_price_cents,target_species,departure_location,created_at,charter_id,business:businesses!inner(id,slug,name,city,region,country,verified_at,is_published)";

type Listing = {
  id: string;
  slug: string | null;
  title: string;
  hero_url: string | null;
  description: string | null;
  duration_minutes: number | null;
  capacity: number | null;
  base_price_cents: number;
  target_species: string[] | null;
  departure_location: string | null;
  charter_id: string | null;
  created_at: string;
  business: {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    region: string | null;
    country: string | null;
    verified_at: string | null;
  } | null;
};

async function loadCharters(sb: ReturnType<typeof publicClient>) {
  const { data, error } = await sb
    .from("bookable_services")
    .select(LISTING_COLS)
    .eq("is_published", true)
    .eq("businesses.is_published", true)
    .in("kind", [...CHARTER_KINDS])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("loadCharters failed", error.message);
    return [] as Listing[];
  }

  return (data ?? []) as unknown as Listing[];
}

/** Landing data: ports grouped by state/region, species list, featured charters. */
export const getCharterDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const listings = await loadCharters(sb);

  const ports = new Map<
    string,
    { city: string; region: string | null; count: number; captains: Set<string>; fromCents: number }
  >();
  const regions = new Map<string, { region: string; count: number; ports: Set<string> }>();
  const species = new Map<string, number>();

  for (const l of listings) {
    const city = l.business?.city ?? l.departure_location ?? null;
    const region = l.business?.region ?? null;
    if (city) {
      const key = `${city}|${region ?? ""}`;
      const cur =
        ports.get(key) ?? { city, region, count: 0, captains: new Set<string>(), fromCents: Infinity };
      cur.count += 1;
      if (l.business?.id) cur.captains.add(l.business.id);
      cur.fromCents = Math.min(cur.fromCents, l.base_price_cents || Infinity);
      ports.set(key, cur);
    }
    if (region) {
      const cur = regions.get(region) ?? { region, count: 0, ports: new Set<string>() };
      cur.count += 1;
      if (city) cur.ports.add(city);
      regions.set(region, cur);
    }
    for (const s of l.target_species ?? []) {
      if (s) species.set(s, (species.get(s) ?? 0) + 1);
    }
  }

  return {
    total: listings.length,
    ports: [...ports.values()]
      .map((p) => ({
        city: p.city,
        region: p.region,
        count: p.count,
        captains: p.captains.size,
        fromCents: Number.isFinite(p.fromCents) ? p.fromCents : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    regions: [...regions.values()]
      .map((r) => ({ region: r.region, count: r.count, ports: r.ports.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    species: [...species.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14),
    featured: listings.slice(0, 6),
  };
});

/** Charter detail: one charter parent + its published packages. */
export const getCharterPackages = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ charterId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: charter, error } = await sb
      .from("charters")
      .select(
        `id,slug,name,description,hero_url,image_urls,water_type,target_species,
         departure_location,duration_minutes,capacity,base_price_cents,
         boat:boats(name,make,model,length_ft,capacity,home_port),
         business:businesses!inner(id,slug,name,city,region,country,verified_at)`,
      )
      .eq("id", data.charterId)
      .eq("is_published", true)
      .eq("businesses.is_published", true)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!charter) throw new Response("Charter not found", { status: 404 });

    const { data: packages, error: pkgErr } = await sb
      .from("bookable_services")
      .select(
        "id,slug,title,hero_url,base_price_cents,capacity,duration_minutes,target_species,is_published",
      )
      .eq("charter_id", data.charterId)
      .eq("is_published", true)
      .in("kind", [...CHARTER_KINDS])
      .order("base_price_cents", { ascending: true })
      .limit(20);
    if (pkgErr) throw new Response(pkgErr.message, { status: 500 });

    return { charter, packages: packages ?? [] };
  });

const filterSchema = z.object({
  city: z.string().optional(),
  region: z.string().optional(),
  q: z.string().optional(),
  species: z.string().optional(),
  date: z.string().optional(),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  duration: z.enum(["half", "threequarter", "full", "any"]).optional(),
  sort: z.enum(["recommended", "price_asc", "price_desc", "duration_asc", "newest"]).optional(),
});

export const searchCharters = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const sb = publicClient();
    let listings = await loadCharters(sb);

    if (data.city) listings = listings.filter((l) => (l.business?.city ?? "") === data.city);
    if (data.region) listings = listings.filter((l) => (l.business?.region ?? "") === data.region);
    if (data.species) {
      const s = data.species.toLowerCase();
      listings = listings.filter((l) => (l.target_species ?? []).some((x) => x.toLowerCase() === s));
    }
    if (data.guests) listings = listings.filter((l) => (l.capacity ?? 0) >= data.guests!);
    if (data.duration && data.duration !== "any") {
      listings = listings.filter((l) => {
        const h = (l.duration_minutes ?? 0) / 60;
        if (data.duration === "half") return h > 0 && h <= 5;
        if (data.duration === "threequarter") return h > 5 && h <= 7;
        return h > 7;
      });
    }
    if (data.q) {
      const q = data.q.toLowerCase();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.business?.name ?? "").toLowerCase().includes(q) ||
          (l.business?.city ?? "").toLowerCase().includes(q) ||
          (l.business?.region ?? "").toLowerCase().includes(q),
      );
    }

    // Date filter — only keep listings with an open, non-blacked-out departure.
    if (data.date) {
      const start = new Date(`${data.date}T00:00:00.000Z`).toISOString();
      const end = new Date(`${data.date}T23:59:59.999Z`).toISOString();
      const { data: slots } = await sb
        .from("service_availability")
        .select("service_id,seats_available,seats_booked,is_blackout,starts_at")
        .in("service_id", listings.map((l) => l.id))
        .gte("starts_at", start)
        .lte("starts_at", end);
      const open = new Set(
        (slots ?? [])
          .filter(
            (s) =>
              !s.is_blackout &&
              (s.seats_available ?? 0) - (s.seats_booked ?? 0) >= (data.guests ?? 1),
          )
          .map((s) => s.service_id),
      );
      listings = listings.filter((l) => open.has(l.id));
    }

    // Ratings per business for display + recommended sort.
    const { data: reviews } = await sb.from("reviews").select("business_id,rating");
    const agg = new Map<string, { sum: number; count: number }>();
    for (const r of reviews ?? []) {
      const cur = agg.get(r.business_id) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      agg.set(r.business_id, cur);
    }
    const ratings: Record<string, { avg: number; count: number }> = {};
    for (const [id, v] of agg) ratings[id] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };

    const score = (l: Listing) => {
      const r = ratings[l.business?.id ?? ""];
      return (r?.avg ?? 0) * 2 + Math.min(r?.count ?? 0, 10) / 10 + (l.business?.verified_at ? 1.5 : 0);
    };

    const sort = data.sort ?? "recommended";
    listings = [...listings].sort((a, b) => {
      if (sort === "price_asc") return a.base_price_cents - b.base_price_cents;
      if (sort === "price_desc") return b.base_price_cents - a.base_price_cents;
      if (sort === "duration_asc") return (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0);
      if (sort === "newest") return b.created_at.localeCompare(a.created_at);
      return score(b) - score(a);
    });

    const speciesFacets = new Map<string, number>();
    for (const l of listings) for (const s of l.target_species ?? []) speciesFacets.set(s, (speciesFacets.get(s) ?? 0) + 1);

    return {
      listings: listings.slice(0, 60),
      count: listings.length,
      ratings,
      speciesFacets: [...speciesFacets.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    };
  });
