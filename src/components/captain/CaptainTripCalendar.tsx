/**
 * Operator month calendar: this business's own booked trips with guest, time,
 * price and payout status (pending, in escrow, scheduled, paid).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCaptainTripCalendar } from "@/lib/captain-management.functions";

const T = {
  card: "var(--card, #14202B)",
  line: "var(--line, #22333F)",
  ink: "var(--ink, #E8F2F6)",
  mut: "var(--tmut, #8AA2B0)",
  accent: "#2DE2F2",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const money = (c: number) =>
  `$${((c ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const payoutColor: Record<string, string> = {
  paid: "#22C55E",
  "to bank": "#2DE2F2",
  scheduled: "#2DE2F2",
  "in escrow": "#F8B57A",
  pending: "#8AA2B0",
};

function timeLabel(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hh = Number(h ?? 0);
  const suffix = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m ?? "00"}${suffix}`;
}

export function CaptainTripCalendar() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const fetchCal = useServerFn(getCaptainTripCalendar);

  const base = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  }, [offset]);
  const month = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data, isLoading } = useQuery({
    queryKey: ["captain-trip-calendar", month],
    queryFn: () => fetchCal({ data: { month } }),
    staleTime: 30_000,
  });

  const trips = data?.trips ?? [];
  const byDay = useMemo(() => {
    const map: Record<string, typeof trips> = {};
    for (const t of trips) (map[t.tripDate] ||= []).push(t);
    return map;
  }, [trips]);

  const cells = useMemo(() => {
    const start = new Date(base);
    start.setUTCDate(1 - base.getUTCDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [base]);

  const monthLabel = base.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const dayTrips = selected ? byDay[selected] ?? [] : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: T.ink }}>{monthLabel}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={nav} onClick={() => setOffset((o) => o - 1)}>‹</button>
          <button style={nav} onClick={() => { setOffset(0); setSelected(null); }}>This month</button>
          <button style={nav} onClick={() => setOffset((o) => o + 1)}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        {[
          ["Trips", String(data?.totals.trips ?? 0)],
          ["Trip value", money(data?.totals.grossCents ?? 0)],
          ["Paid to you", money(data?.totals.paidOutCents ?? 0)],
          ["Awaiting payout", money(data?.totals.awaitingPayoutCents ?? 0)],
        ].map(([k, v]) => (
          <div key={k} style={box}>
            <div style={{ color: T.mut, fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em" }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: T.accent }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ ...box, padding: 14 }}>
        {isLoading && <div style={{ color: T.mut, fontSize: 13.5, marginBottom: 10 }}>Loading trips…</div>}
        <div
          className="fx-calendar-grid fx-calendar-grid-detailed"
          style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}
        >
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: T.mut,
                textAlign: "center",
                paddingBottom: 4,
              }}
            >
              {d}
            </div>
          ))}
          {cells.map((d) => {
            const k = d.toISOString().slice(0, 10);
            const list = byDay[k] ?? [];
            const inMonth = d.getUTCMonth() === base.getUTCMonth();
            const isSel = selected === k;
            const paid = list.filter((t) => t.payoutStatus === "paid").length;
            return (
              <button
                key={k}
                onClick={() => setSelected(isSel ? null : k)}
                style={{
                  minHeight: 76,
                  borderRadius: 10,
                  textAlign: "left",
                  padding: 8,
                  cursor: "pointer",
                  background: isSel ? "rgba(45,226,242,.12)" : "#0F1A24",
                  border: `1px solid ${isSel ? T.accent : T.line}`,
                  opacity: inMonth ? 1 : 0.4,
                  color: T.ink,
                  font: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>{d.getUTCDate()}</span>
                {list.length > 0 && (
                  <>
                    <span style={{ fontSize: 10.5, color: T.accent }}>
                      {list.length} trip{list.length > 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 10.5, color: T.mut }}>
                      {money(list.reduce((s, t) => s + t.totalCents, 0))}
                    </span>
                    <span style={{ fontSize: 10.5, color: paid === list.length ? "#22C55E" : "#F8B57A" }}>
                      {paid}/{list.length} paid
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {dayTrips && (
        <div style={{ ...box, overflowX: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: T.ink }}>
            {new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </div>
          {dayTrips.length === 0 ? (
            <div style={{ color: T.mut, fontSize: 13.5 }}>No trips booked on this day.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
              <thead>
                <tr style={{ color: T.mut, textAlign: "left" }}>
                  {["Guest", "Trip", "Time", "Guests", "Price", "Booking", "Payout"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", fontWeight: 600, borderBottom: `1px solid ${T.line}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayTrips.map((t) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <td style={td}>{t.guest}</td>
                    <td style={td}>{t.title}</td>
                    <td style={td}>{timeLabel(t.startTime)}</td>
                    <td style={td}>{t.partySize}</td>
                    <td style={td}>{money(t.totalCents)}</td>
                    <td style={{ ...td, textTransform: "capitalize" }}>{String(t.status).replace(/_/g, " ")}</td>
                    <td style={{ ...td, color: payoutColor[t.payoutStatus] ?? T.mut }}>
                      {t.payoutStatus} · {money(t.payoutCents)}
                      {t.arrivalDate && t.payoutStatus !== "paid" && (
                        <div style={{ color: T.mut, fontSize: 12 }}>arrives {t.arrivalDate}</div>
                      )}
                      {t.payoutError && <div style={{ color: "#F87171", fontSize: 12 }}>{t.payoutError}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.line}`,
  borderRadius: 16,
  padding: 18,
  color: T.ink,
};

const td: React.CSSProperties = { padding: "9px 10px" };

const nav: React.CSSProperties = {
  background: "transparent",
  color: T.ink,
  border: `1px solid ${T.line}`,
  borderRadius: 10,
  padding: "7px 13px",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
