/**
 * Generic bookable-listing CRUD for any business vertical (guide services,
 * marina experiences, lodging, workshops, rentals). Scoped to a business the
 * caller belongs to; RLS re-checks on every write.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type ServiceKind = Database["public"]["Enums"]["service_kind"];

async function assertManager(supabase: any, userId: string, businessId: string) {
  const { data, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!data || !["owner", "manager"].includes(data.role))
    throw new Response("You don't have permission to manage listings", { status: 403 });
}

export const listBusinessServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) => z.object({ businessId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("bookable_services")
      .select(
        "id,title,kind,description,hero_url,base_price_cents,deposit_cents,capacity,duration_minutes,departure_location,target_species,includes,is_published,instant_book,created_at",
      )
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

const serviceInput = z.object({
  businessId: z.string().uuid(),
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(120),
  kind: z.enum([
    "charter_trip",
    "guided_trip",
    "slip_rental",
    "lodging",
    "workshop",
    "rental",
    "other",
  ]),
  description: z.string().max(6000).optional().nullable(),
  hero_url: z.string().max(2000).optional().nullable(),
  base_price_cents: z.number().int().min(0),
  deposit_cents: z.number().int().min(0).default(0),
  capacity: z.number().int().min(1).max(500).default(4),
  duration_minutes: z.number().int().min(0).max(24 * 60).optional().nullable(),
  departure_location: z.string().max(200).optional().nullable(),
  target_species: z.array(z.string()).default([]),
  includes: z.array(z.string()).default([]),
  instant_book: z.boolean().default(false),
  is_published: z.boolean().default(false),
});

export const upsertBusinessService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => serviceInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.businessId);
    {
      const { assertCanPublish } = await import("./listing-publish-guard.server");
      await assertCanPublish(context.supabase, data.businessId, data.is_published);
    }
    const { businessId, id, ...rest } = data;
    const payload: any = { ...rest, kind: rest.kind as ServiceKind, business_id: businessId };
    const { data: row, error } = id
      ? await context.supabase
          .from("bookable_services")
          .update(payload)
          .eq("id", id)
          .eq("business_id", businessId)
          .select()
          .single()
      : await context.supabase.from("bookable_services").insert(payload).select().single();
    if (error) throw new Response(error.message, { status: 400 });
    if (row?.is_published) {
      const { ensureFutureAvailability } = await import("./availability-seed.server");
      await ensureFutureAvailability(context.supabase, row);
    }
    return row;
  });

export const setBusinessServicePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ businessId: z.string().uuid(), id: z.string().uuid(), isPublished: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.businessId);
    {
      const { assertCanPublish } = await import("./listing-publish-guard.server");
      await assertCanPublish(context.supabase, data.businessId, data.isPublished);
    }
    const { data: row, error } = await context.supabase
      .from("bookable_services")
      .update({ is_published: data.isPublished })
      .eq("id", data.id)
      .eq("business_id", data.businessId)
      .select("id,capacity,duration_minutes,base_price_cents")
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    if (data.isPublished && row) {
      const { ensureFutureAvailability } = await import("./availability-seed.server");
      await ensureFutureAvailability(context.supabase, row);
    }
    return { ok: true as const };
  });


export const deleteBusinessService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ businessId: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.businessId);
    const { error } = await context.supabase
      .from("bookable_services")
      .delete()
      .eq("id", data.id)
      .eq("business_id", data.businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });
