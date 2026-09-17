/**
 * Guide console panels built on the guide overview payload:
 *  - GuideAvailabilityCalendar: month grid of bookable availability slots.
 *  - GuideTripPayouts: per-trip money view (escrow, released, refunded).
 *  - GuideGuests: guest list aggregated from this guide service's bookings.
 * All figures come from real bookings and availability rows — nothing invented.
 */
import { useMemo, useState } from "react";
import { Card, KPICard, StatusPill, money } from "@/components/operator/OperatorShell";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LINE = "1px solid rgba(255,255,255,.07)";

const dead = new Set(["cancelled_angler", "cancelled_captain", "declined", "expired"]);

function timeLabel(t: string | null | undefined) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hh = Number(h ?? 0);
  const suffix = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m ?? "00"}${suffix}`;
}

function dayKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 28, textAlign: "center", color: "#92A0AB", fontSize: 14 }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Availability calendar                                               */
/* ------------------------------------------------------------------ */

export function GuideAvailabilityCalendar({ slots }: { slots: any[] }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const base = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  }, [offset]);

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of slots ?? []) (map[s.slot_date] ||= []).push(s);
    return map;
  }, [slots]);

  const cells = useMemo(() => {
    const start = new Date(base);
    start.setUTCDate(1 - base.getUTCDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [base]);

  const monthLabel = base.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const daySlots = selected ? byDay[selected] ?? [] : null;
  const monthSlots = (slots ?? []).filter((s) => s.slot_date?.startsWith(`${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`));
  const openSeats = monthSlots.reduce((a, s) => a + Math.max(0, (s.capacity ?? 0) - (s.booked_count ?? 0)), 0);
  const bookedSeats = monthSlots.reduce((a, s) => a + (s.booked_count ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <KPICard label="Slots this month" value={String(monthSlots.length)} />
        <KPICard label="Seats booked" value={String(bookedSeats)} />
        <KPICard label="Seats still open" value={String(openSeats)} />
      </div>

      <Card
        eyebrow="Availability"
        title={monthLabel}
        right={
          <span style={{ display: "flex", gap: 8 }}>
            <button style={navBtn} onClick={() => { setOffset((o) => o - 1); setSelected(null); }}>←</button>
            <button style={navBtn} onClick={() => { setOffset(0); setSelected(null); }}>Today</button>
            <button style={navBtn} onClick={() => { setOffset((o) => o + 1); setSelected(null); }}>→</button>
          </span>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {DAY_LABELS.map((d) => (
            <div key={d} style={{ fontSize: 11, color: "#92A0AB", textAlign: "center", padding: "4px 0" }}>{d}</div>
          ))}
          {cells.map((d) => {
            const key = dayKey(d);
            const inMonth = d.getUTCMonth() === base.getUTCMonth();
            const items = byDay[key] ?? [];
            const booked = items.reduce((a, s) => a + (s.booked_count ?? 0), 0);
            const cap = items.reduce((a, s) => a + (s.capacity ?? 0), 0);
            const full = cap > 0 && booked >= cap;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(items.length ? key : null)}
                style={{
                  minHeight: 66,
                  borderRadius: 10,
                  border: `1px solid ${selected === key ? "#2DE2F2" : "rgba(255,255,255,.07)"}`,
                  background: inMonth ? "#14202B" : "rgba(20,32,43,.4)",
                  color: inMonth ? "#F0F2F5" : "#5D6B77",
                  padding: 7,
                  textAlign: "left",
                  cursor: items.length ? "pointer" : "default",
                  font: "inherit",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{d.getUTCDate()}</div>
                {items.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 11, color: full ? "#F8B57A" : "#2DE2F2" }}>
                    {items.length} slot{items.length === 1 ? "" : "s"}
                    <div style={{ color: "#92A0AB" }}>{booked}/{cap} seats</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {daySlots && (
        <Card
          eyebrow="Selected day"
          title={new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
          right={<button style={navBtn} onClick={() => setSelected(null)}>Close</button>}
        >
          {daySlots.length === 0 ? (
            <Empty>No slots on this day.</Empty>
          ) : (
            daySlots.map((s: any) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: LINE }}>
                <span>{timeLabel(s.start_time)} – {timeLabel(s.end_time)}{s.notes ? ` · ${s.notes}` : ""}</span>
                <span style={{ color: "#92A0AB" }}>{s.booked_count ?? 0}/{s.capacity ?? 0} seats</span>
                <strong>{money(s.price_cents ?? 0)}</strong>
                <StatusPill label={s.status} tone={s.status === "open" ? "green" : "muted"} />
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trip payouts + guests — shared with the other operator consoles      */
/* ------------------------------------------------------------------ */

export { TripPayouts as GuideTripPayouts, GuestList as GuideGuests } from "@/components/operator/ConsolePanels";


const navBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  padding: "7px 12px",
  background: "transparent",
  color: "#F0F2F5",
  cursor: "pointer",
  font: "inherit",
};
