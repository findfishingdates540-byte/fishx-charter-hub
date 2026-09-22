/**
 * Captain-facing charter CRUD.
 * A "charter" is the marketplace listing parent (hero image, description, boat,
 * specs). Packages / departure variants are the bookable_services rows that
 * live under a charter_id (created via captain-management.functions.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function pickBusinessId(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("business_members")
    .select("role,business_id,business:businesses(category_key)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const mems = data ?? [];
  // Captains always operate their charter business, even if they own other
  // verticals (tackle shop, marina…).
  const charter = mems.find((m: any) => (m.business?.category_key ?? "charter") === "charter");
  const primary = charter ?? mems.find((m: any) => m.role === "owner") ?? mems[0];
  return primary?.business_id ?? null;
}

const boatSelect =
  "boats(name,make,model,length_ft,capacity,home_port,description,hero_image_url,image_urls)";

/** Operator forms submit empty strings for "not set"; treat those as null. */
const blank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema.nullable().optional());

const charterInput = z.object({
  id: z.string().uuid().optional(),
  slug: blank(z.string().min(2).max(80)),
  name: z.string().min(2).max(120).optional(),
  description: blank(z.string().max(4000)),
  hero_url: blank(z.string().max(2000)),
  image_urls: z.array(z.string()).optional(),
  boat_id: blank(z.string().uuid()),
  water_type: blank(z.string().max(40)),
  target_species: z.array(z.string()).optional(),
  departure_location: blank(z.string().max(200)),
  duration_minutes: z.number().int().min(30).max(1440).nullable().optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  base_price_cents: z.number().int().min(0).optional(),
  deposit_rate: z.number().min(0).max(1).optional(),
  commission_rate: z.number().min(0).max(1).optional(),
  is_published: z.boolean().optional(),
});


export const listCaptainCharters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) return [];
    const { data: rows, error } = await context.supabase
      .from("charters")
      .select(`id,slug,name,hero_url,image_urls,description,water_type,target_species,boat_id,boat:${boatSelect},is_published,base_price_cents,duration_minutes,capacity,created_at,packages:bookable_services(id,title,hero_url,base_price_cents,capacity,duration_minutes,is_published,kind)`)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const { signMediaUrls } = await import("./media-urls.server");
    // Resolve every stored media path (charter cover + gallery, boat photos,
    // package covers) to a signed URL so images render on every host.
    const list = (rows ?? []) as any[];
    const flat: (string | null)[] = [];
    for (const r of list) {
      flat.push(r.hero_url ?? null, ...((r.image_urls ?? []) as string[]));
      flat.push(r.boat?.hero_image_url ?? null, ...((r.boat?.image_urls ?? []) as string[]));
      for (const p of (r.packages ?? []) as any[]) flat.push(p.hero_url ?? null);
    }
    const signed = await signMediaUrls(flat);
    let i = 0;
    return list.map((r) => {
      const hero = signed[i++] ?? null;
      const gallery = ((r.image_urls ?? []) as string[]).map(() => signed[i++] ?? "").filter(Boolean);
      const boatHero = signed[i++] ?? null;
      const boatGallery = ((r.boat?.image_urls ?? []) as string[]).map(() => signed[i++] ?? "").filter(Boolean);
      const packages = ((r.packages ?? []) as any[]).map((p) => ({ ...p, hero_url: signed[i++] ?? null }));
      return {
        ...r,
        hero_url: hero,
        image_urls: gallery,
        boat: r.boat ? { ...r.boat, hero_image_url: boatHero, image_urls: boatGallery } : r.boat,
        packages,
      };
    });
  });

export const upsertCaptainCharter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => charterInput.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId)
      throw new Error("We couldn't find your business account — finish onboarding first.");

    const { id, ...rest } = data;
    {
      const { assertCanPublish } = await import("./listing-publish-guard.server");
      await assertCanPublish(context.supabase, businessId, data.is_published);
    }
    const { toStoredMediaPath, toStoredMediaPaths } = await import("./media-urls.server");

    // Only write the fields this request actually sent, so a small change
    // (e.g. the Live/Draft toggle) never blanks the rest of the listing.
    const payload: Record<string, any> = { business_id: businessId };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) payload[k] = v;
    }

    if ("hero_url" in payload) payload.hero_url = toStoredMediaPath(payload.hero_url);
    if ("image_urls" in payload) payload.image_urls = toStoredMediaPaths(payload.image_urls ?? []);

    if (!id) {
      if (!payload.name) throw new Error("Give the charter a name before saving.");
      if (!payload.boat_id)
        throw new Error("Pick a boat for this charter — add one in the Fleet tab first.");
      payload.capacity ??= 4;
      payload.base_price_cents ??= 0;
      payload.target_species ??= [];
      payload.image_urls ??= [];
      payload.is_published ??= false;
    }

    // Fall back to the linked boat's photos so a charter never ships imageless.
    if (payload.boat_id && (!payload.hero_url || (payload.image_urls ?? []).length === 0)) {
      const { data: boat } = await context.supabase
        .from("boats")
        .select("hero_image_url,image_urls")
        .eq("id", payload.boat_id)
        .eq("business_id", businessId)
        .maybeSingle();
      const boatGallery: string[] = Array.isArray(boat?.image_urls) ? boat!.image_urls : [];
      if (!payload.hero_url && (boat?.hero_image_url || boatGallery[0]))
        payload.hero_url = boat?.hero_image_url || boatGallery[0];
      if ((payload.image_urls ?? []).length === 0 && boatGallery.length)
        payload.image_urls = boatGallery;
    }

    const q = context.supabase.from("charters");
    const { data: row, error } = id
      ? await q.update(payload as any).eq("id", id).eq("business_id", businessId).select().maybeSingle()
      : await q.insert(payload as any).select().single();
    if (error) throw new Error(error.message);
    if (id && !row)
      throw new Error("That charter couldn't be updated — you may not have permission to edit it.");


    // If the charter was just published, seed default availability from its packages'
    // departure times via the pattern-aware generator.
    if (row?.is_published) {
      try {
        const { ensureFutureAvailability } = await import("./availability-seed.server");
        // Load packages for this charter
        const { data: packages } = await context.supabase
          .from("bookable_services")
          .select("id,duration_minutes,base_price_cents,capacity")
          .eq("charter_id", row.id)
          .limit(20);
        // Load departure patterns for this charter
        const { data: patterns } = await context.supabase
          .from("charter_departure_times")
          .select("label,start_time,days_of_week,is_active,sort_order")
          .eq("charter_id", row.id)
          .eq("is_active", true);
        for (const pkg of packages ?? []) {
          await ensureFutureAvailability(context.supabase, pkg, 90, (patterns ?? []).map((p: any) => ({
            label: p.label,
            start_time: p.start_time,
            days_of_week: p.days_of_week,
            is_active: p.is_active,
            sort_order: p.sort_order,
          })));
        }
      } catch (e) {
        // Don't block the charter save on seeding; log and continue
        console.warn("Availability seeding deferred:", e);
      }
    }
    return row;
  });

/**
 * Charter departure-time CRUD — mirrors the old service_departure_times pattern
 * but scoped to a charter_id so every package under the charter shares the
 * recurring weekly departure templates.
 */
const departureInput = z.object({
  id: z.string().uuid().optional(),
  charterId: z.string().uuid(),
  businessId: z.string().uuid(),
  label: z.string().max(60).optional().nullable(),
  start_time: z.string().min(4).max(8),
  days_of_week: z.array(z.number().int().min(0).max(6)).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export const listCharterDepartureTimes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ charterId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("charter_departure_times")
      .select("id,charter_id,business_id,label,start_time,days_of_week,is_active,sort_order,created_at")
      .eq("charter_id", data.charterId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCharterDepartureTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    charterId: z.string().uuid(),
    businessId: z.string().uuid(),
    rows: z.array(departureInput),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { charterId, businessId, rows } = data;
    // Verify the charter belongs to this business
    const { data: charter } = await context.supabase
      .from("charters")
      .select("id")
      .eq("id", charterId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!charter) throw new Error("Charter not found or not in your business");

    // Full-replace: delete existing rows for this charter+business, re-insert
    const { error: delErr } = await context.supabase
      .from("charter_departure_times")
      .delete()
      .eq("charter_id", charterId)
      .eq("business_id", businessId);
    if (delErr) throw new Error(delErr.message);

    const toInsert = rows.map((r, i) => ({
      charter_id: charterId,
      business_id: businessId,
      label: r.label ?? null,
      start_time: r.start_time,
      days_of_week: r.days_of_week,
      is_active: r.is_active,
      sort_order: r.sort_order ?? i,
    }));
    if (toInsert.length) {
      const { error: insErr } = await context.supabase
        .from("charter_departure_times")
        .insert(toInsert);
      if (insErr) throw new Error(insErr.message);
    }

    // Re-seed availability for all packages under this charter so the slots
    // reflect the updated departure template.
    const { data: packages } = await context.supabase
      .from("bookable_services")
      .select("id,duration_minutes,base_price_cents,capacity,is_published")
      .eq("charter_id", charterId);
    const { ensureFutureAvailability } = await import("./availability-seed.server");
    const active = toInsert.filter((r) => r.is_active && r.days_of_week.length > 0);
    const patterns = toInsert.map((r) => ({
      label: r.label,
      start_time: r.start_time,
      days_of_week: r.days_of_week,
      is_active: r.is_active,
      sort_order: r.sort_order,
    }));
    for (const pkg of packages ?? []) {
      if (!pkg.is_published) continue;
      await ensureFutureAvailability(context.supabase, {
        id: pkg.id,
        capacity: pkg.capacity,
        duration_minutes: pkg.duration_minutes,
        base_price_cents: pkg.base_price_cents,
      }, 90, patterns);
    }

    return { ok: true, count: toInsert.length, hasActive: active.length > 0 };
  });

export const deleteCaptainCharter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Error("No business found");
    const { error } = await context.supabase
      .from("charters")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
