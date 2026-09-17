/**
 * In-app notification inbox + preferences (angler and operator side).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id,category,title,body,link,severity,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Response(error.message, { status: 500 });
    const items = data ?? [];
    return { items, unread: items.filter((n) => !n.read_at).length };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (!data.all) {
      if (!data.id) throw new Response("id required", { status: 400 });
      q = q.eq("id", data.id);
    }
    const { error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notification_preferences")
      .select("email_enabled,categories")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      emailEnabled: data?.email_enabled ?? true,
      categories: (data?.categories ?? {}) as Record<string, boolean>,
    };
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        emailEnabled: z.boolean().optional(),
        categories: z.record(z.string(), z.boolean()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      ...(typeof data.emailEnabled === "boolean" ? { email_enabled: data.emailEnabled } : {}),
      ...(data.categories ? { categories: data.categories } : {}),
    };
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" });

    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/**
 * Full notification center feed — supports filtering by read state and
 * category, plus simple "load more" paging. The bell keeps using
 * listNotifications (latest 30); this powers the /notifications page.
 */
export const listNotificationCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        filter: z.enum(["all", "unread"]).default("all"),
        category: z.string().optional(),
        limit: z.number().int().min(10).max(100).default(30),
        offset: z.number().int().min(0).default(0),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notifications")
      .select("id,category,title,body,link,severity,read_at,created_at")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.filter === "unread") q = q.is("read_at", null);
    if (data.category) q = q.eq("category", data.category);

    const [{ data: rows, error }, counts] = await Promise.all([
      q,
      context.supabase
        .from("notifications")
        .select("category,read_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (error) throw new Response(error.message, { status: 500 });

    const all = (counts.data ?? []) as { category: string | null; read_at: string | null }[];
    const byCategory: Record<string, number> = {};
    for (const n of all) {
      const key = n.category ?? "other";
      byCategory[key] = (byCategory[key] ?? 0) + 1;
    }

    return {
      items: rows ?? [],
      hasMore: (rows?.length ?? 0) === data.limit,
      unread: all.filter((n) => !n.read_at).length,
      byCategory,
    };
  });
