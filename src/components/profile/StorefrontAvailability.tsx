import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicBusinessAvailability } from "@/lib/businesses.functions";

const CARD: React.CSSProperties = {
  background: "#14202B",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 20,
  padding: 26,
};

const nav: React.CSSProperties = {
  background: "transparent",
  color: "#F0F2F5",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 10,
  padding: "6px 12px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const FREE = "#22C55E";
const PART = "#F8B57A";
const TAKEN = "#4A5A68";

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Public month grid on an operator storefront: one row per slip or trip,
 * one cell per day, coloured free / part-booked / fully booked.
 */
export function StorefrontAvailability({
  businessId,
  heading = "Availability",
}: {
  businessId: string;
  heading?: string;
}) {
  const load = useServerFn(getPublicBusinessAvailability);
  const [offset, setOffset] = useState(0);

  const base = useMemo(() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMonth(d.getUTCMonth() + offset);
    return d;
  }, [offset]);

  const month = monthKey(base);
  const q = useQuery({
    queryKey: ["storefront-calendar", businessId, month],
    queryFn: () => load({ data: { businessId, month } }),
    staleTime: 60_000,
  });

  const daysInMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const listings = q.data?.listings ?? [];

  return (
    <section style={CARD}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.025em" }}>
            {heading}
          </h2>
          <div style={{ color: "#92A0AB", fontSize: 12.5, marginTop: 3 }}>
            {base.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={nav} onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">‹</button>
          <button style={nav} onClick={() => setOffset(0)}>Today</button>
          <button style={nav} onClick={() => setOffset((o) => o + 1)} aria-label="Next month">›</button>
        </div>
      </div>

      {q.isLoading ? (
        <div style={{ color: "#92A0AB", fontSize: 13.5 }}>Loading availability…</div>
      ) : listings.length === 0 ? (
        <div style={{ color: "#92A0AB", fontSize: 13.5 }}>
          Nothing released for this month yet — try the next month.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 620 }}>
            <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${daysInMonth}, 1fr)`, gap: 3, marginBottom: 4 }}>
              <span />
              {dayList.map((d) => (
                <span key={d} style={{ fontSize: 9.5, color: "#92A0AB", textAlign: "center" }}>
                  {d}
                </span>
              ))}
            </div>
            {listings.map((l) => (
              <div
                key={l.id}
                style={{ display: "grid", gridTemplateColumns: `140px repeat(${daysInMonth}, 1fr)`, gap: 3, alignItems: "center", marginBottom: 4 }}
              >
                <span style={{ fontSize: 12.5, color: "#F0F2F5", fontWeight: 600, paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.title}
                </span>
                {dayList.map((d) => {
                  const key = `${month}-${String(d).padStart(2, "0")}`;
                  const info = l.days[key];
                  const color = !info
                    ? "rgba(255,255,255,.05)"
                    : info.blocked || info.left === 0
                      ? TAKEN
                      : info.left < info.total
                        ? PART
                        : FREE;
                  const label = !info
                    ? "not released"
                    : info.blocked || info.left === 0
                      ? "fully booked"
                      : l.isSlip
                        ? "free"
                        : `${info.left} of ${info.total} spots left`;
                  return (
                    <span
                      key={d}
                      title={`${key} · ${l.title} · ${label}`}
                      style={{ height: 20, borderRadius: 4, background: color, display: "block" }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 16, fontSize: 11.5, color: "#92A0AB" }}>
        <Legend color={FREE} label="Free" />
        <Legend color={PART} label="Part booked" />
        <Legend color={TAKEN} label="Booked" />
        <Legend color="rgba(255,255,255,.08)" label="Not released" />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}
