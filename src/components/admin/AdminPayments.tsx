/**
 * Admin payments panel: money held in escrow, deposits collected, payouts
 * already paid, and each operator's Stripe Connect standing.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminPayments } from "@/lib/admin-payments.functions";

const T = {
  card: "#14202B",
  line: "#22333F",
  ink: "#E8F2F6",
  mut: "#8AA2B0",
  accent: "#2DE2F2",
  warn: "#FFC46B",
};

const card: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.line}`,
  borderRadius: 14,
  padding: 16,
  color: T.ink,
};
const th: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: `1px solid ${T.line}`,
  fontWeight: 600,
  textAlign: "left",
};
const td: React.CSSProperties = { padding: "12px 14px", borderBottom: `1px solid ${T.line}` };

const money = (c: number) =>
  `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

function Pill({ tone, children }: { tone: "good" | "warn" | "mut"; children: React.ReactNode }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warn : T.mut;
  return (
    <span
      style={{
        border: `1px solid ${color}`,
        color,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 11.5,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const CONNECT: Record<string, { label: string; tone: "good" | "warn" | "mut" }> = {
  live: { label: "Stripe live", tone: "good" },
  restricted: { label: "Stripe restricted", tone: "warn" },
  not_connected: { label: "Not connected", tone: "mut" },
};

export function AdminPayments() {
  const load = useServerFn(getAdminPayments);
  const [view, setView] = React.useState<"operators" | "history">("operators");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => load(),
    staleTime: 20_000,
  });

  if (error)
    return <div style={{ ...card, color: "#FF8A8A" }}>Could not load the payments view.</div>;
  if (isLoading || !data) return <div style={{ ...card, color: T.mut }}>Loading payments…</div>;

  const t = data.totals;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {(
          [
            ["Held in escrow", money(t.held)],
            ["Released to operators", money(t.released)],
            ["Deposits collected", money(t.deposits)],
            ["Payouts paid", money(t.paidOut)],
            ["Payouts pending", money(t.pendingPayout)],
            ["Refunded", money(t.refunded)],
            ["Stripe live", String(t.connected)],
            ["Needs Stripe setup", String(t.restricted + t.notConnected)],
          ] as Array<[string, string]>
        ).map(([k, v]) => (
          <div key={k} style={card}>
            <div
              style={{ color: T.mut, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".1em" }}
            >
              {k}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: T.accent }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {(
          [
            ["operators", "By operator"],
            ["history", "Payout history"],
          ] as Array<["operators" | "history", string]>
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            style={{
              background: view === k ? T.accent : "transparent",
              color: view === k ? "#06212A" : T.mut,
              border: `1px solid ${view === k ? T.accent : T.line}`,
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        {view === "operators" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
            <thead>
              <tr style={{ color: T.mut }}>
                {[
                  "Operator",
                  "Stripe",
                  "Held",
                  "Released",
                  "Deposits",
                  "Paid out",
                  "Pending",
                  "Last paid",
                ].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.operators.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...td, color: T.mut }}>
                    No operator money movement yet.
                  </td>
                </tr>
              )}
              {data.operators.map((o) => (
                <tr key={o.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{o.name}</div>
                    <div style={{ color: T.mut, fontSize: 12.5 }}>
                      {String(o.category_key ?? "").replace(/_/g, " ")}
                      {o.city ? ` · ${o.city}` : ""}
                    </div>
                  </td>
                  <td style={td}>
                    <Pill tone={CONNECT[o.connect]!.tone}>{CONNECT[o.connect]!.label}</Pill>
                    {o.connect === "restricted" && (
                      <div style={{ color: T.mut, fontSize: 12, marginTop: 4 }}>
                        {o.chargesEnabled ? "" : "charges off "}
                        {o.payoutsEnabled ? "" : "payouts off"}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{money(o.heldCents)}</td>
                  <td style={td}>{money(o.releasedCents)}</td>
                  <td style={td}>{money(o.depositsCents)}</td>
                  <td style={td}>{money(o.paidOutCents)}</td>
                  <td style={{ ...td, color: o.pendingPayoutCents ? T.warn : T.mut }}>
                    {money(o.pendingPayoutCents)}
                  </td>
                  <td style={{ ...td, color: T.mut }}>{day(o.lastPaidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 800 }}>
            <thead>
              <tr style={{ color: T.mut }}>
                {["Created", "Operator", "Amount", "Status", "Paid", "Stripe reference"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.payouts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...td, color: T.mut }}>
                    No payouts recorded yet.
                  </td>
                </tr>
              )}
              {data.payouts.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ ...td, color: T.mut }}>{day(p.created_at)}</td>
                  <td style={td}>{p.businessName}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{money(p.amount_cents)}</td>
                  <td style={td}>
                    <Pill tone={p.status === "paid" || p.paid_at ? "good" : "warn"}>
                      {String(p.status ?? "pending").replace(/_/g, " ")}
                    </Pill>
                  </td>
                  <td style={{ ...td, color: T.mut }}>{day(p.paid_at)}</td>
                  <td style={{ ...td, color: T.mut, fontSize: 12 }}>
                    {p.stripe_transfer_id ?? p.stripe_payout_id ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
