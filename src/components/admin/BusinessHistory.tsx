/**
 * Readiness history for a business — verification decisions, payment status
 * changes and profile/visibility edits, newest first, with who did it and when.
 * Used inside the admin console (any business) and reusable elsewhere.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessAuditHistory } from "@/lib/business-audit.functions";

const T = {
  card: "#14202B",
  line: "#22333F",
  ink: "#E8F2F6",
  mut: "#8AA2B0",
  accent: "#2DE2F2",
};

const AREA_LABEL: Record<string, string> = {
  verification: "Verification",
  payments: "Payments",
  profile: "Profile",
};

const AREA_COLOR: Record<string, string> = {
  verification: "#2DE2F2",
  payments: "#22C55E",
  profile: "#8AA2B0",
};

const FIELD_LABEL: Record<string, string> = {
  verified_at: "Verified badge",
  charges_enabled: "Can take payments",
  payouts_enabled: "Can receive payouts",
  stripe_account_id: "Stripe account",
  is_published: "Storefront live",
  listing_ready: "Listing ready",
  status: "Document review",
  name: "Business name",
  city: "City",
  phone: "Phone",
  email: "Email",
  description: "Description",
  hero_url: "Cover photo",
};

const EVENT_LABEL: Record<string, string> = {
  documents_submitted: "Documents submitted",
  documents_approved: "Documents approved",
  documents_rejected: "Documents rejected",
  verified: "Marked verified",
  verification_cleared: "Verification removed",
  payments_changed: "Payment setup changed",
  storefront_visibility: "Storefront visibility changed",
  listing_readiness: "Listing readiness changed",
  profile_updated: "Profile updated",
};

const pretty = (v: string | null) => {
  if (v === null || v === "") return "—";
  if (v === "true") return "Yes";
  if (v === "false") return "No";
  if (v.length > 60) return `${v.slice(0, 60)}…`;
  return v;
};

export function BusinessHistory({
  businessId,
  title = "Readiness history",
}: {
  businessId: string;
  title?: string;
}) {
  const fetchHistory = useServerFn(getBusinessAuditHistory);
  const [area, setArea] = useState<"all" | "verification" | "payments" | "profile">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["business-history", businessId, area],
    queryFn: () => fetchHistory({ data: { businessId, area, limit: 150 } }),
    staleTime: 15_000,
  });

  const events = useMemo(() => data?.events ?? [], [data]);

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: 18,
        color: T.ink,
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "verification", "payments", "profile"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setArea(k)}
              style={{
                background: area === k ? T.accent : "transparent",
                color: area === k ? "#04121B" : T.ink,
                border: `1px solid ${T.line}`,
                borderRadius: 999,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {k === "all" ? "All" : AREA_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div style={{ color: T.mut, fontSize: 13 }}>Loading history…</div>}
      {!isLoading && events.length === 0 && (
        <div style={{ color: T.mut, fontSize: 13 }}>No changes recorded yet.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {events.map((e) => (
          <div
            key={e.id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              borderLeft: `2px solid ${AREA_COLOR[e.area] ?? T.line}`,
              paddingLeft: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: "anywhere" }}>
                {EVENT_LABEL[e.event_type] ?? e.event_type.replace(/_/g, " ")}
                {e.field ? ` · ${FIELD_LABEL[e.field] ?? e.field}` : ""}
              </div>
              {(e.previous_value !== null || e.new_value !== null) && (
                <div style={{ fontSize: 12.5, color: T.mut, overflowWrap: "anywhere" }}>
                  {pretty(e.previous_value)} → {pretty(e.new_value)}
                </div>
              )}
              {e.note && (
                <div style={{ fontSize: 12.5, color: T.ink, marginTop: 3, overflowWrap: "anywhere" }}>
                  “{e.note}”
                </div>
              )}
              <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>
                {new Date(e.created_at).toLocaleString()}
                {e.actorName ? ` · ${e.actorName}` : e.actor_id ? " · staff" : " · system"}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: AREA_COLOR[e.area] ?? T.mut,
                flex: "none",
              }}
            >
              {AREA_LABEL[e.area] ?? e.area}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Admin tab: pick a business, read its full readiness history. */
export function AdminHistory({
  businesses,
}: {
  businesses: Array<{ id: string; name: string }>;
}) {
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const sorted = useMemo(
    () => [...businesses].sort((a, b) => a.name.localeCompare(b.name)),
    [businesses],
  );

  if (!sorted.length) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, color: T.mut }}>
        No businesses yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <select
        value={businessId || sorted[0].id}
        onChange={(e) => setBusinessId(e.target.value)}
        style={{
          background: T.card,
          color: T.ink,
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 13.5,
          maxWidth: 380,
        }}
      >
        {sorted.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <BusinessHistory businessId={businessId || sorted[0].id} title="Readiness history" />
    </div>
  );
}
