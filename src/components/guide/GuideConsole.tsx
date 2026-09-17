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
/* Trip payouts                                                        */
/* ------------------------------------------------------------------ */

const escrowTone: Record<string, "green" | "cyan" | "gold" | "muted"> = {
  released: "green",
  held: "gold",
  refunded: "muted",
  frozen: "gold",
};

export function GuideTripPayouts({ trips }: { trips: any[] }) {
  const rows = (trips ?? []).filter((t) => !dead.has(t.status));
  const held = rows.filter((t) => t.escrow_state === "held").reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const released = rows.filter((t) => t.escrow_state === "released").reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const upcoming = rows.filter((t) => new Date(t.trip_date) >= new Date()).reduce((a, t) => a + (t.total_cents ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <KPICard label="In escrow" value={money(held)} />
        <KPICard label="Released to you" value={money(released)} />
        <KPICard label="Upcoming trip value" value={money(upcoming)} />
      </div>
      <Card eyebrow="Per trip" title="Trip payouts">
        {rows.length === 0 ? (
          <Empty>No trips with payments yet.</Empty>
        ) : (
          rows.map((t) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr auto auto auto", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: LINE }}>
              <span>
                <strong style={{ display: "block" }}>{t.angler?.display_name || t.angler?.full_name || "Angler"}</strong>
                <small style={{ color: "#92A0AB" }}>{t.party_size} anglers · {t.guide?.display_name || t.guide?.full_name || "Unassigned"}</small>
              </span>
              <span style={{ color: "#92A0AB" }}>{t.trip_date} · {timeLabel(t.start_time)}</span>
              <StatusPill label={t.status} tone={t.status === "completed" ? "green" : "cyan"} />
              <StatusPill label={t.escrow_state ?? "pending"} tone={escrowTone[t.escrow_state] ?? "muted"} />
              <strong>{money(t.total_cents ?? 0)}</strong>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Guest list                                                          */
/* ------------------------------------------------------------------ */

export function GuideGuests({ trips }: { trips: any[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const guests = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of trips ?? []) {
      if (!t.angler_id) continue;
      const key = t.angler_id;
      const cur = map.get(key) ?? {
        id: key,
        name: t.angler?.display_name || t.angler?.full_name || "Angler",
        trips: [] as any[],
        totalCents: 0,
        anglersBrought: 0,
      };
      cur.trips.push(t);
      if (!dead.has(t.status)) {
        cur.totalCents += t.total_cents ?? 0;
        cur.anglersBrought += t.party_size ?? 0;
      }
      map.set(key, cur);
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.trips[0]?.trip_date ?? 0).getTime() - new Date(a.trips[0]?.trip_date ?? 0).getTime(),
    );
  }, [trips]);

  const filtered = guests.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
  const guest = guests.find((g) => g.id === open);

  if (guest) {
    return (
      <Card title={guest.name} right={<button style={navBtn} onClick={() => setOpen(null)}>Back to guests</button>}>
        <div style={{ color: "#92A0AB", fontSize: 13, marginBottom: 12 }}>
          {guest.trips.length} booking{guest.trips.length === 1 ? "" : "s"} · {guest.anglersBrought} anglers brought · {money(guest.totalCents)} booked
        </div>
        {guest.trips.map((t: any) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: LINE }}>
            <span>
              {t.trip_date} · {timeLabel(t.start_time)}
              {t.notes ? <small style={{ display: "block", color: "#92A0AB" }}>{t.notes}</small> : null}
            </span>
            <StatusPill label={t.status} tone={t.status === "completed" ? "green" : dead.has(t.status) ? "muted" : "cyan"} />
            <strong>{money(t.total_cents ?? 0)}</strong>
          </div>
        ))}
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <KPICard label="Guests" value={String(guests.length)} />
        <KPICard label="Repeat guests" value={String(guests.filter((g) => g.trips.length > 1).length)} />
        <KPICard label="Anglers hosted" value={String(guests.reduce((a, g) => a + g.anglersBrought, 0))} />
      </div>
      <Card title="Guest list">
        <input
          aria-label="Search guests"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guests by name"
          style={{ width: "100%", marginBottom: 12, border: "1px solid rgba(255,255,255,.09)", borderRadius: 8, padding: "10px 12px", background: "#0D161F", color: "#F0F2F5", font: "inherit" }}
        />
        {filtered.length === 0 ? (
          <Empty>No guests yet — they appear here after their first booking.</Empty>
        ) : (
          filtered.map((g) => (
            <button
              key={g.id}
              onClick={() => setOpen(g.id)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "minmax(150px,1fr) auto auto auto",
                gap: 14,
                alignItems: "center",
                padding: "14px 4px",
                border: 0,
                borderBottom: LINE,
                background: "transparent",
                color: "#F0F2F5",
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <span><strong>{g.name}</strong></span>
              <span style={{ color: "#92A0AB" }}>{g.trips.length} trip{g.trips.length === 1 ? "" : "s"}</span>
              <span style={{ color: "#92A0AB" }}>{g.trips[0]?.trip_date ?? "—"}</span>
              <strong>{money(g.totalCents)}</strong>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  padding: "7px 12px",
  background: "transparent",
  color: "#F0F2F5",
  cursor: "pointer",
  font: "inherit",
};
