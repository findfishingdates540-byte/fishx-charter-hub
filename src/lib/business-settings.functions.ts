/**
 * Shared operator settings server functions — used by every business vertical
 * (charter, guide, marina/lodge, tackle/bait/gear/apparel).
 *
 * All calls run as the signed-in user through requireSupabaseAuth, so RLS on
 * business_members / businesses decides what can be read or written.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(
  supabase: any,
  userId: string,
  businessId: string,
  roles: string[] = ["owner", "manager"],
) {
  const { data, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!data || !roles.includes(data.role))
    throw new Response("You don't have permission to manage this business", { status: 403 });
  return data.role as string;
}

/** Business profile + team + the caller's role, for the Settings screen. */
export const getBusinessSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) => z.object({ businessId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const myRole = await assertMember(supabase, userId, data.businessId, ["owner", "manager", "staff"]);

    const [bizRes, memRes, catRes] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", data.businessId).maybeSingle(),
      supabase
        .from("business_members")
        .select("id,user_id,role,created_at")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: true }),
      supabase.from("business_categories").select("key,label,sort_order").order("sort_order"),
    ]);
    if (bizRes.error) throw new Response(bizRes.error.message, { status: 500 });
    if (!bizRes.data) throw new Response("Business not found", { status: 404 });

    const memberIds = (memRes.data ?? []).map((m: any) => m.user_id);
    let profiles: any[] = [];
    if (memberIds.length) {
      const p = await supabase
        .from("profiles")
        .select("id,full_name,display_name,avatar_url")
        .in("id", memberIds);
      profiles = p.data ?? [];
    }
    const team = (memRes.data ?? []).map((m: any) => ({
      ...m,
      profile: profiles.find((p) => p.id === m.user_id) ?? null,
      isMe: m.user_id === userId,
    }));

    return {
      business: bizRes.data,
      team,
      myRole,
      categories: catRes.data ?? [],
      viewerId: userId,
    };
  });

const nullable = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

const profileInput = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(2).max(80),
  tagline: z.string().max(160).optional().nullable(),
  description: z.string().max(6000).optional().nullable(),
  hero_url: z.string().max(2000).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  region: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  hours: z.record(z.string(), z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  gallery: z.array(z.string().max(2000)).max(24).optional(),
  highlights: z.array(z.string().max(80)).max(12).optional(),
  year_founded: z.number().int().min(1800).max(2100).nullable().optional(),
  social: z
    .object({
      instagram: z.string().max(300).optional().nullable(),
      facebook: z.string().max(300).optional().nullable(),
      youtube: z.string().max(300).optional().nullable(),
      tiktok: z.string().max(300).optional().nullable(),
    })
    .optional(),
  policies: z
    .object({
      cancellation: z.string().max(2000).optional().nullable(),
      payment_methods: z.string().max(300).optional().nullable(),
      languages: z.string().max(200).optional().nullable(),
      rules: z.string().max(2000).optional().nullable(),
    })
    .optional(),
  faq: z
    .array(z.object({ q: z.string().max(200), a: z.string().max(1200) }))
    .max(12)
    .optional(),
});

/** Update the public-facing business profile. Owners and managers only. */
export const updateBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => profileInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.businessId);

    const patch: any = {
      name: data.name.trim(),
      tagline: nullable(data.tagline),
      description: nullable(data.description),
      hero_url: nullable(data.hero_url),
      logo_url: nullable(data.logo_url),
      website: nullable(data.website),
      phone: nullable(data.phone),
      email: nullable(data.email),
      address: nullable(data.address),
      city: nullable(data.city),
      region: nullable(data.region),
      country: nullable(data.country),
      updated_at: new Date().toISOString(),
    };
    if (data.hours) patch.hours_json = data.hours;
    if (data.amenities) patch.amenities_json = { list: data.amenities };
    if (data.gallery) patch.gallery_json = data.gallery.filter(Boolean);
    if (data.highlights) patch.highlights_json = data.highlights.filter(Boolean);
    if (data.social) patch.social_json = data.social;
    if (data.policies) patch.policies_json = data.policies;
    if (data.faq) patch.faq_json = data.faq.filter((f) => f.q.trim() && f.a.trim());
    if (data.year_founded !== undefined) patch.year_founded = data.year_founded;

    const { data: row, error } = await supabase
      .from("businesses")
      .update(patch)
      .eq("id", data.businessId)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return row;
  });

/** Publish / unpublish the storefront. */
export const setBusinessPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ businessId: z.string().uuid(), isPublished: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.businessId);
    const { error } = await context.supabase
      .from("businesses")
      .update({ is_published: data.isPublished })
      .eq("id", data.businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });

/** Add an existing Fish-X user to the team by their sign-in email. Owners only. */
export const addTeamMemberByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["owner", "manager", "staff"]).default("staff"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.businessId, ["owner"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Response(listErr.message, { status: 500 });
    const match = (list?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (!match)
      throw new Response(
        "No Fish-X account uses that email yet. Ask them to sign up first, then add them.",
        { status: 404 },
      );

    const { error } = await context.supabase
      .from("business_members")
      .upsert(
        { business_id: data.businessId, user_id: match.id, role: data.role },
        { onConflict: "business_id,user_id" },
      );
    if (error) throw new Response(error.message, { status: 400 });

    // Let the new teammate know — in-app notification plus an email.
    let notified = false;
    try {
      const { sendDirectNotification } = await import("./notifications.server");
      const { data: biz } = await supabaseAdmin
        .from("businesses")
        .select("name")
        .eq("id", data.businessId)
        .maybeSingle();
      const bizName = (biz as any)?.name ?? "a business";
      const res = await sendDirectNotification(supabaseAdmin as never, {
        userId: match.id,
        to: match.email ?? email,
        category: "account",
        title: `You've been added to ${bizName}`,
        body: `You can now manage ${bizName} on FISH-X.COM as ${data.role}. Sign in to open the dashboard.`,
        link: "/dashboard",
        severity: "info",
        meta: { business_id: data.businessId, role: data.role },
      });
      notified = Boolean((res as any)?.sent);
    } catch {
      notified = false;
    }

    return { ok: true as const, notified };
  });


/** Change a teammate's role. Owners only. */
export const updateTeamMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        memberId: z.string().uuid(),
        role: z.enum(["owner", "manager", "staff"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.businessId, ["owner"]);
    const { error } = await context.supabase
      .from("business_members")
      .update({ role: data.role })
      .eq("id", data.memberId)
      .eq("business_id", data.businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });

/** Remove a teammate. Owners only; cannot remove yourself. */
export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ businessId: z.string().uuid(), memberId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.businessId, ["owner"]);
    const { data: row } = await context.supabase
      .from("business_members")
      .select("user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (row?.user_id === context.userId)
      throw new Response("You can't remove yourself from your own business", { status: 400 });
    const { error } = await context.supabase
      .from("business_members")
      .delete()
      .eq("id", data.memberId)
      .eq("business_id", data.businessId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });
