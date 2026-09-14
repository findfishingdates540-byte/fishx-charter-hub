/**
 * Shared chat primitives used by every messaging surface in the app — the
 * angler Messages screen, the direct angler↔business inbox, and the operator
 * consoles (captain, guide, marina, tackle, apparel, manufacturer).
 *
 * One look, two palettes: `light` for angler/public screens, `dark` for the
 * operator consoles. Everything here is presentation only; the data comes from
 * messages.functions.ts / business-messages.functions.ts.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { supabase } from "@/integrations/supabase/client";

export type ChatTheme = "light" | "dark";

export type ChatPalette = ReturnType<typeof chatPalette>;

export function chatPalette(theme: ChatTheme) {
  return theme === "dark"
    ? {
        theme,
        sans: "'Outfit',system-ui,sans-serif",
        surface: "var(--card, #14202B)",
        canvas: "rgba(0,0,0,.14)",
        line: "rgba(255,255,255,.10)",
        text: "#F0F2F5",
        mut: "#92A0AB",
        accent: "#2DE2F2",
        accentSoft: "rgba(45,226,242,.12)",
        onAccent: "#04121B",
        bubbleIn: "rgba(255,255,255,.06)",
        bubbleOut: "#2DE2F2",
        bubbleOutText: "#04121B",
        field: "rgba(255,255,255,.05)",
        quote: "rgba(255,255,255,.08)",
      }
    : {
        theme,
        sans: "'Outfit',system-ui,sans-serif",
        surface: "#ffffff",
        canvas: "#F7FAFC",
        line: "rgba(13,34,54,.10)",
        text: "#031029",
        mut: "#5c6b78",
        accent: "#2DE2F2",
        accentSoft: "#E2F6FA",
        onAccent: "#04121B",
        bubbleIn: "#F2F6F9",
        bubbleOut: "#072057",
        bubbleOutText: "#ffffff",
        field: "#F6F9FB",
        quote: "rgba(13,34,54,.06)",
      };
}

export const REACTION_CHOICES = ["👍", "❤️", "😂", "🎣", "🔥", "🙏"];

/* ------------------------------------------------------------- formatting -- */

export const relativeTime = (iso?: string | null) => {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  const yesterday = new Date(today.getTime() - 86400000);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

/* ----------------------------------------------------------------- types -- */

export type ChatMessage = {
  id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  read_at?: string | null;
  is_deleted?: boolean | null;
  reply_to_id?: string | null;
  /** client-only: optimistic states */
  pending?: boolean;
  failed?: boolean;
};

export type ReactionRow = { message_id: string; emoji: string; user_id: string };

export type ReactionChip = { emoji: string; count: number; mine: boolean };

export function summariseReactions(
  rows: ReactionRow[] | undefined,
  messageId: string,
  viewerId: string,
): ReactionChip[] {
  if (!rows?.length) return [];
  const map = new Map<string, ReactionChip>();
  for (const r of rows) {
    if (r.message_id !== messageId) continue;
    const chip = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    chip.count += 1;
    if (r.user_id === viewerId) chip.mine = true;
    map.set(r.emoji, chip);
  }
  return [...map.values()];
}

/* ----------------------------------------------------------------- pieces -- */

export function ChatAvatar({
  label,
  url,
  size = 42,
  c,
}: {
  label: string;
  url?: string | null;
  size?: number;
  c: ChatPalette;
}) {
  if (url) {
    return (
      <MediaImg
        src={url}
        alt=""
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: c.accentSoft,
        color: c.theme === "dark" ? c.accent : "#0f7f95",
        display: "grid",
        placeItems: "center",
        fontFamily: c.sans,
        fontWeight: 700,
        fontSize: size * 0.4,
        flex: "none",
      }}
    >
      {(label?.trim()?.[0] ?? "F").toUpperCase()}
    </span>
  );
}

export function DaySeparator({ label, c }: { label: string; c: ChatPalette }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", position: "sticky", top: 0, zIndex: 2 }}>
      <span
        style={{
          background: c.surface,
          border: `1px solid ${c.line}`,
          borderRadius: 30,
          padding: "4px 12px",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: c.mut,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Ticks({ read, c, onAccent }: { read: boolean; c: ChatPalette; onAccent: boolean }) {
  return (
    <span
      aria-label={read ? "Read" : "Sent"}
      title={read ? "Read" : "Sent"}
      style={{
        fontSize: 11,
        letterSpacing: "-.18em",
        marginLeft: 4,
        color: read ? (onAccent ? c.bubbleOutText : c.accent) : c.mut,
        opacity: read ? 1 : 0.7,
      }}
    >
      {read ? "✓✓" : "✓"}
    </span>
  );
}

/** One message row: quoted reply, bubble, reactions, hover actions. */
export function MessageBubble({
  c,
  message,
  mine,
  senderLabel,
  senderPhoto,
  replyTo,
  reactions,
  onReply,
  onReact,
  onDelete,
  onRetry,
}: {
  c: ChatPalette;
  message: ChatMessage;
  mine: boolean;
  senderLabel: string;
  senderPhoto?: string | null;
  replyTo?: { body: string | null; mine: boolean; label: string } | null;
  reactions?: ReactionChip[];
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
  onRetry?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [picker, setPicker] = useState(false);
  const deleted = !!message.is_deleted;
  const startX = useRef<number | null>(null);

  const bubbleBg = mine ? c.bubbleOut : c.bubbleIn;
  const bubbleFg = mine ? c.bubbleOutText : c.text;

  const actionBtn: CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.line}`,
    color: c.mut,
    borderRadius: 999,
    width: 26,
    height: 26,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPicker(false);
      }}
      // swipe-to-reply on touch devices
      onTouchStart={(e) => {
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const from = startX.current;
        const to = e.changedTouches[0]?.clientX ?? null;
        startX.current = null;
        if (from != null && to != null && to - from > 60 && !deleted) onReply?.();
      }}
      style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 9,
        maxWidth: "84%",
        marginLeft: mine ? "auto" : 0,
        marginRight: mine ? 0 : "auto",
      }}
    >
      {!mine && <ChatAvatar c={c} label={senderLabel} url={senderPhoto} size={28} />}

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
        <div
          style={{
            background: deleted ? "transparent" : bubbleBg,
            color: deleted ? c.mut : bubbleFg,
            border: deleted || !mine ? `1px solid ${c.line}` : "0",
            borderRadius: 16,
            borderTopRightRadius: mine ? 5 : 16,
            borderTopLeftRadius: mine ? 16 : 5,
            padding: "10px 14px",
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontStyle: deleted ? "italic" : "normal",
            opacity: message.pending ? 0.65 : 1,
          }}
        >
          {replyTo && !deleted && (
            <div
              style={{
                background: mine ? "rgba(255,255,255,.16)" : c.quote,
                borderLeft: `3px solid ${mine ? c.bubbleOutText : c.accent}`,
                borderRadius: 8,
                padding: "6px 9px",
                marginBottom: 7,
                fontSize: 12,
                opacity: 0.92,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
                {replyTo.mine ? "You" : replyTo.label}
              </div>
              <div
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {replyTo.body?.trim() || "Message deleted"}
              </div>
            </div>
          )}
          {deleted ? "Message deleted" : message.body}
        </div>

        {/* reactions */}
        {!!reactions?.length && !deleted && (
          <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact?.(r.emoji)}
                style={{
                  border: `1px solid ${r.mine ? c.accent : c.line}`,
                  background: r.mine ? c.accentSoft : c.surface,
                  color: c.text,
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 11.5,
                  cursor: "pointer",
                  lineHeight: 1.5,
                }}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            fontSize: 10.5,
            color: c.mut,
            flexDirection: mine ? "row-reverse" : "row",
          }}
        >
          <span>
            {message.pending ? "Sending…" : message.failed ? "Not sent" : timeLabel(message.created_at)}
            {mine && !message.pending && !message.failed && !deleted && (
              <Ticks read={!!message.read_at} c={c} onAccent={false} />
            )}
          </span>
          {message.failed && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                background: "transparent",
                border: `1px solid ${c.line}`,
                color: c.accent,
                borderRadius: 999,
                padding: "1px 9px",
                fontSize: 10.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          )}

          {/* hover actions */}
          {(hover || picker) && !deleted && !message.pending && (
            <span style={{ display: "flex", gap: 4, position: "relative" }}>
              {onReact && (
                <button type="button" aria-label="React" style={actionBtn} onClick={() => setPicker((p) => !p)}>
                  ☺
                </button>
              )}
              {onReply && (
                <button type="button" aria-label="Reply" style={actionBtn} onClick={onReply}>
                  ↩
                </button>
              )}
              {mine && onDelete && (
                <button type="button" aria-label="Delete message" style={actionBtn} onClick={onDelete}>
                  🗑
                </button>
              )}
              {picker && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 32,
                    [mine ? "right" : "left"]: 0,
                    display: "flex",
                    gap: 2,
                    background: c.surface,
                    border: `1px solid ${c.line}`,
                    borderRadius: 999,
                    padding: "4px 6px",
                    boxShadow: "0 12px 28px -16px rgba(0,0,0,.55)",
                    zIndex: 5,
                  } as CSSProperties}
                >
                  {REACTION_CHOICES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onReact?.(e);
                        setPicker(false);
                      }}
                      style={{
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        fontSize: 15,
                        lineHeight: 1,
                        padding: 3,
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Growing textarea composer with an optional reply preview above it. */
export function ChatComposer({
  c,
  value,
  onChange,
  onSubmit,
  replyPreview,
  onCancelReply,
  disabled,
  placeholder = "Type a message…",
}: {
  c: ChatPalette;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  replyPreview?: { label: string; body: string | null } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  return (
    <div style={{ borderTop: `1px solid ${c.line}`, background: c.surface }}>
      {replyPreview && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px 0",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderLeft: `3px solid ${c.accent}`,
              background: c.quote,
              borderRadius: 8,
              padding: "7px 10px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>
              Replying to {replyPreview.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: c.mut,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {replyPreview.body?.trim() || "Message deleted"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            style={{
              background: "transparent",
              border: `1px solid ${c.line}`,
              color: c.mut,
              borderRadius: 999,
              width: 26,
              height: 26,
              cursor: "pointer",
              flex: "none",
            }}
          >
            ✕
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "14px 18px" }}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          style={{
            flex: 1,
            resize: "none",
            minHeight: 44,
            maxHeight: 132,
            background: c.field,
            border: `1px solid ${c.line}`,
            borderRadius: 14,
            padding: "12px 15px",
            fontFamily: c.sans,
            fontSize: 14,
            lineHeight: 1.5,
            color: c.text,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          style={{
            flex: "none",
            background: c.accent,
            color: c.onAccent,
            border: 0,
            borderRadius: 14,
            padding: "0 22px",
            height: 44,
            fontFamily: c.sans,
            fontSize: 12.5,
            fontWeight: 800,
            cursor: "pointer",
            opacity: disabled || !value.trim() ? 0.55 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

/** Empty / placeholder panel shared by every inbox. */
export function ChatEmptyState({
  c,
  icon = "⚓",
  title,
  children,
}: {
  c: ChatPalette;
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "56px 30px",
        background: c.surface,
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: "50%",
          background: c.accentSoft,
          display: "grid",
          placeItems: "center",
          marginBottom: 18,
          fontSize: 32,
        }}
      >
        {icon}
      </div>
      <div style={{ fontFamily: c.sans, fontSize: 21, fontWeight: 600, color: c.text, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 13.5, color: c.mut, lineHeight: 1.6, maxWidth: 340 }}>{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------- realtime -- */

/**
 * Subscribe to live inserts/updates on a message or reaction table and run a
 * callback (normally a query invalidation). Always cleaned up on unmount.
 */
export function useRealtimeTable(
  table: string,
  filter: string | null,
  onChange: () => void,
  enabled = true,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled || !filter) return;
    const channel = supabase
      .channel(`${table}:${filter}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => cb.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]);
}

/** Scroll helper: keeps the transcript pinned to the newest message. */
export function useScrollToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [dep]);
  return ref;
}

/* --------------------------------------------------------------- outbox --- */

type OutboxItem = ChatMessage & { _reply: string | null };

/**
 * Optimistic send queue: the message appears instantly, shows "Sending…",
 * and offers a Retry button if the server call fails.
 */
export function useOutbox(
  viewerId: string,
  send: (body: string, replyToId: string | null) => Promise<unknown>,
  onSent: () => void,
) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const sendRef = useRef(send);
  sendRef.current = send;
  const sentRef = useRef(onSent);
  sentRef.current = onSent;

  const run = (entry: OutboxItem) => {
    setItems((prev) => prev.map((i) => (i.id === entry.id ? { ...i, pending: true, failed: false } : i)));
    void sendRef
      .current(entry.body ?? "", entry._reply)
      .then(() => {
        setItems((prev) => prev.filter((i) => i.id !== entry.id));
        sentRef.current();
      })
      .catch(() => {
        setItems((prev) =>
          prev.map((i) => (i.id === entry.id ? { ...i, pending: false, failed: true } : i)),
        );
      });
  };

  const push = (body: string, replyToId: string | null) => {
    const entry: OutboxItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      body,
      sender_id: viewerId,
      created_at: new Date().toISOString(),
      pending: true,
      _reply: replyToId,
    };
    setItems((prev) => [...prev, entry]);
    run(entry);
  };

  const retry = (id: string) => {
    const entry = items.find((i) => i.id === id);
    if (entry) run(entry);
  };

  return { items, push, retry };
}
