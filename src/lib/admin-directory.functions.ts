/**
 * Platform admin: operator directory, member directory, listing moderation and
 * the marketplace booking ledger.
 *
 * Every function proves the caller holds the `admin` role through their own
 * RLS-scoped client BEFORE the service-role client is loaded.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access only");
}

async function logAction(
  admin: any,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta_json: meta,
  });
}

const OPERATOR_ROLES = [
  "captain",
  "marina",
  "lodge",
  "tackle_shop",
  "bait_shop",
  "gear_mfg",
  "apparel",
  "guide_service",
  "business_owner",
];

/**
 * Every operator business on the platform with its signup date, onboarding
 * progress, document status and live listing count.
 */
export const getOperatorDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [bizRes, memRes, verRes, svcRes, prodRes, bookRes] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select(
          "id,name,slug,category_key,city,region,country,phone,email,is_published,verified_at,onboarding_completed_at,charges_enabled,payouts_enabled,created_at,created_by",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("business_members").select("business_id,user_id,role").limit(5000),
      supabaseAdmin
        .from("verification_requests")
        .select("id,business_id,status,doc_urls,created_at,decided_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("bookable_services").select("id,business_id,is_published").limit(5000),
      supabaseAdmin.from("inventory_products").select("id,business_id,is_published").limit(5000),
      supabaseAdmin.from("bookings").select("id,business_id,status,total_cents").limit(5000),
    ]);

    const ownerIds = Array.from(
      new Set((bizRes.data ?? []).map((b) => b.created_by).filter(Boolean)),
    ) as string[];
    const profRes = ownerIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id,full_name,display_name,phone")
          .in("id", ownerIds)
      : { data: [] as any[] };
    const profileById = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));

    const count = (rows: any[] | null, key: string, id: string, pred?: (r: any) => boolean) =>
      (rows ?? []).filter((r) => r[key] === id && (!pred || pred(r))).length;

    const latestVerification = (businessId: string) =>
      (verRes.data ?? []).find((v) => v.business_id === businessId) ?? null;

    const operators = (bizRes.data ?? []).map((b) => {
      const ver = latestVerification(b.id);
      const listings =
        count(svcRes.data, "business_id", b.id) + count(prodRes.data, "business_id", b.id);
      const liveListings =
        count(svcRes.data, "business_id", b.id, (r) => r.is_published) +
        count(prodRes.data, "business_id", b.id, (r) => r.is_published);
      const bookings = (bookRes.data ?? []).filter((r) => r.business_id === b.id);
      return {
        ...b,
        owner: profileById.get(b.created_by) ?? null,
        teamSize: count(memRes.data, "business_id", b.id),
        verification: ver,
        docCount: ver?.doc_urls?.length ?? 0,
        docStatus: ver ? ver.status : "not_submitted",
        listings,
        liveListings,
        bookingCount: bookings.length,
        grossCents: bookings.reduce((s, r) => s + (r.total_cents ?? 0), 0),
      };
    });

    return {
      operators,
      totals: {
        operators: operators.length,
        awaitingDocs: operators.filter((o) => o.docStatus === "not_submitted").length,
        pendingReview: operators.filter((o) => o.docStatus === "pending").length,
        verified: operators.filter((o) => Boolean(o.verified_at)).length,
        live: operators.filter((o) => o.is_published).length,
        onboardingIncomplete: operators.filter((o) => !o.onboarding_completed_at).length,
      },
    };
  });

/** Every member account with their roles, so staff can search and adjust access. */
export const getMemberDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ search: z.string().max(120).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("profiles")
      .select("id,full_name,display_name,avatar_url,phone,home_port,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const term = data.search?.trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,display_name.ilike.%${term}%`);

    const [profRes, roleRes, memRes] = await Promise.all([
      q,
      supabaseAdmin.from("user_roles").select("user_id,role").limit(5000),
      supabaseAdmin.from("business_members").select("user_id,business_id,role").limit(5000),
    ]);
    if (profRes.error) throw new Error(profRes.error.message);

    const rolesFor = (id: string) =>
      (roleRes.data ?? []).filter((r) => r.user_id === id).map((r) => r.role as string);

    const members = (profRes.data ?? []).map((p: any) => {
      const roles = rolesFor(p.id);
      return {
        ...p,
        roles,
        businessCount: (memRes.data ?? []).filter((m) => m.user_id === p.id).length,
        kind: roles.includes("admin")
          ? "staff"
          : roles.some((r) => OPERATOR_ROLES.includes(r))
            ? "operator"
            : "angler",
      };
    });

    return {
      members,
      totals: {
        all: members.length,
        anglers: members.filter((m) => m.kind === "angler").length,
        operators: members.filter((m) => m.kind === "operator").length,
        staff: members.filter((m) => m.kind === "staff").length,
      },
    };
  });

const ROLE_ENUM = z.enum([
  "admin",
  "angler",
  "captain",
  "business_owner",
  "business_staff",
  "marina",
  "tackle_shop",
  "bait_shop",
  "gear_mfg",
  "apparel",
  "guide_service",
  "lodge",
]);

/** Grant or revoke a platform role for a member. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), role: ROLE_ENUM, grant: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot remove your own admin access");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role as any }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role as any);
      if (error) throw new Error(error.message);
    }

    await logAction(
      supabaseAdmin,
      context.userId,
      data.grant ? "role.granted" : "role.revoked",
      "user",
      data.userId,
      { role: data.role },
    );
    return { ok: true };
  });

/** Trips and products across the marketplace, for content review. */
export const getListingModeration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [svcRes, prodRes, bizRes] = await Promise.all([
      supabaseAdmin
        .from("bookable_services")
        .select("id,business_id,title,kind,base_price_cents,is_published,created_at")
        .order("created_at", { ascending: false })
        .limit(400),
      supabaseAdmin
        .from("inventory_products")
        .select("id,business_id,title,price_cents,is_published,created_at")
        .order("created_at", { ascending: false })
        .limit(400),
      supabaseAdmin.from("businesses").select("id,name,slug,category_key").limit(1000),
    ]);
    const bizById = new Map((bizRes.data ?? []).map((b) => [b.id, b]));

    const listings = [
      ...(svcRes.data ?? []).map((s: any) => ({
        id: s.id,
        type: "service" as const,
        title: s.title,
        subtitle: String(s.kind ?? "").replace(/_/g, " "),
        priceCents: s.base_price_cents ?? 0,
        isPublished: s.is_published,
        createdAt: s.created_at,
        business: bizById.get(s.business_id) ?? null,
      })),
      ...(prodRes.data ?? []).map((p: any) => ({
        id: p.id,
        type: "product" as const,
        title: p.title,
        subtitle: "gear",
        priceCents: p.price_cents ?? 0,
        isPublished: p.is_published,
        createdAt: p.created_at,
        business: bizById.get(p.business_id) ?? null,
      })),
    ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return {
      listings,
      totals: {
        all: listings.length,
        live: listings.filter((l) => l.isPublished).length,
        hidden: listings.filter((l) => !l.isPublished).length,
      },
    };
  });

/** Hide or restore a listing across the marketplace. */
export const setListingPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(["service", "product"]),
        published: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.type === "service" ? "bookable_services" : "inventory_products";
    const { error } = await supabaseAdmin
      .from(table)
      .update({ is_published: data.published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(
      supabaseAdmin,
      context.userId,
      data.published ? "listing.published" : "listing.hidden",
      data.type,
      data.id,
    );
    return { ok: true };
  });

/** The whole marketplace booking ledger, newest first. */
export const getBookingLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [bookRes, bizRes] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select(
          "id,business_id,angler_id,status,total_cents,deposit_cents,refunded_cents,trip_date,start_time,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin.from("businesses").select("id,name,category_key").limit(1000),
    ]);
    const bizById = new Map((bizRes.data ?? []).map((b) => [b.id, b]));

    const anglerIds = Array.from(
      new Set((bookRes.data ?? []).map((b) => b.angler_id).filter(Boolean)),
    ) as string[];
    const profRes = anglerIds.length
      ? await supabaseAdmin.from("profiles").select("id,full_name,display_name").in("id", anglerIds)
      : { data: [] as any[] };
    const profileById = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));

    const rows = (bookRes.data ?? []).map((b: any) => ({
      ...b,
      business: bizById.get(b.business_id) ?? null,
      angler: profileById.get(b.angler_id) ?? null,
    }));

    const live = rows.filter((r) => !String(r.status).startsWith("cancelled"));
    return {
      rows,
      totals: {
        bookings: rows.length,
        grossCents: live.reduce((s, r) => s + (r.total_cents ?? 0), 0),
        depositCents: live.reduce((s, r) => s + (r.deposit_cents ?? 0), 0),
        cancelled: rows.length - live.length,
      },
    };
  });

/** Recent admin actions, for accountability. */
export const getAuditTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id,actor_id,action,target_type,target_id,meta_json,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
