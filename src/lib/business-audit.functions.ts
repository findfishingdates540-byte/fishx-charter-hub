/**
 * Readiness history for a business: every verification decision, payment
 * (Stripe) status change and profile/visibility change, with timestamps and
 * the person responsible.
 *
 * Platform staff can read any business's history; a business's own team can
 * read their own. Both paths go through the caller's RLS-scoped client, so the
 * policies on `business_audit_events` decide what comes back.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BusinessAuditEvent = {
  id: string;
  area: "verification" | "payments" | "profile" | string;
  event_type: string;
  field: string | null;
  previous_value: string | null;
  new_value: string | null;
  note: string | null;
  actor_id: string | null;
  actorName: string | null;
  meta_json: Record<string, string | number | boolean | null>;
  created_at: string;
};

export const getBusinessAuditHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        area: z.enum(["all", "verification", "payments", "profile"]).default("all"),
        limit: z.number().int().min(1).max(300).default(150),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("business_audit_events")
      .select("id,area,event_type,field,previous_value,new_value,note,actor_id,meta_json,created_at")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.area !== "all") q = q.eq("area", data.area);

    const { data: rows, error } = await q;
    if (error) {
      console.error("[audit-history]", error.message);
      return { events: [] as BusinessAuditEvent[] };
    }

    const actorIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)),
    ) as string[];
    let nameById = new Map<string, string>();
    if (actorIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id,full_name,display_name")
        .in("id", actorIds);
      nameById = new Map(
        (profiles ?? []).map((p: any) => [p.id, p.display_name || p.full_name || "Team member"]),
      );
    }

    return {
      events: (rows ?? []).map((r: any) => ({
        ...r,
        actorName: r.actor_id ? (nameById.get(r.actor_id) ?? null) : null,
      })) as BusinessAuditEvent[],
    };
  });
