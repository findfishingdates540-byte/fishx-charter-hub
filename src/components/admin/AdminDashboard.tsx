/**
 * Admin home: marketplace totals and "needs attention" queues, real data only.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperatorDirectory, getMemberDirectory, getBookingLedger } from "@/lib/admin-directory.functions";

const T = { card: "#14202B", line: "#22333F", ink: "#E8F2F6", mut: "#8AA2B0", accent: "#2DE2F2", warn: "#FFB86B" };
const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, color: T.ink };
const money = (c: number) => `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function AdminDashboard({ overview, onGo }: { overview: any; onGo: (section: string) => void }) {
  const ops = useQuery({ queryKey: ["admin-operator-directory"], queryFn: useServerFn(getOperatorDirectory), staleTime: 20_000 });
  const fetchMembers = useServerFn(getMemberDirectory);
  const members = useQuery({ queryKey: ["admin-members"], queryFn: () => fetchMembers({ data: {} }), staleTime: 20_000 });
  const ledger = useQuery({ queryKey: ["admin-ledger"], queryFn: useServerFn(getBookingLedger), staleTime: 20_000 });

  const now = Date.now();
  const rows = (ledger.data?.rows ?? []) as any[];
  const since = (days: number) => rows.filter((r) => !String(r.status).startsWith("cancelled") && now - new Date(r.created_at).getTime() < days * 864e5);
  const week = since(7);
  const month = since(30);
  const operators = (ops.data?.operators ?? []) as any[];
  const hiddenApproved = operators.filter((o) => o.verified_at && !(o.is_published && (o.listing_ready || o.listing_grace)));
  const pendingDocs = (overview.verificationDocuments ?? []).filter((v: any) => v.status === "pending");
  const openDisputes = (overview.disputes ?? []).filter((d: any) => d.status !== "resolved" && d.status !== "rejected");

  const stats: Array<[string, string, string]> = [
    ["Users", String(members.data?.totals.all ?? "…"), "members"],
    ["Operators", String(ops.data?.totals.operators ?? "…"), "operators"],
    ["Visible operators", String(ops.data?.totals.live ?? "…"), "operators"],
    ["Documents to review", String(pendingDocs.length), "verifications"],
    ["Bookings · 7 days", `${week.length} · ${money(week.reduce((s, r) => s + (r.total_cents ?? 0), 0))}`, "bookings"],
    ["Bookings · 30 days", `${month.length} · ${money(month.reduce((s, r) => s + (r.total_cents ?? 0), 0))}`, "bookings"],
    ["Open disputes", String(overview.totals.openDisputes), "disputes"],
    ["Payouts owed", money(overview.totals.pendingPayoutCents), "payouts"],
  ];

  const Queue = ({ title, empty, items, go }: { title: string; empty: string; items: Array<{ id: string; a: string; b: string }>; go: string }) => (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <button onClick={() => onGo(go)} style={{ background: "transparent", border: 0, color: T.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Open →</button>
      </div>
      {items.length === 0 && <div style={{ color: T.mut, fontSize: 13.5 }}>{empty}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {items.slice(0, 6).map((i) => (
          <div key={i.id} style={{ borderTop: `1px solid ${T.line}`, paddingTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{i.a}</div>
            <div style={{ fontSize: 12.5, color: T.mut }}>{i.b}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        {stats.map(([k, v, go]) => (
          <button key={k} onClick={() => onGo(go)} style={{ ...card, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ color: T.mut, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".1em" }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: T.accent }}>{v}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
        <Queue title="Documents to review" empty="Nothing waiting." go="verifications"
          items={pendingDocs.map((v: any) => ({ id: v.id, a: v.business?.name ?? "Unknown business", b: v.document_label }))} />
        <Queue title="Approved but hidden" empty="Every approved operator is visible." go="operators"
          items={hiddenApproved.map((o) => ({
            id: o.id, a: o.name,
            b: [!(o.charges_enabled && o.payouts_enabled) && "payments not connected", !o.is_published && "storefront not live", o.liveListings === 0 && "no live listings"].filter(Boolean).join(" · ") || "no upcoming dates",
          }))} />
        <Queue title="Open disputes" empty="No open disputes." go="disputes"
          items={openDisputes.map((d: any) => ({ id: d.id, a: String(d.kind).replace(/_/g, " "), b: `Booking ${String(d.booking_id).slice(0, 8)}` }))} />
      </div>
    </div>
  );
}
