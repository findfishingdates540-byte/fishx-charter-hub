/**
 * Operator-side Messages — the same two-pane inbox as the angler screen
 * (thread list + open thread), re-skinned for the dark operator theme.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCaptainConversations, getCaptainThread } from "@/lib/captain-management.functions";
import {
  sendMessage,
  markThreadRead,
  deleteBookingMessage,
  toggleBookingReaction,
} from "@/lib/messages.functions";
import { BusinessInbox } from "@/components/messages/BusinessInbox";
import {
  ChatAvatar,
  ChatComposer,
  DaySeparator,
  MessageBubble,
  chatPalette,
  dayLabel,
  summariseReactions,
  useOutbox,
  useGrowOnScroll,
  LoadingOlder,
  type Attachment,
  useRealtimeTable,
  useScrollToBottom,
  type ChatMessage,
} from "@/components/messages/chat-ui";

const C = {
  card: "var(--card, #14202B)",
  line: "var(--line)",
  tmut: "var(--tmut)",
  cyan: "#2DE2F2",
  cyansoft: "rgba(45,226,242,.12)",
  serif: "var(--serif, 'Outfit',Georgia,serif)",
};

const initial = (s: string) => (s?.trim()?.[0] ?? "G").toUpperCase();

const relativeTime = (iso: string | null | undefined) => {
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




function Avatar({ label, url, size = 44 }: { label: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <MediaImg
        src={url}
        alt={label}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.cyansoft,
        color: C.cyan,
        display: "grid",
        placeItems: "center",
        fontFamily: C.serif,
        fontWeight: 600,
        fontSize: size * 0.42,
        flex: "none",
      }}
    >
      {initial(label)}
    </span>
  );
}

export function CaptainMessages({
  businessId,
  fullHeight = false,
}: {
  businessId?: string | null;
  fullHeight?: boolean;
}) {
  const [mode, setMode] = useState<"trips" | "direct">("trips");
  return (
    <div
      style={
        fullHeight
          ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0, padding: "14px 16px 0" }
          : undefined
      }
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flex: "none" }}>
        {([["trips", "Trip threads"], ["direct", "Direct enquiries"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            style={{
              borderRadius: 30,
              padding: "9px 18px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              border: `1px solid ${C.line}`,
              background: mode === k ? C.cyan : "transparent",
              color: mode === k ? "#04121B" : C.tmut,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "trips" ? (
        <BookingThreads fullHeight={fullHeight} />
      ) : businessId ? (
        <BusinessInbox theme="dark" businessId={businessId} fullHeight={fullHeight} />
      ) : (
        <div style={{ padding: 24, color: C.tmut, fontSize: 13 }}>
          Connect your charter business to receive direct enquiries.
        </div>
      )}
    </div>
  );
}

function BookingThreads({ fullHeight = false }: { fullHeight?: boolean }) {
  const listFn = useServerFn(listCaptainConversations);
  const { data, isLoading } = useQuery({
    queryKey: ["captain-conversations"],
    queryFn: () => listFn(),
  });
  const rows: any[] = Array.isArray(data) ? (data as any[]) : [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  useEffect(() => {
    if (!activeId && rows.length) setActiveId(rows[0].booking_id);
  }, [rows, activeId]);

  const select = (id: string) => {
    setActiveId(id);
    setMobileThreadOpen(true);
  };

  return (
    <div className="fx-msg-grid" data-thread-open={mobileThreadOpen} style={{ display: "grid", gridTemplateColumns: "minmax(280px,360px) 1fr", gap: 18, alignItems: "stretch", minHeight: 560 }}>
      <aside
        className="fx-msg-list"
        style={{
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: C.serif, fontSize: 22, fontWeight: 600 }}>Messages</div>
          <div style={{ fontSize: 12.5, color: C.tmut, marginTop: 4 }}>
            Your conversations with each guest — one per booking.
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 26, fontSize: 13, color: C.tmut }}>Loading conversations…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "44px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: C.cyansoft,
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                fontSize: 28,
              }}
            >
              💬
            </div>
            <div style={{ fontFamily: C.serif, fontSize: 20, marginBottom: 6 }}>No messages yet</div>
            <div style={{ fontSize: 13, color: C.tmut, lineHeight: 1.6 }}>
              Guest conversations appear here once a trip is booked.
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {rows.map((c) => {
              const active = c.booking_id === activeId;
              return (
                <button
                  key={c.booking_id}
                  onClick={() => select(c.booking_id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    gap: 13,
                    padding: "15px 18px",
                    cursor: "pointer",
                    color: "inherit",
                    background: active ? C.cyansoft : "transparent",
                    border: 0,
                    borderBottom: `1px solid ${C.line}`,
                    borderLeft: `3px solid ${active ? C.cyan : "transparent"}`,
                  }}
                >
                  <Avatar label={c.customer_name} size={44} />
                  <span style={{ flex: 1, minWidth: 0, display: "block" }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.customer_name}
                      </span>
                      <span style={{ fontSize: 11, color: C.tmut, flex: "none" }}>
                        {relativeTime(c.last_message?.created_at)}
                      </span>
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12.5,
                        color: C.tmut,
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.last_message?.body?.trim() || "No messages yet"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          borderRadius: 30,
                          background: C.cyansoft,
                          border: `1px solid ${C.line}`,
                          padding: "2px 9px",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: ".06em",
                          textTransform: "uppercase",
                          color: C.cyan,
                          maxWidth: "70%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.trip_title}
                      </span>
                      {c.unread_count > 0 && (
                        <span
                          style={{
                            background: C.cyan,
                            color: "#04121B",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 20,
                            padding: "1px 8px",
                          }}
                        >
                          {c.unread_count}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {activeId ? <CaptainThread key={activeId} bookingId={activeId} onBack={() => setMobileThreadOpen(false)} /> : <Placeholder />}
    </div>
  );
}

function Placeholder() {
  return (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "60px 30px",
      }}
    >
      <div
        style={{
          width: 86,
          height: 86,
          borderRadius: "50%",
          background: C.cyansoft,
          display: "grid",
          placeItems: "center",
          marginBottom: 18,
          fontSize: 32,
        }}
      >
        ⚓
      </div>
      <div style={{ fontFamily: C.serif, fontSize: 22, marginBottom: 8 }}>Select a conversation</div>
      <p style={{ fontSize: 13.5, color: C.tmut, lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
        Pick a booking on the left to read the thread and message your guest. Everything stays tied to
        that booking.
      </p>
    </section>
  );
}

function CaptainThread({ bookingId, onBack }: { bookingId: string; onBack?: () => void }) {
  const c = chatPalette("dark");
  const qc = useQueryClient();
  const threadFn = useServerFn(getCaptainThread);
  const sendFn = useServerFn(sendMessage);
  const readFn = useServerFn(markThreadRead);
  const deleteFn = useServerFn(deleteBookingMessage);
  const reactFn = useServerFn(toggleBookingReaction);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["captain-thread", bookingId],
    queryFn: () => threadFn({ data: { bookingId } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["captain-thread", bookingId] });
    qc.invalidateQueries({ queryKey: ["captain-conversations"] });
  };

  useRealtimeTable("booking_messages", `booking_id=eq.${bookingId}`, refresh);

  useEffect(() => {
    readFn({ data: { bookingId } })
      .then(() => qc.invalidateQueries({ queryKey: ["captain-conversations"] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const guestName = (data as any)?.guestName ?? "Guest";
  const guestPhoto = (data as any)?.angler?.avatar_url ?? null;
  const booking: any = (data as any)?.booking ?? null;
  const viewerId: string = (data as any)?.viewerId ?? "";

  const outbox = useOutbox(
    viewerId,
    (body, replyToId, attachment) =>
      sendFn({
        data: {
          bookingId,
          body,
          replyToId,
          attachmentUrl: attachment?.url ?? null,
          attachmentType: attachment?.kind ?? null,
          attachmentDurationMs: attachment?.durationMs ?? null,
        },
      }),
    refresh,
  );

  const serverMessages: ChatMessage[] = ((data as any)?.messages ?? []) as ChatMessage[];
  const allMessages = [...serverMessages, ...outbox.items];
  const byId = new Map(serverMessages.map((m) => [m.id, m]));
  const endRef = useScrollToBottom(allMessages.length);
  const { count, sentinelRef, hasMore } = useGrowOnScroll(allMessages.length, 30);
  const visibleMessages = allMessages.slice(Math.max(0, allMessages.length - count));

  const submit = (attachment?: Attachment | null) => {
    const body = draft.trim();
    if (!body && !attachment) return;
    outbox.push(body, replyTo?.id ?? null, attachment ?? null);
    setDraft("");
    setReplyTo(null);
  };

  let lastDay = "";

  return (
    <section
      className="fx-msg-thread"
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="fx-msg-back"
            style={{
              flex: "none",
              background: "transparent",
              border: `1px solid ${C.line}`,
              color: "inherit",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}
        <ChatAvatar c={c} label={guestName} url={guestPhoto} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{guestName}</div>
          <div style={{ fontSize: 12, color: C.tmut, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[booking?.service?.title, booking?.trip_date, booking?.start_time?.slice(0, 5)]
              .filter(Boolean)
              .join(" · ") || "Booking thread"}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 260,
          overflowY: "auto",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: c.canvas,
        }}
      >
        {isLoading && <div style={{ fontSize: 13, color: C.tmut }}>Loading thread…</div>}
        {!isLoading && allMessages.length === 0 && (
          <div style={{ fontSize: 13, color: C.tmut }}>
            No messages yet — say hello and share what your guest should bring.
          </div>
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
                senderLabel={guestName}
                senderPhoto={guestPhoto}
                replyTo={
                  quoted
                    ? {
                        body: quoted.is_deleted ? null : quoted.body,
                        mine: quoted.sender_id === viewerId,
                        label: guestName,
                      }
                    : null
                }
                reactions={summariseReactions((data as any)?.reactions, m.id, viewerId)}
                onReply={() => setReplyTo(m)}
                onReact={(emoji) =>
                  reactFn({ data: { messageId: m.id, emoji } }).then(refresh).catch(() => {})
                }
                onDelete={
                  mine
                    ? () => deleteFn({ data: { messageId: m.id } }).then(refresh).catch(() => {})
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
            ? { label: replyTo.sender_id === viewerId ? "yourself" : guestName, body: replyTo.body }
            : null
        }
        onCancelReply={() => setReplyTo(null)}
      />
    </section>
  );
}

