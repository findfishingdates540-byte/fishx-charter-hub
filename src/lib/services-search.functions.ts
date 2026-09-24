/**
 * Cross-vertical listing search (guided trips, slips, lodging, workshops, rentals).
 * Results are ordered by the ranking engine (`rank_listings`) when the caller
 * asks for the recommended sort, otherwise by price / recency.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const SERVICE_KINDS = [
  { key: "guided_trip", label: "Guided trips" },
  { key: "slip_rental", label: "Marina slips" },
  { key: "lodging", label: "Lodging" },
  { key: "workshop", label: "Workshops" },
  { key: "rental", label: "Rentals" },
  { key: "charter_trip", label: "Charters" },
] as const;

export type ServiceResult = {
  id: string;
  title: string;
  kind: string;
  heroUrl: string | null;
  description: string | null;
  durationMinutes: number | null;
  capacity: number | null;
  basePriceCents: number;
  departureLocation: string | null;
  score: number | null;
  business: { id: string; slug: string; name: string; city: string | null; region: string | null } | null;
};

const Input = z.object({
  kind: z.string().optional(),
  city: z.string().optional(),
  q: z.string().optional(),
  maxPrice: z.number().int().positive().optional(),
  sort: z.enum(["recommended", "price_asc", "price_desc", "newest"]).optional(),
});

export const searchServices = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => Input.parse(i ?? {}))
  .handler(async ({ data }): Promise<ServiceResult[]> => {
    const sb = publicClient();
    let query = sb
      .from("bookable_services")
      .select(
        "id,title,kind,hero_url,description,duration_minutes,capacity,base_price_cents,departure_location,created_at,business:businesses!inner(id,slug,name,city,region,is_published)",
      )
      .eq("is_published", true)
      .eq("businesses.is_published", true)
      .limit(200);

    if (data.kind) query = query.eq("kind", data.kind as never);
    if (data.city) query = query.ilike("businesses.city", `%${data.city}%`);
    if (data.q) query = query.ilike("title", `%${data.q}%`);
    if (data.maxPrice) query = query.lte("base_price_cents", data.maxPrice);

    const { data: rows, error } = await query;
    if (error) {
      console.error("searchServices failed", error.message);
      return [];
    }

    // Ranked ordering comes from the scoring RPC; fall back to recency.
    let scores = new Map<string, number>();
    if ((data.sort ?? "recommended") === "recommended") {
      const { data: ranked } = await sb.rpc("rank_listings", {
        _city: data.city ?? undefined,
        _kinds: data.kind ? [data.kind] : undefined,
        _limit: 100,
      });
      const rankedRows = Array.isArray(ranked) ? ranked : [];
      scores = new Map(rankedRows.map((r) => [r.service_id, Number(r.score)]));
    }

    const list: ServiceResult[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      heroUrl: r.hero_url,
      description: r.description,
      durationMinutes: r.duration_minutes,
      capacity: r.capacity,
      basePriceCents: r.base_price_cents ?? 0,
      departureLocation: r.departure_location,
      score: scores.get(r.id) ?? null,
      business: r.business
        ? {
            id: r.business.id,
            slug: r.business.slug,
            name: r.business.name,
            city: r.business.city,
            region: r.business.region,
          }
        : null,
      created_at: r.created_at,
    })) as never;

    const sort = data.sort ?? "recommended";
    list.sort((a, b) => {
      if (sort === "price_asc") return a.basePriceCents - b.basePriceCents;
      if (sort === "price_desc") return b.basePriceCents - a.basePriceCents;
      if (sort === "newest") return 0;
      return (b.score ?? -1) - (a.score ?? -1);
    });
    return list;
  });
