/**
 * Direct angler ↔ operator inbox, shared by both sides of the marketplace.
 * `theme="light"` is the angler screen; `theme="dark"` is the operator console
 * (tackle shops, marinas, guide services, brands). Pass `businessId` on the
 * operator side to scope threads to that workspace.
 *
 * Layout, bubbles, replies, reactions and composer all come from chat-ui so
 * every vertical looks identical.
 */
import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteBusinessMessage,
  getBusinessThread,
  listBusinessThreads,
  markBusinessThreadRead,
  sendBusinessMessage,
  toggleBusinessReaction,
} from "@/lib/business-messages.functions";
import {
  ChatAvatar,
  ChatComposer,
  ChatEmptyState,
  DaySeparator,
  MessageBubble,
  chatPalette,
  dayLabel,
  relativeTime,
  summariseReactions,
  useOutbox,
  useGrowOnScroll,
  LoadingOlder,
  type Attachment,
  useRealtimeTable,
  useScrollToBottom,
  type ChatMessage,
  type ChatTheme,
  threadPreview,
} from "@/components/messages/chat-ui";

export function BusinessInbox({
  theme = "light",
  businessId,
  initialConversationId,
  fullHeight = false,
}: {
  theme?: ChatTheme;
  businessId?: string;
  initialConversationId?: string | null;
  /** fill the parent instead of a fixed-height card (full-screen messaging) */
  fullHeight?: boolean;
}) {
  const c = chatPalette(theme);
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const side: "angler" | "business" = businessId ? "business" : "angler";

  const listFn = useServerFn(listBusinessThreads);
  const threadFn = useServerFn(getBusinessThread);
  const sendFn = useServerFn(sendBusinessMessage);
  const readFn = useServerFn(markBusinessThreadRead);
  const deleteFn = useServerFn(deleteBusinessMessage);
  const reactFn = useServerFn(toggleBusinessReaction);

  const listKey = ["business-threads", businessId ?? "me"];
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => listFn({ data: businessId ? { businessId } : {} }),
  });
  const threads: any[] = (data as any)?.threads ?? [];

  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);
  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId);
  }, [initialConversationId]);
  useEffect(() => {
    if (isMobile) return; // phones start on the conversation list, WhatsApp-style
    if (!activeId && threads.length) setActiveId(threads[0].id);
  }, [activeId, threads, isMobile]);

  const thread = useQuery({
    queryKey: ["business-thread", activeId],
    queryFn: () => threadFn({ data: { conversationId: activeId! } }),
    enabled: !!activeId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["business-thread", activeId] });
    qc.invalidateQueries({ queryKey: listKey });
  };

  useRealtimeTable(
    "business_messages",
    activeId ? `conversation_id=eq.${activeId}` : null,
    refresh,
  );

  useEffect(() => {
    if (!activeId) return;
    readFn({ data: { conversationId: activeId } })
      .then(() => qc.invalidateQueries({ queryKey: listKey }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, thread.data]);

  const viewerId: string = (thread.data as any)?.viewerId ?? "";
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const outbox = useOutbox(
    viewerId,
    (body, replyToId, attachment) =>
      sendFn({
        data: {
          conversationId: activeId!,
          body,
          replyToId,
          attachmentUrl: attachment?.url ?? null,
          attachmentType: attachment?.kind ?? null,
          attachmentDurationMs: attachment?.durationMs ?? null,
        },
      }),
    refresh,
  );

  const counterpart = (t: any) =>
    side === "business"
      ? t.angler?.display_name || t.angler?.full_name || "Angler"
      : t.business?.name || "Operator";
  const counterpartPhoto = (t: any) =>
    side === "business" ? t.angler?.avatar_url : t.business?.logo_url || t.business?.hero_url;

  const active = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  const serverMessages: ChatMessage[] = ((thread.data as any)?.messages ?? []) as ChatMessage[];
  const allMessages = [...serverMessages, ...outbox.items];
  const byId = new Map(serverMessages.map((m) => [m.id, m]));
  const endRef = useScrollToBottom(allMessages.length);
  const { count, sentinelRef, hasMore } = useGrowOnScroll(allMessages.length, 30);
  const {
    count: listCount,
    sentinelRef: listSentinel,
    hasMore: moreThreads,
  } = useGrowOnScroll(threads.length, 15);
  const visibleMessages = allMessages.slice(Math.max(0, allMessages.length - count));

  const name = active ? counterpart(active) : "Conversation";
  const photo = active ? counterpartPhoto(active) : null;

  const submit = (attachment?: Attachment | null) => {
    const body = draft.trim();
    if ((!body && !attachment) || !activeId) return;
    outbox.push(body, replyTo?.id ?? null, attachment ?? null);
    setDraft("");
    setReplyTo(null);
  };

  if (isLoading) {
    return <div style={{ padding: 28, color: c.mut, fontSize: 13 }}>Loading conversations…</div>;
  }

  if (!threads.length) {
    return (
      <ChatEmptyState c={c} icon="💬" title="No direct messages yet">
        {side === "business"
          ? "When a customer messages your storefront, the conversation lands here."
          : "Message a shop, marina or guide from their page to start a conversation."}
      </ChatEmptyState>
    );
  }

  let lastDay = "";

  return (
    <div
      className="fx-inbox"
      style={{
        display: isMobile ? "block" : "grid",
        gridTemplateColumns: "minmax(240px,320px) 1fr",
        gap: 0,
        border: isMobile || fullHeight ? "none" : `1px solid ${c.line}`,
        borderRadius: isMobile || fullHeight ? 0 : 16,
        overflow: "hidden",
        background: c.surface,
        minHeight: isMobile || fullHeight ? 0 : 520,
        height: fullHeight ? "100%" : undefined,
        flex: fullHeight ? 1 : undefined,
      }}
    >
      <div
        style={{
          display: isMobile && activeId ? "none" : "block",
          borderRight: isMobile ? "none" : `1px solid ${c.line}`,
          maxHeight: isMobile || fullHeight ? "none" : 640,
          height: fullHeight && !isMobile ? "100%" : undefined,
          overflowY: "auto",
        }}
      >
        {threads.slice(0, listCount).map((t) => {
          const on = t.id === activeId;
          const snippet = threadPreview(t.lastMessage);

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              style={{
                width: "100%",
                display: "flex",
                gap: 12,
                textAlign: "left",
                padding: "14px 16px",
                border: "none",
                borderBottom: `1px solid ${c.line}`,
                borderLeft: `3px solid ${on ? c.accent : "transparent"}`,
                background: on ? c.accentSoft : "transparent",
                cursor: "pointer",
                color: c.text,
              }}
            >
              <ChatAvatar c={c} label={counterpart(t)} url={counterpartPhoto(t)} size={42} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b
                    style={{
                      fontSize: 13.5,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {counterpart(t)}
                  </b>
                  <span style={{ fontSize: 11, color: c.mut, flex: "none" }}>
                    {relativeTime(t.lastMessage?.created_at ?? t.lastMessageAt)}
                  </span>
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: c.mut,
                    marginTop: 3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {snippet}
                </span>
                {t.unreadCount > 0 && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      background: c.accent,
                      color: c.onAccent,
                      borderRadius: 20,
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "2px 8px",
                    }}
                  >
                    {t.unreadCount} new
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {moreThreads && (
          <div ref={listSentinel}>
            <LoadingOlder c={c} label="Loading more conversations…" />
          </div>
        )}
      </div>

      <div
        style={{
          display: isMobile && !activeId ? "none" : "flex",
          flexDirection: "column",
          minHeight: 0,
          height: fullHeight ? "100%" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: isMobile ? "10px 12px" : "14px 18px",
            borderBottom: `1px solid ${c.line}`,
          }}
        >
          {isMobile && (
            <button
              type="button"
              aria-label="Back to conversations"
              onClick={() => setActiveId(null)}
              style={{
                background: "none",
                border: 0,
                color: c.text,
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
                padding: "4px 2px",
              }}
            >
              ←
            </button>
          )}
          {active && <ChatAvatar c={c} label={name} url={photo} size={38} />}
          <div>
            <div style={{ fontFamily: c.sans, fontSize: 18, fontWeight: 600, color: c.text }}>
              {name}
            </div>
            <div style={{ fontSize: 11.5, color: c.mut }}>
              {side === "business"
                ? "Direct customer enquiry"
                : active?.business?.category_key?.replace(/_/g, " ") ?? "Operator"}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: fullHeight ? 0 : 240,
            maxHeight: isMobile || fullHeight ? "none" : 460,
            overflowY: "auto",
            padding: isMobile ? 14 : 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: c.canvas,
          }}
        >
          {thread.isLoading && <div style={{ color: c.mut, fontSize: 13 }}>Loading…</div>}
          {!thread.isLoading && allMessages.length === 0 && (
            <div style={{ color: c.mut, fontSize: 13 }}>Say hello to start the conversation.</div>
          )}
          {hasMore && (
            <div ref={sentinelRef}>
              <LoadingOlder c={c} />
            </div>
          )}
          {visibleMessages.map((m) => {
            const mine = m.sender_id === viewerId;
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : null;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {showDay && <DaySeparator label={day} c={c} />}
                <MessageBubble
                  c={c}
                  message={m}
                  mine={mine}
                  senderLabel={name}
                  senderPhoto={photo}
                  replyTo={
                    quoted
                      ? {
                          body: quoted.is_deleted ? null : quoted.body,
                          mine: quoted.sender_id === viewerId,
                          label: name,
                        }
                      : null
                  }
                  reactions={summariseReactions((thread.data as any)?.reactions, m.id, viewerId)}
                  onReply={() => setReplyTo(m)}
                  onReact={(emoji) =>
                    reactFn({ data: { messageId: m.id, emoji } }).then(refresh).catch(() => {})
                  }
                  onDelete={
                    mine
                      ? () =>
                          deleteFn({ data: { messageId: m.id } }).then(refresh).catch(() => {})
                      : undefined
                  }
                  onRetry={m.failed ? () => outbox.retry(m.id) : undefined}
                />
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <ChatComposer
          c={c}
          value={draft}
          onChange={setDraft}
          onSubmit={() => submit()}
          uploaderId={viewerId}
          onAttachment={(a) => submit(a)}
          placeholder="Write a message…"
          replyPreview={
            replyTo
              ? { label: replyTo.sender_id === viewerId ? "yourself" : name, body: replyTo.body }
              : null
          }
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
}
