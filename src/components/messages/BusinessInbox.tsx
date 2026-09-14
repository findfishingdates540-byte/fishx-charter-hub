/**
 * Direct angler ↔ operator inbox, shared by both sides of the marketplace.
 * `theme="light"` is the angler screen; `theme="dark"` is the operator console
 * (tackle shops, marinas, guide services, brands). Pass `businessId` on the
 * operator side to scope threads to that workspace.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBusinessThread,
  listBusinessThreads,
  markBusinessThreadRead,
  sendBusinessMessage,
} from "@/lib/business-messages.functions";

type Theme = "light" | "dark";

const palette = (theme: Theme) =>
  theme === "dark"
    ? {
        bg: "var(--bg, #0D161F)",
        card: "var(--card, #14202B)",
        line: "rgba(255,255,255,.10)",
        text: "#F0F2F5",
        mut: "#92A0AB",
        accent: "#2DE2F2",
        accentSoft: "rgba(45,226,242,.12)",
        bubbleIn: "rgba(255,255,255,.06)",
        onAccent: "#04121B",
      }
    : {
        bg: "#ffffff",
        card: "#ffffff",
        line: "rgba(13,34,54,.10)",
        text: "#031029",
        mut: "#5c6b78",
        accent: "#2DE2F2",
        accentSoft: "#E2F6FA",
        bubbleIn: "#F2F6F9",
        onAccent: "#04121B",
      };

const serif = "'Outfit',Georgia,serif";

const relativeTime = (iso?: string | null) => {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function Avatar({ label, url, size = 44, c }: { label: string; url?: string | null; size?: number; c: ReturnType<typeof palette> }) {
  if (url) {
    return <MediaImg src={url} alt={label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }} />;
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: c.accentSoft,
        color: c.accent === "#2DE2F2" ? "#0f7f95" : c.accent,
        display: "grid",
        placeItems: "center",
        fontFamily: serif,
        fontWeight: 700,
        fontSize: size * 0.42,
        flex: "none",
      }}
    >
      {(label?.trim()?.[0] ?? "F").toUpperCase()}
    </span>
  );
}

export function BusinessInbox({
  theme = "light",
  businessId,
  initialConversationId,
}: {
  theme?: Theme;
  businessId?: string;
  initialConversationId?: string | null;
}) {
  const c = palette(theme);
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const side: "angler" | "business" = businessId ? "business" : "angler";

  const listFn = useServerFn(listBusinessThreads);
  const threadFn = useServerFn(getBusinessThread);
  const sendFn = useServerFn(sendBusinessMessage);
  const readFn = useServerFn(markBusinessThreadRead);

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

  useEffect(() => {
    if (!activeId) return;
    readFn({ data: { conversationId: activeId } })
      .then(() => qc.invalidateQueries({ queryKey: listKey }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, thread.data]);

  const [draft, setDraft] = useState("");
  const send = useMutation({
    mutationFn: (body: string) => sendFn({ data: { conversationId: activeId!, body } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["business-thread", activeId] });
      qc.invalidateQueries({ queryKey: listKey });
    },
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.data]);

  const counterpart = (t: any) =>
    side === "business"
      ? t.angler?.display_name || t.angler?.full_name || "Angler"
      : t.business?.name || "Operator";
  const counterpartPhoto = (t: any) =>
    side === "business" ? t.angler?.avatar_url : t.business?.logo_url || t.business?.hero_url;

  const active = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  if (isLoading) {
    return <div style={{ padding: 28, color: c.mut, fontSize: 13 }}>Loading conversations…</div>;
  }

  if (!threads.length) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: c.mut, fontSize: 13.5 }}>
        <div style={{ fontFamily: serif, fontSize: 22, color: c.text, marginBottom: 8 }}>
          No direct messages yet
        </div>
        {side === "business"
          ? "When a customer messages your storefront, the conversation lands here."
          : "Message a shop, marina or guide from their page to start a conversation."}
      </div>
    );
  }

  return (
    <div
      className="fx-inbox"
      style={{
        display: isMobile ? "block" : "grid",
        gridTemplateColumns: "minmax(240px,320px) 1fr",
        gap: 0,
        border: isMobile ? "none" : `1px solid ${c.line}`,
        borderRadius: isMobile ? 0 : 16,
        overflow: "hidden",
        background: c.card,
        minHeight: isMobile ? 0 : 520,
      }}
    >
      <div
        style={{
          display: isMobile && activeId ? "none" : "block",
          borderRight: isMobile ? "none" : `1px solid ${c.line}`,
          maxHeight: isMobile ? "none" : 640,
          overflowY: "auto",
        }}
      >
        {threads.map((t) => {
          const on = t.id === activeId;
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
              <Avatar c={c} label={counterpart(t)} url={counterpartPhoto(t)} size={42} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                  {t.lastMessage?.body?.trim() || "No messages yet"}
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
      </div>

      <div style={{ display: isMobile && !activeId ? "none" : "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "10px 12px" : "14px 18px", borderBottom: `1px solid ${c.line}` }}>
          {isMobile && (
            <button
              type="button"
              aria-label="Back to conversations"
              onClick={() => setActiveId(null)}
              style={{ background: "none", border: 0, color: c.text, fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "4px 2px" }}
            >
              ←
            </button>
          )}
          {active && <Avatar c={c} label={counterpart(active)} url={counterpartPhoto(active)} size={38} />}
          <div>
            <div style={{ fontFamily: serif, fontSize: 19, color: c.text }}>
              {active ? counterpart(active) : "Conversation"}
            </div>
            <div style={{ fontSize: 11.5, color: c.mut }}>
              {side === "business" ? "Direct customer enquiry" : active?.business?.category_key?.replace(/_/g, " ") ?? "Operator"}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 240, maxHeight: isMobile ? "none" : 460, overflowY: "auto", padding: isMobile ? 14 : 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {thread.isLoading && <div style={{ color: c.mut, fontSize: 13 }}>Loading…</div>}
          {(thread.data as any)?.messages?.length === 0 && (
            <div style={{ color: c.mut, fontSize: 13 }}>Say hello to start the conversation.</div>
          )}
          {((thread.data as any)?.messages ?? []).map((m: any) => {
            const mine = m.sender_side === side;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                <div
                  style={{
                    background: mine ? c.accent : c.bubbleIn,
                    color: mine ? c.onAccent : c.text,
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.body}
                </div>
                <div style={{ fontSize: 10.5, color: c.mut, marginTop: 4, textAlign: mine ? "right" : "left" }}>
                  {timeLabel(m.created_at)}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body || !activeId || send.isPending) return;
            send.mutate(body);
          }}
          style={{ display: "flex", gap: 10, padding: 14, borderTop: `1px solid ${c.line}` }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            style={{
              flex: 1,
              background: theme === "dark" ? "rgba(255,255,255,.05)" : "#F6F9FB",
              border: `1px solid ${c.line}`,
              borderRadius: 12,
              padding: "11px 14px",
              color: c.text,
              fontSize: 13.5,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            style={{
              background: c.accent,
              color: c.onAccent,
              border: "none",
              borderRadius: 12,
              padding: "11px 20px",
              fontWeight: 800,
              fontSize: 12.5,
              cursor: "pointer",
              opacity: !draft.trim() || send.isPending ? 0.5 : 1,
            }}
          >
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
