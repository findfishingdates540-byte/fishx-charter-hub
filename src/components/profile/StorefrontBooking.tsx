import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicServiceAvailability } from "@/lib/businesses.functions";

type Svc = {
  id: string;
  title: string;
  base_price_cents: number;
  capacity: number | null;
  duration_minutes: number | null;
};

const fmtPrice = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

const field: React.CSSProperties = {
  width: "100%",
  background: "#1C2936",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#F0F2F5",
  borderRadius: 11,
  padding: "11px 12px",
  fontSize: 13.5,
  fontFamily: "'Outfit', system-ui, sans-serif",
};

const label: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "#92A0AB",
  fontWeight: 700,
  display: "block",
  marginBottom: 6,
};

/**
 * Inline booking form on an operator storefront: pick a trip, a released
 * departure and party size, then hand off to the escrow checkout with that
 * selection already made.
 */
export function StorefrontBooking({
  services,
  selectedServiceId,
  onSelectService,
}: {
  services: Svc[];
  selectedServiceId: string | null;
  onSelectService: (id: string) => void;
}) {
  const navigate = useNavigate();
  const loadAvailability = useServerFn(getPublicServiceAvailability);
  const serviceId = selectedServiceId ?? services[0]?.id ?? null;
  const service = services.find((s) => s.id === serviceId) ?? null;

  const availability = useQuery({
    queryKey: ["storefront-availability", serviceId],
    enabled: Boolean(serviceId),
    queryFn: () => loadAvailability({ data: { serviceId: serviceId as string } }),
    staleTime: 60_000,
  });

  const slots = availability.data?.slots ?? [];
  const [slotId, setSlotId] = useState("");
  const [party, setParty] = useState(2);

  // Reset the departure whenever the trip changes or new availability lands.
  useEffect(() => {
    setSlotId((cur) => (slots.some((s) => s.id === cur) ? cur : ""));
  }, [slots]);

  const days = useMemo(() => {
    const map = new Map<string, typeof slots>();
    for (const s of slots) {
      const key = new Date(s.startsAt).toISOString().slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [slots]);

  const [day, setDay] = useState("");
  useEffect(() => {
    setDay((cur) => (days.some(([d]) => d === cur) ? cur : days[0]?.[0] ?? ""));
  }, [days]);

  const daySlots = days.find(([d]) => d === day)?.[1] ?? [];
  const slot = slots.find((s) => s.id === slotId) ?? null;
  const maxParty = Math.max(1, Math.min(slot?.seatsLeft ?? service?.capacity ?? 6, service?.capacity ?? 60));
  const price = slot?.priceCents ?? service?.base_price_cents ?? 0;

  if (!service) {
    return (
      <div style={{ background: "#14202B", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: 24, color: "#92A0AB", fontSize: 13 }}>
        No bookable trips published yet.
      </div>
    );
  }

  return (
    <div style={{ background: "#14202B", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: 24, boxShadow: "0 30px 60px -44px rgba(4,10,16,.62)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <span style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 27, fontWeight: 600 }}>{fmtPrice(price)}</span>
          <span style={{ fontSize: 12.5, color: "#92A0AB" }}> per trip</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#2DE2F2", background: "rgba(45,226,242,.12)", borderRadius: 20, padding: "4px 10px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2DE2F2" }} />
          Escrow
        </span>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <span style={label}>Trip</span>
          <select
            value={service.id}
            onChange={(e) => onSelectService(e.target.value)}
            style={field}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {fmtPrice(s.base_price_cents)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span style={label}>Date</span>
          {availability.isLoading ? (
            <div style={{ ...field, color: "#92A0AB" }}>Loading dates…</div>
          ) : days.length === 0 ? (
            <div style={{ ...field, color: "#92A0AB" }}>No dates released yet</div>
          ) : (
            <select value={day} onChange={(e) => { setDay(e.target.value); setSlotId(""); }} style={field}>
              {days.map(([d, list]) => (
                <option key={d} value={d}>
                  {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  {` · ${list.length} departure${list.length === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {daySlots.length > 0 && (
          <div>
            <span style={label}>Departure</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {daySlots.map((s) => {
                const active = s.id === slotId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlotId(s.id)}
                    style={{
                      background: active ? "#2DE2F2" : "#1C2936",
                      color: active ? "#04121B" : "#F0F2F5",
                      border: `1px solid ${active ? "#2DE2F2" : "rgba(255,255,255,.1)"}`,
                      borderRadius: 10,
                      padding: "9px 12px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {new Date(s.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    <span style={{ fontWeight: 500, opacity: 0.75 }}> · {s.seatsLeft} left</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <span style={label}>Guests</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} style={stepBtn}>−</button>
            <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{party}</span>
            <button type="button" onClick={() => setParty((p) => Math.min(maxParty, p + 1))} style={stepBtn}>+</button>
            <span style={{ fontSize: 12, color: "#92A0AB" }}>max {maxParty}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={!slotId}
          onClick={() =>
            navigate({
              to: "/booking",
              search: { service_id: service.id, slot: slotId, party },
            })
          }
          style={{
            background: slotId ? "#2DE2F2" : "#1C2936",
            color: slotId ? "#04121B" : "#5f7080",
            border: 0,
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            cursor: slotId ? "pointer" : "not-allowed",
          }}
        >
          {slotId ? "Continue to checkout" : "Pick a departure"}
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 11.5, color: "#92A0AB", textAlign: "center" }}>
        Funds held in escrow · Released 24 hrs after your trip
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "#1C2936",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#F0F2F5",
  fontSize: 17,
  cursor: "pointer",
};
