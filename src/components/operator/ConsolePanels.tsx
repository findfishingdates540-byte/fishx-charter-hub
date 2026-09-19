/**
 * Shared operator console panels (guides, marinas, and any other business that
 * takes bookings on the same spine):
 *  - BookingCalendar: month grid of real bookings by trip date.
 *  - TripPayouts: per-booking money view (escrow held, released, upcoming).
 *  - GuestList: guests aggregated from bookings, with the angler's own
 *    profile details (bio, home port, target species) and trip history.
 * Every figure is derived from the bookings passed in — nothing invented.
 */
import { useMemo, useState } from "react";
import { Card, KPICard, StatusPill, money } from "@/components/operator/OperatorShell";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LINE = "1px solid rgba(255,255,255,.07)";

export const deadStatuses = new Set([
  "cancelled_angler",
  "cancelled_captain",
  "declined",
  "expired",
]);

export function timeLabel(t: string | null | undefined) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hh = Number(h ?? 0);
  const suffix = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m ?? "00"}${suffix}`;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 28, textAlign: "center", color: "#92A0AB", fontSize: 14 }}>{children}</div>
  );
}

export const navBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  padding: "7px 12px",
  background: "transparent",
  color: "#F0F2F5",
  cursor: "pointer",
  font: "inherit",
};

const escrowTone: Record<string, "green" | "cyan" | "gold" | "muted"> = {
  released: "green",
  held: "gold",
  refunded: "muted",
  frozen: "gold",
};

const guestName = (t: any) =>
  t?.angler?.display_name || t?.angler?.full_name || t?.guest_name || "Angler";

/* ------------------------------------------------------------------ */
/* Booking calendar                                                     */
/* ------------------------------------------------------------------ */

export function BookingCalendar({
  trips,
  title = "Booking calendar",
  eyebrow = "Schedule",
}: {
  trips: any[];
  title?: string;
  eyebrow?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const base = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  }, [offset]);

  const live = useMemo(
    () => (trips ?? []).filter((t) => t?.trip_date && !deadStatuses.has(t.status)),
    [trips],
  );

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of live) (map[String(t.trip_date).slice(0, 10)] ||= []).push(t);
    return map;
  }, [live]);

  const cells = useMemo(() => {
    const start = new Date(base);
    start.setUTCDate(1 - base.getUTCDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [base]);

  const monthPrefix = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthTrips = live.filter((t) => String(t.trip_date).startsWith(monthPrefix));
  const monthValue = monthTrips.reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const monthGuests = monthTrips.reduce((a, t) => a + (t.party_size ?? 0), 0);
  const monthLabel = base.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const daySelection = selected ? byDay[selected] ?? [] : null;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <KPICard label="Bookings this month" value={String(monthTrips.length)} />
        <KPICard label="Guests booked" value={String(monthGuests)} />
        <KPICard label="Booked value" value={money(monthValue)} />
      </div>

      <Card
        eyebrow={eyebrow}
        title={title}
        right={
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={navBtn} onClick={() => setOffset((o) => o - 1)}>←</button>
            <strong style={{ minWidth: 150, textAlign: "center" }}>{monthLabel}</strong>
            <button style={navBtn} onClick={() => setOffset((o) => o + 1)}>→</button>
          </span>
        }
      >
        <div className="fx-calendar-grid fx-calendar-grid-detailed" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {DAY_LABELS.map((d) => (
            <div key={d} style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#92A0AB", textAlign: "center", paddingBottom: 6 }}>
              {d}
            </div>
          ))}
          {cells.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const dayTrips = byDay[key] ?? [];
            const inMonth = d.getUTCMonth() === base.getUTCMonth();
            return (
              <button
                key={key}
                onClick={() => setSelected(dayTrips.length ? key : null)}
                style={{
                  minHeight: 74,
                  textAlign: "left",
                  padding: 8,
                  borderRadius: 10,
                  border: selected === key ? "1px solid #2DE2F2" : "1px solid rgba(255,255,255,.06)",
                  background: inMonth ? "#14202B" : "transparent",
                  opacity: inMonth ? 1 : 0.4,
                  color: "#F0F2F5",
                  cursor: dayTrips.length ? "pointer" : "default",
                  font: "inherit",
                }}
              >
                <div style={{ fontSize: 12, color: "#92A0AB" }}>{d.getUTCDate()}</div>
                {dayTrips.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    <strong style={{ color: "#2DE2F2" }}>
                      {dayTrips.length} booking{dayTrips.length === 1 ? "" : "s"}
                    </strong>
                    <div style={{ color: "#92A0AB" }}>
                      {dayTrips.reduce((a, t) => a + (t.party_size ?? 0), 0)} guests
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {daySelection && (
        <Card
          eyebrow="Selected day"
          title={new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}
          right={<button style={navBtn} onClick={() => setSelected(null)}>Close</button>}
        >
          {daySelection.length === 0 ? (
            <Empty>No bookings on this day.</Empty>
          ) : (
            daySelection.map((t: any) => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: LINE }}>
                <span>
                  <strong style={{ display: "block" }}>{guestName(t)}</strong>
                  <small style={{ color: "#92A0AB" }}>
                    {t.service?.title ?? "Booking"} · {t.party_size ?? 1} guest(s)
                  </small>
                </span>
                <span style={{ color: "#92A0AB" }}>{timeLabel(t.start_time)}</span>
                <StatusPill label={t.status} tone={t.status === "completed" ? "green" : "cyan"} />
                <strong>{money(t.total_cents ?? 0)}</strong>
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

export function TripPayouts({ trips }: { trips: any[] }) {
  const rows = (trips ?? []).filter((t) => !deadStatuses.has(t.status));
  const held = rows
    .filter((t) => t.escrow_state === "held")
    .reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const released = rows
    .filter((t) => t.escrow_state === "released")
    .reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const upcoming = rows
    .filter((t) => new Date(t.trip_date) >= new Date())
    .reduce((a, t) => a + (t.total_cents ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <KPICard label="In escrow" value={money(held)} />
        <KPICard label="Released to you" value={money(released)} />
        <KPICard label="Upcoming booked value" value={money(upcoming)} />
      </div>
      <Card eyebrow="Per booking" title="Payout tracking">
        {rows.length === 0 ? (
          <Empty>No bookings with payments yet.</Empty>
        ) : (
          rows.map((t) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr auto auto auto", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: LINE }}>
              <span>
                <strong style={{ display: "block" }}>{guestName(t)}</strong>
                <small style={{ color: "#92A0AB" }}>
                  {t.party_size ?? 1} guest(s)
                  {t.guide ? ` · ${t.guide.display_name || t.guide.full_name}` : ""}
                </small>
              </span>
              <span style={{ color: "#92A0AB" }}>
                {t.trip_date} · {timeLabel(t.start_time)}
              </span>
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

export function GuestList({ trips }: { trips: any[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const guests = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of trips ?? []) {
      if (!t.angler_id) continue;
      const cur = map.get(t.angler_id) ?? {
        id: t.angler_id,
        name: guestName(t),
        profile: t.angler ?? null,
        trips: [] as any[],
        totalCents: 0,
        anglersBrought: 0,
      };
      if (!cur.profile && t.angler) cur.profile = t.angler;
      cur.trips.push(t);
      if (!deadStatuses.has(t.status)) {
        cur.totalCents += t.total_cents ?? 0;
        cur.anglersBrought += t.party_size ?? 0;
      }
      map.set(t.angler_id, cur);
    }
    return [...map.values()].sort(
      (a, b) =>
        new Date(b.trips[0]?.trip_date ?? 0).getTime() -
        new Date(a.trips[0]?.trip_date ?? 0).getTime(),
    );
  }, [trips]);

  const filtered = guests.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
  const guest = guests.find((g) => g.id === open);

  if (guest) {
    const p = guest.profile ?? {};
    return (
      <Card
        title={guest.name}
        right={<button style={navBtn} onClick={() => setOpen(null)}>Back to guests</button>}
      >
        <div style={{ color: "#92A0AB", fontSize: 13, marginBottom: 14 }}>
          {guest.trips.length} booking{guest.trips.length === 1 ? "" : "s"} ·{" "}
          {guest.anglersBrought} anglers brought · {money(guest.totalCents)} booked
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
          <ProfileFact label="Home port" value={p.home_port} />
          <ProfileFact label="Target species" value={p.favorite_species} />
          <ProfileFact label="Phone" value={p.phone} />
        </div>
        {p.bio ? (
          <p style={{ margin: "0 0 18px", color: "#C6CFD6", fontSize: 13.5, lineHeight: 1.6 }}>{p.bio}</p>
        ) : (
          <p style={{ margin: "0 0 18px", color: "#92A0AB", fontSize: 13 }}>
            This angler hasn’t written a bio yet.
          </p>
        )}

        {guest.trips.map((t: any) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: LINE }}>
            <span>
              {t.trip_date} · {timeLabel(t.start_time)}
              {t.notes ? <small style={{ display: "block", color: "#92A0AB" }}>{t.notes}</small> : null}
            </span>
            <StatusPill
              label={t.status}
              tone={t.status === "completed" ? "green" : deadStatuses.has(t.status) ? "muted" : "cyan"}
            />
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
              <span>
                <strong>{g.name}</strong>
                {g.profile?.home_port ? (
                  <small style={{ display: "block", color: "#92A0AB" }}>{g.profile.home_port}</small>
                ) : null}
              </span>
              <span style={{ color: "#92A0AB" }}>
                {g.trips.length} trip{g.trips.length === 1 ? "" : "s"}
              </span>
              <span style={{ color: "#92A0AB" }}>{g.trips[0]?.trip_date ?? "—"}</span>
              <strong>{money(g.totalCents)}</strong>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ border: LINE, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#92A0AB" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{value?.trim() ? value : "—"}</div>
    </div>
  );
}
