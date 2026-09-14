/**
 * Trip-detail page for anglers. Pixel-matched to public/dashboards/trip-detail.html.
 * Renders live booking data via getTripDetail, with real message sending & cancel.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cancelTrip, getRescheduleOptions, getTripDetail, rescheduleTrip, sendTripMessage } from "@/lib/trip-detail.functions";
import { DEFAULT_HERO } from "@/lib/platform-photos";

type Reason = "Weather concerns" | "Plans changed" | "Booked by mistake" | "Something else";
const REASONS: Reason[] = ["Weather concerns", "Plans changed", "Booked by mistake", "Something else"];

const V = {
  serif: "'Outfit',Georgia,serif",
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  navy: "#072057",
  paper: "#ffffff",
  card: "#ffffff",
  sand: "#2DE2F2",
  sandsoft: "#E2F6FA",
  goldtext: "#1F9FBE",
  cyan: "#1f9fbe",
  cyansoft: "#e2eef2",
  green: "#1f8a5b",
  greensoft: "#e2f2ea",
  red: "#d8514a",
  redsoft: "#fbe9e8",
  ond: "#eaf1f6",
  ondmut: "#93a7b7",
  tmut: "#5c6b78",
  line: "rgba(13,34,54,.10)",
  lined: "rgba(255,255,255,.12)",
};

const money = (cents: number | null | undefined) =>
  `$${Math.round((cents ?? 0) / 100).toLocaleString()}`;

const dateLine = (d: string, t: string | null, party: number) => {
  const date = new Date(d + "T00:00:00");
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = t ? new Date(`1970-01-01T${t}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  return `${day}${time ? " · " + time : ""} · ${party} ${party === 1 ? "angler" : "anglers"}`;
};

export function TripDetail({ bookingId }: { bookingId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["trip-detail", bookingId],
    queryFn: () => getTripDetail({ data: { id: bookingId } }),
  });
  const queryClient = useQueryClient();
  const send = useServerFn(sendTripMessage);
  const cancel = useServerFn(cancelTrip);
  const doReschedule = useServerFn(rescheduleTrip);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [reply, setReply] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const b = data.booking;
  const isCanceled = b.status.startsWith("cancelled") || b.status === "refunded" || b.status === "declined";
  const isActive = !isCanceled;
  const canReview = b.status === "completed" || b.status === "reviewed";

  const captain = data.captain;
  const captainName = captain?.display_name ?? captain?.full_name ?? "Your captain";
  const boatName = data.business?.name ?? "the vessel";
  const location = [data.business?.city, data.business?.region].filter(Boolean).join(", ");
  const heroImg = data.service?.hero_url || data.business?.hero_url || DEFAULT_HERO;
  const captainAvatar = captain?.avatar_url || "/dashboards/assets/james.jpg";

  const escrowLabel = money(b.total_cents);

  const sendMutation = useMutation({
    mutationFn: async (body: string) => send({ data: { bookingId, body } }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["trip-detail", bookingId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => cancel({ data: { bookingId, reason: REASONS[cancelReason] } }),
    onSuccess: () => {
      setCancelOpen(false);
      showToast(`Trip canceled — ${escrowLabel} refund issued from escrow`);
      queryClient.invalidateQueries({ queryKey: ["trip-detail", bookingId] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Cancel failed"),
  });

  const canReschedule = isActive && (b.status === "confirmed" || b.status === "pending_confirmation");

  const rescheduleQuery = useQuery({
    queryKey: ["reschedule-options", bookingId],
    queryFn: () => getRescheduleOptions({ data: { bookingId } }),
    enabled: rescheduleOpen,
    staleTime: 15_000,
  });
  const opts = rescheduleQuery.data;

  const rescheduleMutation = useMutation({
    mutationFn: async (slotId: string) => doReschedule({ data: { bookingId, slotId } }),
    onSuccess: () => {
      setRescheduleOpen(false);
      setPickedSlot(null);
      showToast("Trip moved — your captain has been notified");
      queryClient.invalidateQueries({ queryKey: ["trip-detail", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["reschedule-options", bookingId] });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : "Reschedule failed");
      rescheduleQuery.refetch();
    },
  });


  const steps = useMemo(() => {
    return [
      { title: "Reserved", desc: "Booking confirmed by the captain", state: "done" as const },
      {
        title: "Held in escrow",
        desc: `${escrowLabel} secured — the captain can't touch it yet`,
        state: isActive ? ("current" as const) : ("done" as const),
      },
      {
        title: "Trip day",
        desc: `${new Date(b.trip_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · completes when you're back at the dock`,
        state: isActive ? ("todo" as const) : ("skip" as const),
      },
      {
        title: isActive ? "Released to captain" : "Refunded to you",
        desc: isActive
          ? "Payout releases the evening your trip ends"
          : `${escrowLabel} returned — refund issued`,
        state: isActive ? ("todo" as const) : ("done" as const),
      },
    ];
  }, [b.trip_date, escrowLabel, isActive]);

  const statusLabel = isActive
    ? b.status === "pending_payment"
      ? "Awaiting payment"
      : b.status === "pending_confirmation"
      ? "Awaiting captain"
      : "Confirmed · in escrow"
    : "Canceled · refunded";
  const statusColor = isActive ? V.cyan : V.tmut;
  const statusBg = isActive ? V.cyansoft : "rgba(13,34,54,.06)";

  const chipStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: V.ink,
    background: V.paper,
    border: `1px solid ${V.line}`,
    borderRadius: 30,
    padding: "7px 13px",
  };

  const included = data.service?.includes ?? [];
  const chips = included.length ? included : ["Tackle & bait included", "Licenses covered", "Catch cleaned & bagged", "Cooler with ice"];

  return (
    <div
      id="trip-detail"
      style={{
        minHeight: "100vh",
        background: V.paper,
        color: V.ink,
        fontFamily: V.sans,
      }}
    >
      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: V.navy, color: V.ond }}>
        <div style={{ width: "100%", padding: "0 clamp(16px,5vw,80px)", height: 62, display: "flex", alignItems: "center", gap: 22 }}>
          <Link to="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: V.ondmut, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <span>←</span> My Trips
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto" }}>
            <span style={{ width: 10, height: 10, background: V.sand, transform: "rotate(45deg)", display: "inline-block", borderRadius: 1 }} />
            <span style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 19, letterSpacing: ".02em", whiteSpace: "nowrap" }}>FISH-X.COM</span>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${V.lined}`, borderRadius: 30, padding: "8px 14px", fontSize: 11.5, fontWeight: 600, color: V.ond }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.cyan }} /> Escrow-protected
          </span>
        </div>
      </header>

      <main style={{ width: "100%", padding: "28px clamp(16px,5vw,80px) 60px" }}>
        {/* CANCELED BANNER */}
        {isCanceled && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: V.greensoft, border: "1px solid rgba(31,138,91,.3)", borderRadius: 14, padding: "16px 18px", marginBottom: 22 }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: V.green, color: "#fff", display: "grid", placeItems: "center", fontSize: 16, flex: "none" }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: V.ink }}>Trip canceled — refund issued</div>
              <div style={{ fontSize: 13, color: V.tmut, marginTop: 2 }}>
                {escrowLabel} returned from escrow. Nothing was paid to the captain.
              </div>
            </div>
            <Link to="/marketplace" style={{ flex: "none", background: V.navy, color: "#fff", textDecoration: "none", borderRadius: 10, padding: "11px 18px", fontSize: 12.5, fontWeight: 700 }}>
              Rebook a charter
            </Link>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: V.goldtext }}>
              Booking {b.id.slice(0, 8).toUpperCase()}
            </div>
            <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 38, letterSpacing: "-.01em", lineHeight: 1.05, margin: "8px 0", color: V.ink }}>
              {data.service?.title ?? "Charter trip"}
            </h1>
            <div style={{ fontSize: 14, color: V.tmut }}>
              {location ? `${location} · ` : ""}
              {dateLine(b.trip_date, b.start_time, b.party_size)}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 30, padding: "9px 16px", color: statusColor, background: statusBg }}>
            {statusLabel}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 22, alignItems: "start" }}>
          {/* MAIN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
            {/* MEETING */}
            <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, overflow: "hidden" }}>
              <div style={{ position: "relative", height: 150 }}>
                <MediaImg src={heroImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 45%" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,34,54,.1),rgba(10,34,54,.55))" }} />
                <div style={{ position: "absolute", left: 20, bottom: 14, color: "#fff", fontFamily: V.serif, fontSize: 20, fontWeight: 600 }}>
                  Aboard "{boatName}"
                </div>
              </div>
              <div style={{ padding: "22px 24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                  <div style={{ border: `1px solid ${V.line}`, borderRadius: 13, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.tmut, marginBottom: 5 }}>Departure</div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: V.ink }}>
                      {b.start_time ? new Date(`1970-01-01T${b.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD"}
                    </div>
                    <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>
                      {data.service?.duration_minutes ? `${Math.round(data.service.duration_minutes / 60)} hours` : "Duration TBD"}
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${V.line}`, borderRadius: 13, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.tmut, marginBottom: 5 }}>Meeting point</div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: V.ink }}>{data.service?.departure_location ?? "Confirmed on booking"}</div>
                    <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>{location}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {chips.map((c) => (
                    <span key={c} style={chipStyle}>✓ {c}</span>
                  ))}
                </div>
                {b.notes && (
                  <div style={{ fontSize: 13, color: V.tmut, lineHeight: 1.6 }}>
                    <b style={{ color: V.ink }}>Notes:</b> {b.notes}
                  </div>
                )}
              </div>
            </section>

            {/* ESCROW */}
            <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
                <span style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: V.cyansoft, display: "grid", placeItems: "center", color: V.cyan }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <rect x="4" y="10" width="16" height="11" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: V.cyan }}>Escrow status</div>
                  <div style={{ fontFamily: V.serif, fontSize: 19, color: V.ink }}>
                    {isActive ? `${escrowLabel} held securely` : `${escrowLabel} refunded in full`}
                  </div>
                </div>
              </div>
              <div>
                {steps.map((e, i) => {
                  const done = e.state === "done";
                  const cur = e.state === "current";
                  const dotBg = done ? V.green : cur ? V.cyan : "#ffffff";
                  const dotBorder = done || cur ? "0" : "2px solid rgba(13,34,54,.18)";
                  const lineBg = done ? V.green : "rgba(13,34,54,.12)";
                  const titleColor = done || cur ? V.ink : V.tmut;
                  return (
                    <div key={i} style={{ display: "flex", gap: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 22 }}>
                        <span style={{ width: 16, height: 16, borderRadius: "50%", background: dotBg, border: dotBorder, display: "grid", placeItems: "center", color: "#fff", fontSize: 9, flex: "none" }}>
                          {done ? "✓" : ""}
                        </span>
                        {i < steps.length - 1 && (
                          <span style={{ width: 2, flex: 1, minHeight: 26, background: lineBg }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 18, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: titleColor }}>{e.title}</div>
                        <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>{e.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* MESSAGES */}
            <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 22px", borderBottom: `1px solid ${V.line}`, display: "flex", alignItems: "center", gap: 12 }}>
                <MediaImg src={captainAvatar} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: V.ink }}>{captainName}</div>
                  <div style={{ fontSize: 12, color: V.green }}>Usually replies within an hour</div>
                </div>
              </div>
              <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 11, background: V.paper, maxHeight: 320, overflowY: "auto" }}>
                {data.messages.length === 0 && (
                  <div style={{ fontSize: 13, color: V.tmut, textAlign: "center", padding: "20px 0" }}>
                    No messages yet — say hello 👋
                  </div>
                )}
                {data.messages.map((m) => {
                  const me = m.sender_id === data.viewerId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: me ? "flex-end" : "flex-start",
                        maxWidth: "76%",
                        background: me ? V.navy : "#ffffff",
                        color: me ? "#ffffff" : V.ink,
                        border: `1px solid ${me ? V.navy : V.line}`,
                        borderRadius: 13,
                        padding: "10px 14px",
                        fontSize: 13.5,
                        lineHeight: 1.45,
                      }}
                    >
                      {m.body}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "14px 22px", borderTop: `1px solid ${V.line}`, display: "flex", gap: 10 }}>
                <input
                  ref={inputRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && reply.trim()) sendMutation.mutate(reply.trim());
                  }}
                  placeholder="Message your captain…"
                  style={{ flex: 1, background: V.paper, border: `1px solid ${V.line}`, borderRadius: 11, padding: "12px 14px", fontFamily: V.sans, fontSize: 13.5, color: V.ink, outline: "none" }}
                />
                <button
                  onClick={() => reply.trim() && sendMutation.mutate(reply.trim())}
                  disabled={sendMutation.isPending || !reply.trim()}
                  style={{ background: V.sand, color: "#04121B", border: 0, borderRadius: 11, padding: "0 20px", fontFamily: V.sans, fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: sendMutation.isPending ? 0.6 : 1 }}
                >
                  {sendMutation.isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </section>
          </div>

          {/* RAIL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* PAYMENT */}
            <div style={{ background: "linear-gradient(160deg,#0c2a42,#072057)", borderRadius: 20, padding: 24, color: V.ond }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.sand, marginBottom: 14 }}>Payment</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0" }}>
                <span style={{ color: V.ondmut }}>Charter ({b.party_size} {b.party_size === 1 ? "angler" : "anglers"})</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{money((b.total_cents ?? 0) - (b.application_fee_cents ?? 0))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0" }}>
                <span style={{ color: V.ondmut }}>Service & escrow fee</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{money(b.application_fee_cents)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "12px 0 0", borderTop: "1px solid rgba(255,255,255,.12)", marginTop: 8 }}>
                <span style={{ fontWeight: 700, color: "#fff" }}>Total</span>
                <span style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600, color: V.sand }}>{escrowLabel}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 11, padding: "11px 13px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: V.cyan, flex: "none" }} />
                <span style={{ fontSize: 12, color: V.ond }}>
                  {isActive ? "Held in escrow — released only after your trip" : "Refunded to your card"}
                </span>
              </div>
            </div>

            {/* CAPTAIN */}
            <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                <MediaImg src={captainAvatar} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: `1px solid ${V.line}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: V.ink }}>{captainName}</div>
                  <div style={{ fontSize: 12.5, color: V.tmut }}>
                    <span style={{ color: V.sand }}>★</span> Verified captain
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {data.business?.slug && (
                  <Link
                    to="/b/$slug"
                    params={{ slug: data.business.slug }}
                    style={{ flex: 1, textAlign: "center", background: "transparent", border: `1px solid ${V.line}`, borderRadius: 10, padding: 11, fontSize: 12.5, fontWeight: 600, color: V.ink, textDecoration: "none" }}
                  >
                    View profile
                  </Link>
                )}
                <button
                  onClick={() => inputRef.current?.focus()}
                  style={{ flex: 1, background: V.navy, color: "#fff", border: 0, borderRadius: 10, padding: 11, fontFamily: V.sans, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Message
                </button>
              </div>
            </div>

            {/* ACTIONS */}
            {isActive && (
              <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: "10px 22px" }}>
                <button
                  onClick={() => showToast("Added to your calendar")}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: 0, borderBottom: `1px solid ${V.line}`, padding: "15px 0", cursor: "pointer", fontFamily: V.sans, fontSize: 13.5, fontWeight: 600, color: V.ink, textAlign: "left" }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 9, background: V.paper, border: `1px solid ${V.line}`, display: "grid", placeItems: "center", flex: "none" }}>📅</span>
                  Add to calendar
                </button>
                <Link
                  to="/resolution-center"
                  search={{ booking: bookingId }}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", borderBottom: `1px solid ${V.line}`, padding: "15px 0", cursor: "pointer", fontFamily: V.sans, fontSize: 13.5, fontWeight: 600, color: V.ink, textAlign: "left", textDecoration: "none" }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 9, background: V.paper, border: `1px solid ${V.line}`, display: "grid", placeItems: "center", flex: "none" }}>⚑</span>
                  Report an issue
                </Link>
                {canReview && (
                  <Link
                    to="/review"
                    search={{ booking: bookingId }}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", borderBottom: `1px solid ${V.line}`, padding: "15px 0", cursor: "pointer", fontFamily: V.sans, fontSize: 13.5, fontWeight: 600, color: V.ink, textAlign: "left", textDecoration: "none" }}
                  >
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: V.sandsoft, display: "grid", placeItems: "center", flex: "none" }}>★</span>
                    {b.status === "reviewed" ? "View your review" : "Leave a review"}
                  </Link>
                )}
                {canReschedule && (
                  <button
                    onClick={() => setRescheduleOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: 0, borderBottom: `1px solid ${V.line}`, padding: "15px 0", cursor: "pointer", fontFamily: V.sans, fontSize: 13.5, fontWeight: 600, color: V.ink, textAlign: "left" }}
                  >
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: V.cyansoft, display: "grid", placeItems: "center", flex: "none", color: V.cyan }}>⇄</span>
                    Reschedule trip
                  </button>
                )}
                <button
                  onClick={() => setCancelOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: 0, padding: "15px 0", cursor: "pointer", fontFamily: V.sans, fontSize: 13.5, fontWeight: 600, color: V.red, textAlign: "left" }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 9, background: V.redsoft, display: "grid", placeItems: "center", flex: "none", color: V.red }}>✕</span>
                  Cancel trip
                </button>
              </div>
            )}

            {/* POLICY */}
            <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: "20px 22px" }}>
              <div style={{ fontFamily: V.serif, fontSize: 16.5, color: V.ink, marginBottom: 10 }}>Cancellation policy</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["7+ days out", "Full deposit refund, or move to any open date free."],
                  ["Captain-declared weather call", "Full refund or a free reschedule, your choice."],
                  ["Inside 48 hours or no-show", "Deposit forfeited — message your captain for options."],
                ].map(([t, d]) => (
                  <div key={t} style={{ fontSize: 12.5, lineHeight: 1.55, color: V.tmut }}>
                    <b style={{ color: V.ink }}>{t}</b>
                    <br />
                    {d}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* CANCEL MODAL */}
      {cancelOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,21,31,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 470, background: V.card, borderRadius: 22, padding: 28, boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h2 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 25, margin: 0, color: V.ink }}>Cancel this trip?</h2>
              <button
                onClick={() => setCancelOpen(false)}
                style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${V.line}`, background: "transparent", cursor: "pointer", color: V.tmut, fontSize: 14 }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: V.tmut, margin: "0 0 18px", lineHeight: 1.55 }}>
              Your full <b style={{ color: V.ink }}>{escrowLabel}</b> comes straight back from escrow.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {REASONS.map((label, i) => {
                const on = cancelReason === i;
                return (
                  <button
                    key={label}
                    onClick={() => setCancelReason(i)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: on ? "rgba(45,226,242,.12)" : "transparent", border: `1px solid ${on ? V.sand : "rgba(13,34,54,.12)"}`, borderRadius: 12, padding: "13px 15px", cursor: "pointer", fontFamily: V.sans }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? V.goldtext : "rgba(13,34,54,.25)"}`, display: "grid", placeItems: "center", flex: "none" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? V.goldtext : "transparent" }} />
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: V.ink }}>{label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", background: V.greensoft, border: "1px solid rgba(31,138,91,.25)", borderRadius: 12, padding: "13px 16px", marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.ink }}>Refund to your card</span>
              <span style={{ fontFamily: V.serif, fontSize: 17, fontWeight: 600, color: V.green }}>{escrowLabel}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setCancelOpen(false)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${V.line}`, borderRadius: 12, padding: 14, fontFamily: V.sans, fontSize: 13, fontWeight: 600, color: V.ink, cursor: "pointer" }}
              >
                Keep my trip
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                style={{ flex: 1, background: V.red, color: "#fff", border: 0, borderRadius: 12, padding: 14, fontFamily: V.sans, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: cancelMutation.isPending ? 0.6 : 1 }}
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel & refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,21,31,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", background: V.card, borderRadius: 22, padding: 28, boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h2 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 25, margin: 0, color: V.ink }}>Move this trip</h2>
              <button
                onClick={() => setRescheduleOpen(false)}
                style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${V.line}`, background: "transparent", cursor: "pointer", color: V.tmut, fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            {rescheduleQuery.isLoading && (
              <p style={{ fontSize: 13.5, color: V.tmut }}>Checking the captain's open departures…</p>
            )}

            {opts && (
              <>
                <div style={{ background: opts.reschedulable ? V.greensoft : V.redsoft, border: `1px solid ${opts.reschedulable ? "rgba(31,138,91,.25)" : "rgba(216,81,74,.25)"}`, borderRadius: 14, padding: "13px 16px", margin: "10px 0 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: opts.reschedulable ? V.green : V.red, marginBottom: 4 }}>
                    {opts.reschedulable
                      ? opts.freeWindow
                        ? "7+ days out — free move, deposit travels with you"
                        : "Inside 7 days — one courtesy move, deposit stays in escrow"
                      : opts.hoursUntil < 48
                        ? "Inside 48 hours — self-serve moves are closed"
                        : "No moves left on this booking"}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: V.tmut }}>
                    {opts.reschedulable
                      ? `Your ${money(opts.depositCents)} deposit carries over — nothing new is charged. ${opts.reschedulesAllowed - opts.reschedulesUsed} of ${opts.reschedulesAllowed} moves remaining.`
                      : "Message your captain right here on this trip and they can move you manually or declare a weather call."}
                  </div>
                </div>

                {opts.reschedulable && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: V.tmut, marginBottom: 10 }}>
                      Open departures
                    </div>
                    {opts.slots.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: V.tmut }}>
                        This captain has no other open departures right now. Message them and they'll release a date for you.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                        {opts.slots.map((s) => {
                          const start = new Date(s.starts_at);
                          const end = new Date(s.ends_at);
                          const on = pickedSlot === s.id;
                          const seatsLeft = s.seats_available - s.seats_booked;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setPickedSlot(s.id)}
                              style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: on ? "rgba(45,226,242,.12)" : "transparent", border: `1px solid ${on ? V.sand : "rgba(13,34,54,.12)"}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", fontFamily: V.sans }}
                            >
                              <span style={{ width: 52, flex: "none", textAlign: "center", background: V.paper, border: `1px solid ${V.line}`, borderRadius: 10, padding: "6px 0" }}>
                                <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: V.tmut }}>
                                  {start.toLocaleDateString("en-US", { month: "short" })}
                                </span>
                                <span style={{ display: "block", fontFamily: V.serif, fontSize: 19, fontWeight: 600, color: V.ink }}>
                                  {start.getDate()}
                                </span>
                              </span>
                              <span style={{ flex: 1 }}>
                                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: V.ink }}>
                                  {start.toLocaleDateString("en-US", { weekday: "long" })} ·{" "}
                                  {start.getHours() < 12 ? "Morning" : "Afternoon"}
                                </span>
                                <span style={{ display: "block", fontSize: 12.5, color: V.tmut, marginTop: 2 }}>
                                  {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} –{" "}
                                  {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ·{" "}
                                  {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} open
                                </span>
                              </span>
                              <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? V.goldtext : "rgba(13,34,54,.25)"}`, display: "grid", placeItems: "center", flex: "none" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? V.goldtext : "transparent" }} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => setRescheduleOpen(false)}
                    style={{ flex: 1, background: "transparent", border: `1px solid ${V.line}`, borderRadius: 12, padding: 14, fontFamily: V.sans, fontSize: 13, fontWeight: 600, color: V.ink, cursor: "pointer" }}
                  >
                    Keep my date
                  </button>
                  <button
                    onClick={() => pickedSlot && rescheduleMutation.mutate(pickedSlot)}
                    disabled={!opts.reschedulable || !pickedSlot || rescheduleMutation.isPending}
                    style={{ flex: 1, background: V.navy, color: "#fff", border: 0, borderRadius: 12, padding: 14, fontFamily: V.sans, fontSize: 13, fontWeight: 700, cursor: !opts.reschedulable || !pickedSlot ? "not-allowed" : "pointer", opacity: !opts.reschedulable || !pickedSlot || rescheduleMutation.isPending ? 0.5 : 1 }}
                  >
                    {rescheduleMutation.isPending ? "Moving…" : "Confirm new date"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TOAST */}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 80, display: "flex", alignItems: "center", gap: 11, background: V.navy, color: "#fff", border: "1px solid rgba(255,255,255,.12)", borderRadius: 30, padding: "13px 22px", boxShadow: "0 20px 44px -20px rgba(0,0,0,.6)" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: V.green, display: "grid", placeItems: "center", fontSize: 12 }}>✓</span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{toast}</span>
        </div>
      )}
    </div>
  );
}

// Note: parent query key must match TripDetail's for useMutation invalidations.
export function useTripDetailQuery(id: string) {
  return useQuery({ queryKey: ["trip-detail", id], queryFn: () => getTripDetail({ data: { id } }) });
}
