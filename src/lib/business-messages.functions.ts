/**
 * Direct angler ↔ business messaging (every vertical: tackle shops, marinas,
 * guide services, manufacturers, apparel brands, charters). Booking-scoped
 * chat lives in messages.functions.ts; this channel is for pre-sale questions
 * and any conversation that isn't tied to a single booking.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Side = "angler" | "business";

async function loadConversation(supabase: any, conversationId: string) {
  const { data, error } = await supabase
    .from("business_conversations")
    .select("id,business_id,angler_id,last_message_at,business:businesses(id,name,slug,logo_url,hero_url,category_key)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Conversation not found", { status: 404 });
  return data;
}

/** Angler opens (or reuses) a direct thread with a business. */
export const startBusinessConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("business_conversations")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("angler_id", userId)
      .maybeSingle();
    if (existing.error) throw new Response(existing.error.message, { status: 500 });
    if (existing.data) return { conversationId: existing.data.id as string };

    const created = await supabase
      .from("business_conversations")
      .insert({ business_id: data.businessId, angler_id: userId })
      .select("id")
      .single();
    if (created.error) throw new Response(created.error.message, { status: 500 });
    return { conversationId: created.data.id as string };
  });

/**
 * Thread list. Angler side omits businessId; operator side passes the
 * workspace business it is viewing.
 */
export const listBusinessThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ businessId: z.string().uuid().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("business_conversations")
      .select("id,business_id,angler_id,last_message_at,business:businesses(id,name,slug,logo_url,hero_url,category_key)")
      .order("last_message_at", { ascending: false })
      .limit(60);
    q = data.businessId ? q.eq("business_id", data.businessId) : q.eq("angler_id", userId);
    const { data: convos, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    if (!convos?.length) return { viewerId: userId, threads: [] };

    const ids = convos.map((c: any) => c.id);
    const { data: msgs, error: mErr } = await supabase
      .from("business_messages")
      .select("conversation_id,body,created_at,read_at,sender_id,sender_side,is_deleted")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    if (mErr) throw new Response(mErr.message, { status: 500 });

    const last = new Map<string, any>();
    const unread = new Map<string, number>();
    for (const m of msgs ?? []) {
      if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
      if (!m.read_at && m.sender_id !== userId) {
        unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
      }
    }

    // Angler profiles (operator side needs the counterpart name/avatar).
    const anglerIds = [...new Set(convos.map((c: any) => c.angler_id))];
    const profRes = await supabase
      .from("profiles")
      .select("id,full_name,display_name,avatar_url")
      .in("id", anglerIds);
    const profiles = new Map<string, any>((profRes.data ?? []).map((p: any) => [p.id, p]));

    return {
      viewerId: userId,
      threads: convos.map((c: any) => ({
        id: c.id,
        businessId: c.business_id,
        anglerId: c.angler_id,
        business: c.business,
        angler: profiles.get(c.angler_id) ?? null,
        lastMessage: last.get(c.id) ?? null,
        unreadCount: unread.get(c.id) ?? 0,
        lastMessageAt: c.last_message_at,
      })),
    };
  });

export const getBusinessThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const convo = await loadConversation(supabase, data.conversationId);
    const msgRes = await supabase
      .from("business_messages")
      .select("id,body,sender_id,sender_side,created_at,read_at,is_deleted,reply_to_id")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (msgRes.error) throw new Response(msgRes.error.message, { status: 500 });

    const messages = msgRes.data ?? [];
    const ids = messages.map((m: any) => m.id);
    const reactionsRes = ids.length
      ? await supabase
          .from("business_message_reactions")
          .select("message_id,emoji,user_id")
          .in("message_id", ids)
      : { data: [], error: null };

    let angler: any = null;
    const profRes = await supabase
      .from("profiles")
      .select("id,full_name,display_name,avatar_url")
      .eq("id", convo.angler_id)
      .maybeSingle();
    angler = profRes.data ?? null;

    return {
      conversation: convo,
      angler,
      viewerId: userId,
      viewerSide: (convo.angler_id === userId ? "angler" : "business") as Side,
      messages,
      reactions: (reactionsRes as any).data ?? [],
    };
  });

export const sendBusinessMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        replyToId: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const convo = await loadConversation(supabase, data.conversationId);
    const side: Side = convo.angler_id === userId ? "angler" : "business";

    const ins = await supabase
      .from("business_messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        sender_side: side,
        body: data.body,
        reply_to_id: data.replyToId ?? null,
      })
      .select("id,body,sender_id,sender_side,created_at,read_at,is_deleted,reply_to_id")
      .single();
    if (ins.error) throw new Response(ins.error.message, { status: 500 });

    await supabase
      .from("business_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    return ins.data;
  });

/** Soft-delete your own direct message. */
export const deleteBusinessMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("business_messages")
      .update({ is_deleted: true, body: "" })
      .eq("id", data.messageId)
      .eq("sender_id", userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/** Add or remove one emoji reaction on a direct message. */
export const toggleBusinessReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ messageId: z.string().uuid(), emoji: z.string().min(1).max(8) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("business_message_reactions")
      .select("id")
      .eq("message_id", data.messageId)
      .eq("user_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();
    if (existing.data) {
      const { error } = await supabase
        .from("business_message_reactions")
        .delete()
        .eq("id", existing.data.id);
      if (error) throw new Response(error.message, { status: 500 });
      return { on: false as const };
    }
    const { error } = await supabase
      .from("business_message_reactions")
      .insert({ message_id: data.messageId, user_id: userId, emoji: data.emoji });
    if (error) throw new Response(error.message, { status: 500 });
    return { on: true as const };
  });


export const markBusinessThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const convo = await loadConversation(supabase, data.conversationId);
    const otherSide: Side = convo.angler_id === userId ? "business" : "angler";
    await supabase
      .from("business_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .eq("sender_side", otherSide)
      .is("read_at", null);
    return { ok: true };
  });
