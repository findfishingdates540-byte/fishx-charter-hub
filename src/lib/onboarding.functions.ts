/**
 * Operator onboarding server functions.
 * - getOnboardingState: returns the caller's primary business + verification + first service (if any).
 * - upsertBusinessProfile: creates or updates the caller's business (owner membership auto-created).
 * - uploadVerificationDoc: returns a signed upload URL to the private verification-docs bucket.
 * - submitVerification: records a verification_requests row referencing uploaded docs.
 * - savePayoutPreference: stores payout schedule in businesses (best-effort; keeps stripe wiring for later).
 * - publishListing: creates the first bookable_service and marks the business is_published.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type ServiceKind = Database["public"]["Enums"]["service_kind"];

async function pickBusinessId(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("business_members")
    .select("role,business_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Response(error.message, { status: 500 });
  const primary = (data ?? []).find((m: any) => m.role === "owner") ?? data?.[0];
  return primary?.business_id ?? null;
}

const slugRe = /^[a-z0-9](?:[a-z0-9-]{1,60}[a-z0-9])?$/;

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `biz-${Math.random().toString(36).slice(2, 8)}`;
}

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    const catBaseRes = await context.supabase
      .from("business_categories")
      .select("key,label,sort_order")
      .order("sort_order");
    if (!businessId) {
      return { business: null, verification: null, service: null, categories: catBaseRes.data ?? [] };
    }
    const [bizRes, verRes, svcRes, prodRes, catRes] = await Promise.all([
      context.supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      context.supabase
        .from("verification_requests")
        .select("id,status,doc_urls,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("bookable_services")
        .select("id,title,kind,duration_minutes,capacity,base_price_cents,hero_url,is_published,includes")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("inventory_products")
        .select("id,title,price_cents,stock_qty,is_published,metadata,category")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      context.supabase.from("business_categories").select("key,label,sort_order").order("sort_order"),
    ]);
    if (bizRes.error) throw new Response(bizRes.error.message, { status: 500 });
    const isRetail = RETAIL_CATEGORIES.has((bizRes.data as any)?.category_key);
    const service = isRetail && prodRes.data
      ? {
          id: prodRes.data.id,
          title: prodRes.data.title,
          kind: "other",
          duration_minutes: 0,
          capacity: prodRes.data.stock_qty,
          base_price_cents: prodRes.data.price_cents,
          hero_url: null,
          is_published: prodRes.data.is_published,
          includes: ((prodRes.data.metadata as any)?.tags as string[] | undefined) ?? [],
        }
      : svcRes.data ?? null;
    return {
      business: bizRes.data,
      verification: verRes.data ?? null,
      service,
      categories: catRes.data ?? [],
    };
  });

const profileInput = z.object({
  name: z.string().min(2).max(80),
  categoryKey: z.string().min(2),
  city: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
});

export const upsertBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => profileInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existingId = await pickBusinessId(supabase, userId);

    const payload: any = {
      name: data.name,
      category_key: data.categoryKey,
      city: data.city ?? null,
      phone: data.phone ?? null,
      description: data.description ?? null,
    };

    if (existingId) {
      const { data: row, error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single();
      if (error) throw new Response(error.message, { status: 400 });
      return row;
    }

    // create with unique slug
    let slug = slugify(data.name);
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from("businesses").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 5)}`;
    }
    if (!slugRe.test(slug)) slug = `biz-${Math.random().toString(36).slice(2, 8)}`;

    const { data: business, error: bizErr } = await supabase.rpc("create_business_with_owner", {
      _name: data.name,
      _slug: slug,
      _category_key: data.categoryKey,
      _city: data.city ?? undefined,
      _phone: data.phone ?? undefined,
      _description: data.description ?? undefined,
    });
    if (bizErr) throw new Response(bizErr.message, { status: 400 });

    return business;
  });

export const createVerificationUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { docKey: string; filename: string }) =>
    z.object({ docKey: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/), filename: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("Create your business profile first", { status: 400 });
    const ext = data.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${businessId}/${data.docKey}-${Date.now()}.${ext}`;
    const { data: signed, error } = await context.supabase.storage
      .from("verification-docs")
      .createSignedUploadUrl(path);
    if (error) throw new Response(error.message, { status: 500 });
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { docPaths: string[] }) =>
    z.object({ docPaths: z.array(z.string().min(3)).min(1).max(10) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("No business", { status: 400 });
    const { data: row, error } = await context.supabase
      .from("verification_requests")
      .insert({
        business_id: businessId,
        submitted_by: context.userId,
        doc_urls: data.docPaths,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });

    // Route the submission to the admin review queue (best effort — a
    // notification failure must never block the operator's setup).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendDirectNotification } = await import("./notifications.server");
      const [{ data: biz }, { data: admins }, { data: team }] = await Promise.all([
        supabaseAdmin.from("businesses").select("name").eq("id", businessId).maybeSingle(),
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
        supabaseAdmin.from("business_members").select("user_id").eq("business_id", businessId),
      ]);
      await Promise.all([
        ...(admins ?? []).map((a: { user_id: string }) =>
          sendDirectNotification(supabaseAdmin, {
            userId: a.user_id,
            category: "verification",
            title: "New operator documents to review",
            body: `${biz?.name ?? "An operator"} submitted ${data.docPaths.length} document(s) for verification.`,
            link: "/admin",
            severity: "info",
            meta: { businessId, requestId: row.id },
          }),
        ),
        // Confirm receipt to the operator so they know review is under way and
        // that they can carry on with the rest of their setup meanwhile.
        ...(team ?? []).map((m: { user_id: string }) =>
          sendDirectNotification(supabaseAdmin, {
            userId: m.user_id,
            category: "verification",
            title: "We received your documents",
            body: `Thanks — ${data.docPaths.length} document(s) for ${biz?.name ?? "your business"} are with our team. You can keep setting up and taking payments while we review.`,
            link: "/onboarding",
            severity: "info",
            meta: { businessId, requestId: row.id },
          }),
        ),
      ]);
    } catch (e) {
      console.error("verification admin notification failed", e);
    }

    return row;
  });

export const savePayoutPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { schedule: "weekly" | "each" | "monthly"; stripeConnected?: boolean }) =>
    z.object({ schedule: z.enum(["weekly", "each", "monthly"]), stripeConnected: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("No business", { status: 400 });
    // Store on businesses.hours_json.payout_schedule as a lightweight preference until real Stripe Connect wiring.
    const { data: biz } = await context.supabase
      .from("businesses")
      .select("hours_json")
      .eq("id", businessId)
      .single();
    const hours = (biz?.hours_json as Record<string, any>) ?? {};
    hours.payout_schedule = data.schedule;
    if (typeof data.stripeConnected === "boolean") hours.stripe_connected = data.stripeConnected;
    const { error } = await context.supabase
      .from("businesses")
      .update({ hours_json: hours })
      .eq("id", businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

const publishInput = z.object({
  title: z.string().min(3).max(120),
  kind: z.enum(["charter_trip", "guided_trip", "slip_rental", "lodging", "workshop", "rental", "other"]),
  durationMinutes: z.number().int().min(0).max(24 * 60),
  capacity: z.number().int().min(1).max(9999),
  basePriceCents: z.number().int().min(0),
  includes: z.array(z.string()).default([]),
});


const RETAIL_CATEGORIES = new Set(["tackle_shop", "bait_shop", "gear_mfg", "apparel"]);

export const publishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => publishInput.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await pickBusinessId(context.supabase, context.userId);
    if (!businessId) throw new Response("Create your business first", { status: 400 });

    const { data: biz, error: bizErr } = await context.supabase
      .from("businesses")
      .select("id, category_key")
      .eq("id", businessId)
      .single();
    if (bizErr) throw new Response(bizErr.message, { status: 400 });

    const isRetail = RETAIL_CATEGORIES.has(biz.category_key);
    let resultRow: any;

    if (isRetail) {
      // Retail verticals publish an inventory product, not a bookable service.
      // `capacity` acts as stock on hand and `includes` are product tags.
      const productPayload = {
        business_id: businessId,
        title: data.title,
        price_cents: data.basePriceCents,
        stock_qty: data.capacity,
        category: data.includes[0] ?? null,
        metadata: { tags: data.includes },
        is_published: true,
      };

      const { data: existing } = await context.supabase
        .from("inventory_products")
        .select("id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const prod = existing?.id
        ? await context.supabase
            .from("inventory_products")
            .update(productPayload)
            .eq("id", existing.id)
            .select()
            .single()
        : await context.supabase
            .from("inventory_products")
            .insert(productPayload)
            .select()
            .single();
      if (prod.error) throw new Response(prod.error.message, { status: 400 });
      resultRow = prod.data;
    } else {
      const { data: existing } = await context.supabase
        .from("bookable_services")
        .select("id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const payload = {
        business_id: businessId,
        title: data.title,
        kind: data.kind as ServiceKind,
        duration_minutes: data.durationMinutes,
        capacity: data.capacity,
        base_price_cents: data.basePriceCents,
        includes: data.includes,
        is_published: true,
      };

      const svc = existing?.id
        ? await context.supabase.from("bookable_services").update(payload).eq("id", existing.id).select().single()
        : await context.supabase.from("bookable_services").insert(payload).select().single();
      if (svc.error) throw new Response(svc.error.message, { status: 400 });
      resultRow = svc.data;
      const { ensureFutureAvailability } = await import("./availability-seed.server");
      await ensureFutureAvailability(context.supabase, svc.data);
    }


    const { error: bErr } = await context.supabase
      .from("businesses")
      .update({ is_published: true, onboarding_completed_at: new Date().toISOString() })
      .eq("id", businessId);
    if (bErr) throw new Response(bErr.message, { status: 400 });

    return { service: resultRow, businessId };
  });
