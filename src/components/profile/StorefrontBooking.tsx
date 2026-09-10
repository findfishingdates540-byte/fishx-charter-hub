import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

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
  service,
  storefrontSlug,
}: {
  service: Svc | null;
  storefrontSlug: string;
}) {
  const navigate = useNavigate();
  const [party, setParty] = useState(2);
  const maxParty = Math.max(1, Math.min(service?.capacity ?? 6, 60));
  const price = service?.base_price_cents ?? 0;

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
          <span style={label}>Selected package</span>
          <div style={{ ...field, lineHeight: 1.45 }}>
            <strong>{service.title}</strong>
            <span style={{ display: "block", color: "#92A0AB", fontSize: 12, marginTop: 3 }}>
              {service.duration_minutes ? `${Math.round(service.duration_minutes / 60)} hr · ` : ""}{fmtPrice(service.base_price_cents)} per trip
            </span>
          </div>
        </div>

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
          onClick={() =>
            navigate({
              to: "/booking",
              search: { service_id: service.id, party, start: "dates", storefront: storefrontSlug },
            })
          }
          style={{
            background: "#2DE2F2",
            color: "#04121B",
            border: 0,
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Pick a departure
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
