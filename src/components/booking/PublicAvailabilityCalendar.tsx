/**
 * Public-facing availability calendar for a single listing.
 *
 * Reads published slots through an anonymous server function so signed-out
 * anglers can see released days, seats left and whether the day qualifies for
 * instant book (instant book is capped by the seats the operator published).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicServiceAvailability } from "@/lib/businesses.functions";

export type PublicSlot = {
  id: string;
  startsAt: string;
  endsAt?: string | null;
  seatsLeft: number;
  seatsTotal: number;
  priceCents: number;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const THEMES = {
  dark: {
    text: "#f4f7fa",
    muted: "rgba(244,247,250,.58)",
    line: "rgba(255,255,255,.14)",
    cell: "rgba(255,255,255,.04)",
    open: "rgba(78,201,142,.16)",
    selBg: "#e9c46a",
    selText: "#04121B",
    accent: "#4ec98e",
  },
  light: {
    text: "#031029",
    muted: "#7b8b99",
    line: "rgba(13,34,54,.12)",
    cell: "#fbfcfd",
    open: "rgba(31,122,77,.10)",
    selBg: "#072057",
    selText: "#fff",
    accent: "#1f7a4d",
  },
} as const;

type Palette = { text: string; muted: string; line: string; cell: string; open: string; selBg: string; selText: string; accent: string };

const money = (c: number) => `$${Math.round((c ?? 0) / 100).toLocaleString()}`;
const hhmm = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** A departure is an exclusive time block — show the whole window, not just the start. */
export const timeBlock = (s: { startsAt: string; endsAt?: string | null }) => {
  const start = new Date(s.startsAt);
  if (!s.endsAt) return hhmm(start);
  const end = new Date(s.endsAt);
  const hrs = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10;
  return `${hhmm(start)} – ${hhmm(end)} · ${hrs}h`;
};

export function PublicAvailabilityCalendar({
  serviceId,
  selectedSlotId,
  onSelectSlot,
  theme = "dark",
  partySize = 1,
}: {
  serviceId: string;
  selectedSlotId?: string | null;
  onSelectSlot?: (slot: PublicSlot) => void;
  theme?: "dark" | "light";
  partySize?: number;
}) {
  const T: Palette = THEMES[theme];
  const { data, isLoading } = useQuery({
    queryKey: ["public-availability", serviceId],
    queryFn: () => getPublicServiceAvailability({ data: { serviceId } }),
    staleTime: 60_000,
  });

  const slots = (data?.slots ?? []) as PublicSlot[];
  const instantBook = data?.instantBook !== false;

  const byDate = useMemo(() => {
    const m = new Map<string, PublicSlot[]>();
    for (const s of slots) {
      const k = iso(new Date(s.startsAt));
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [slots]);

  const firstDate = slots[0] ? new Date(slots[0].startsAt) : new Date();
  const [cursor, setCursor] = useState(() => new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Jump to the month holding the first released day once data arrives.
  useEffect(() => {
    if (!slots.length) return;
    const d = new Date(slots[0].startsAt);
    setCursor((c) =>
      c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
        ? c
        : new Date(d.getFullYear(), d.getMonth(), 1),
    );
    setActiveDate((a) => a ?? iso(d));
  }, [slots.length]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(first.getDay()).fill(null);
    for (let i = 1; i <= days; i++) out.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), i)));
    return out;
  }, [cursor]);

  const dayShown = activeDate ? (byDate.get(activeDate) ?? []) : [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          Availability calendar
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: instantBook ? T.accent : T.muted,
          }}
        >
          {instantBook ? "Instant book" : `Request · ${data?.acceptWindowHours ?? 24}h reply`}
        </span>
      </div>

      <div
        style={{
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            style={navBtn(T)}
          >
            ‹
          </button>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <button
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            style={navBtn(T)}
          >
            ›
          </button>
        </div>

        <div
          className="fx-calendar-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}
        >
          {DAY_NAMES.map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.muted }}>
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const daySlots = byDate.get(d) ?? [];
            const seats = daySlots.reduce((n, s) => n + s.seatsLeft, 0);
            const open = daySlots.length > 0;
            const selected = activeDate === d && open;
            const fits = seats >= partySize;
            return (
              <button
                key={d}
                disabled={!open}
                onClick={() => {
                  setActiveDate(d);
                  const first = daySlots.find((s) => s.seatsLeft >= partySize) ?? daySlots[0];
                  if (first) onSelectSlot?.(first);
                }}
                title={open ? `${seats} seat${seats === 1 ? "" : "s"} left` : "No departures"}
                style={{
                  padding: "7px 0 5px",
                  borderRadius: 10,
                  border: selected ? `1px solid ${T.selBg}` : `1px solid ${T.line}`,
                  background: selected ? T.selBg : open ? T.open : T.cell,
                  color: selected ? T.selText : open ? T.text : T.muted,
                  opacity: open ? 1 : 0.45,
                  cursor: open ? "pointer" : "default",
                  display: "grid",
                  gap: 2,
                  justifyItems: "center",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                {Number(d.slice(-2))}
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".02em" }}>
                  {open ? (fits ? `${seats}` : "full") : "\u00a0"}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: T.muted }}>
          Each departure is an exclusive time block — once it's booked the operator can't be
          booked again until they're back at the dock. Numbers show seats still open. {instantBook
            ? "Instant book confirms immediately, up to the seats published for that day."
            : "This operator reviews each request before confirming."}
        </div>
      </div>

      {isLoading && <div style={{ fontSize: 12.5, color: T.muted }}>Loading dates…</div>}
      {!isLoading && slots.length === 0 && (
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            color: T.muted,
            border: `1px solid ${T.line}`,
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <strong style={{ color: T.text, display: "block", fontSize: 13 }}>
            No departures released yet
          </strong>
          This operator hasn&rsquo;t opened dates for this listing. Message them to request a date and
          they can release it for you.
        </div>
      )}


      {dayShown.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {dayShown.map((s) => {
            const active = s.id === selectedSlotId;
            const eligible = instantBook && s.seatsLeft >= partySize;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSlot?.(s)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  border: active ? `1px solid ${T.selBg}` : `1px solid ${T.line}`,
                  background: active ? T.open : T.cell,
                  color: T.text,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{timeBlock(s)}</span>
                <span style={{ fontSize: 12, color: T.muted }}>
                  {s.seatsLeft} of {s.seatsTotal} seats left
                </span>
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>
                  {money(s.priceCents)}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: eligible ? T.accent : T.muted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {eligible ? "Instant" : "Request"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn = (T: Palette) => ({
  background: "transparent",
  border: `1px solid ${T.line}`,
  borderRadius: 9,
  color: T.text,
  cursor: "pointer",
  fontSize: 15,
  lineHeight: 1,
  padding: "5px 10px",
});
