import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getVerificationConfig } from "./verification-config";

async function memberRole(supabase: any, userId: string, businessId: string) {
  const { data, error } = await supabase.from("business_members").select("role").eq("business_id", businessId).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("You don't have access to this business");
  return data.role as string;
}

export const getVerificationDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ businessId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await memberRole(context.supabase, context.userId, data.businessId);
    const [{ data: business, error: bizError }, { data: rows, error: docsError }] = await Promise.all([
      context.supabase.from("businesses").select("id,category_key,verified_at").eq("id", data.businessId).maybeSingle(),
      context.supabase.from("verification_documents").select("*").eq("business_id", data.businessId).order("created_at", { ascending: false }),
    ]);
    if (bizError || !business) throw new Error(bizError?.message ?? "Business not found");
    if (docsError) throw new Error(docsError.message);
    const current = (rows ?? []).filter((row: any) => row.is_current);
    const withUrls = await Promise.all(current.map(async (row: any) => {
      const { data: signed } = await context.supabase.storage.from("verification-docs").createSignedUrl(row.file_path, 900);
      return { ...row, viewUrl: signed?.signedUrl ?? null };
    }));
    return { required: getVerificationConfig(business.category_key).docs, documents: withUrls, verifiedAt: business.verified_at };
  });

export const submitVerificationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ businessId: z.string().uuid(), documentKey: z.string().regex(/^[a-z0-9_]{1,64}$/), documentLabel: z.string().min(2).max(120), filePath: z.string().min(3).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const role = await memberRole(context.supabase, context.userId, data.businessId);
    if (!['owner', 'manager'].includes(role)) throw new Error("Only owners and managers can submit documents");
    if (!data.filePath.startsWith(`${data.businessId}/`)) throw new Error("Invalid document path");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: business }, { data: current }] = await Promise.all([
      supabaseAdmin.from("businesses").select("category_key,name").eq("id", data.businessId).maybeSingle(),
      supabaseAdmin.from("verification_documents").select("*").eq("business_id", data.businessId).eq("document_key", data.documentKey).eq("is_current", true).maybeSingle(),
    ]);
    if (!business) throw new Error("Business not found");
    const spec = getVerificationConfig(business.category_key).docs.find((doc) => doc.key === data.documentKey);
    if (!spec) throw new Error("This document is not required for your business");
    if (current && !['rejected', 'reopened'].includes(current.status)) throw new Error("This document is locked while pending or accepted");
    if (current) {
      const { error } = await supabaseAdmin.from("verification_documents").update({ is_current: false }).eq("id", current.id).eq("is_current", true);
      if (error) throw new Error(error.message);
    }
    const { data: created, error } = await supabaseAdmin.from("verification_documents").insert({
      business_id: data.businessId, document_key: data.documentKey, document_label: spec.title,
      file_path: data.filePath, submitted_by: context.userId, status: "pending",
      version: (current?.version ?? 0) + 1, replaces_document_id: current?.id ?? null,
    }).select().single();
    if (error) {
      if (current) await supabaseAdmin.from("verification_documents").update({ is_current: true }).eq("id", current.id);
      throw new Error(error.message);
    }
    await supabaseAdmin.from("businesses").update({ verified_at: null }).eq("id", data.businessId);
    return created;
  });