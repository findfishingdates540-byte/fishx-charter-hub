import { useMemo, useState } from "react";
import { Card } from "@/components/operator/OperatorShell";

type Reservation = {
  id: string;
  vessel_name: string;
  captain_name: string | null;
  arrive_date: string;
  depart_date: string;
  status: string;
  slip?: { slip_number: string } | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function key(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Month grid of arrivals / departures / occupancy for the harbor. */
export function ReservationCalendar({ rows }: { rows: Reservation[] }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const base = useMemo(() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + offset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, [offset]);

  const { cells, byDay } = useMemo(() => {
    const first = new Date(base);
    const start = new Date(first);
    start.setUTCDate(1 - first.getUTCDay());
    const list: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      list.push(d);
    }
    const map: Record<
      string,
      { arrivals: Reservation[]; departures: Reservation[]; staying: Reservation[] }
    > = {};
    for (const d of list) map[key(d)] = { arrivals: [], departures: [], staying: [] };
    for (const r of rows) {
      if (r.status === "cancelled") continue;
      const a = new Date(`${r.arrive_date}T00:00:00Z`);
      const dep = new Date(`${r.depart_date}T00:00:00Z`);
      if (map[key(a)]) map[key(a)]!.arrivals.push(r);
      if (map[key(dep)]) map[key(dep)]!.departures.push(r);
      const cur = new Date(a);
      while (cur <= dep) {
        const k = key(cur);
        if (map[k]) map[k]!.staying.push(r);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    return { cells: list, byDay: map };
  }, [base, rows]);

  const monthLabel = base.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const day = selected ? byDay[selected] : null;

  return (
    <Card
      eyebrow="Calendar"
      title={monthLabel}
      right={
        <div style={{ display: "flex", gap: 8 }}>
          <button style={nav} onClick={() => setOffset((o) => o - 1)}>
            ‹
          </button>
          <button style={nav} onClick={() => setOffset(0)}>
            Today
          </button>
          <button style={nav} onClick={() => setOffset((o) => o + 1)}>
            ›
          </button>
        </div>
      }
    >
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
              color: "#92A0AB",
              textAlign: "center",
              paddingBottom: 4,
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((d) => {
          const k = key(d);
          const info = byDay[k]!;
          const inMonth = d.getUTCMonth() === base.getUTCMonth();
          const isSel = selected === k;
          return (
            <button
              key={k}
              onClick={() => setSelected(isSel ? null : k)}
              style={{
                minHeight: 74,
                borderRadius: 10,
                textAlign: "left",
                padding: 8,
                cursor: "pointer",
                background: isSel ? "rgba(45,226,242,.12)" : "#14202B",
                border: `1px solid ${isSel ? "#2DE2F2" : "rgba(255,255,255,.07)"}`,
                opacity: inMonth ? 1 : 0.4,
                color: "#F0F2F5",
                fontFamily: "'Outfit', system-ui, sans-serif",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700 }}>{d.getUTCDate()}</span>
              {info.arrivals.length > 0 && (
                <span style={{ fontSize: 10.5, color: "#22C55E" }}>
                  ▲ {info.arrivals.length} in
                </span>
              )}
              {info.departures.length > 0 && (
                <span style={{ fontSize: 10.5, color: "#F8B57A" }}>
                  ▼ {info.departures.length} out
                </span>
              )}
              {info.staying.length > 0 && (
                <span style={{ fontSize: 10.5, color: "#92A0AB" }}>
                  {info.staying.length} berthed
                </span>
              )}
            </button>
          );
        })}
      </div>

      {day && (
        <div
          style={{
            marginTop: 16,
            borderTop: "1px solid rgba(255,255,255,.07)",
            paddingTop: 14,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ color: "#F0F2F5", fontWeight: 700, fontSize: 14 }}>
            {new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </div>
          {day.staying.length === 0 && (
            <div style={{ color: "#92A0AB", fontSize: 13.5 }}>Nothing on the dock.</div>
          )}
          {day.staying.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 13.5,
                color: "#F0F2F5",
              }}
            >
              <span>
                {r.vessel_name}
                {r.slip?.slip_number ? ` · Slip ${r.slip.slip_number}` : ""}
              </span>
              <span style={{ color: "#92A0AB" }}>
                {day.arrivals.includes(r)
                  ? "Arriving"
                  : day.departures.includes(r)
                    ? "Departing"
                    : "Staying"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const nav: React.CSSProperties = {
  background: "transparent",
  color: "#F0F2F5",
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 10,
  padding: "6px 12px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
