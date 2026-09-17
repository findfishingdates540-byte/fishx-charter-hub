/**
 * Platform admin console: verification queue, payout ledger, dispute tracker.
 * Uses the operator dark theme; every read/write is admin-gated server-side.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getAdminOverview,
  decideVerification,
  resolveDispute,
  markPayoutPaid,
  getPayoutReconciliation,
  runPayoutReconciliation,
} from "@/lib/admin.functions";
import { AdminTripCalendar } from "@/components/admin/AdminTripCalendar";
import {
  AdminOperators,
  AdminMembers,
  AdminListings,
  AdminBookings,
  AdminAudit,
} from "@/components/admin/AdminManagement";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console | Fish-X Charters" },
      { name: "description", content: "Review operator verifications, track payouts and settle disputes across the Fish-X marketplace." },
      { property: "og:title", content: "Admin console | Fish-X Charters" },
      { property: "og:description", content: "Review operator verifications, track payouts and settle disputes across the Fish-X marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminConsole,
  errorComponent: () => (
    <Shell>
      <div style={{ ...card, textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Admin access only</h1>
        <p style={{ color: T.mut, margin: 0, fontSize: 14 }}>
          This area is limited to Fish-X platform staff.
        </p>
        <Link to="/dashboard" style={{ ...btn, display: "inline-block", marginTop: 18, textDecoration: "none" }}>
          Back to my dashboard
        </Link>
      </div>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell><div style={card}>Nothing here.</div></Shell>
  ),
});

const T = {
  bg: "#0D161F",
  card: "#14202B",
  line: "#22333F",
  ink: "#E8F2F6",
  mut: "#8AA2B0",
  accent: "#2DE2F2",
};

const card: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.line}`,
  borderRadius: 16,
  padding: 20,
  color: T.ink,
};

const btn: React.CSSProperties = {
  background: T.accent,
  color: "#04121B",
  border: 0,
  borderRadius: 10,
  padding: "9px 14px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const ghost: React.CSSProperties = {
  ...btn,
  background: "transparent",
  color: T.ink,
  border: `1px solid ${T.line}`,
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: "Outfit, sans-serif", letterSpacing: "-0.025em" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 18px 80px" }}>{children}</div>
    </div>
  );
}

const money = (c: number) =>
  `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

type Tab =
  | "operators"
  | "verifications"
  | "members"
  | "listings"
  | "bookings"
  | "payments"
  | "calendar"
  | "payouts"
  | "reconciliation"
  | "disputes"
  | "activity";

const TABS: Array<[Tab, string]> = [
  ["operators", "Operators"],
  ["verifications", "Documents"],
  ["members", "Members"],
  ["listings", "Listings"],
  ["bookings", "Bookings"],
  ["payments", "Payments"],
  ["calendar", "Calendar"],
  ["payouts", "Payouts"],
  ["reconciliation", "Reconciliation"],
  ["disputes", "Disputes"],
  ["activity", "Activity log"],
];

function AdminConsole() {
  const fetchOverview = useServerFn(getAdminOverview);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 15_000,
  });
  const [tab, setTab] = useState<Tab>("operators");

  const fetchRecon = useServerFn(getPayoutReconciliation);
  const rerunRecon = useServerFn(runPayoutReconciliation);
  const recon = useQuery({
    queryKey: ["admin-reconciliation"],
    queryFn: () => fetchRecon(),
    enabled: tab === "reconciliation",
    staleTime: 30_000,
  });
  const reconMut = useMutation({
    mutationFn: () => rerunRecon(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reconciliation"] }),
  });

  const decide = useServerFn(decideVerification);
  const resolve = useServerFn(resolveDispute);
  const payPayout = useServerFn(markPayoutPaid);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  const decideMut = useMutation({
    mutationFn: (v: { requestId: string; approve: boolean }) => decide({ data: v }),
    onSuccess: refresh,
  });
  const resolveMut = useMutation({
    mutationFn: (v: { disputeId: string; note: string; outcome: "resolved" | "rejected" }) =>
      resolve({ data: v }),
    onSuccess: refresh,
  });
  const payMut = useMutation({
    mutationFn: (payoutId: string) => payPayout({ data: { payoutId } }),
    onSuccess: refresh,
    onError: (e: unknown) =>
      window.alert(e instanceof Error ? e.message : "That payout could not be sent."),
  });

  if (error) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Admin access only</h1>
          <p style={{ color: T.mut, fontSize: 14, margin: 0 }}>
            Your account isn&rsquo;t on the Fish-X staff list.
          </p>
        </div>
      </Shell>
    );
  }

  if (isLoading || !data) {
    return <Shell><div style={{ ...card, color: T.mut }}>Loading the console…</div></Shell>;
  }

  const stats: Array<[string, string]> = [
    ["Pending verifications", String(data.totals.pendingVerifications)],
    ["Open disputes", String(data.totals.openDisputes)],
    ["Payouts owed", money(data.totals.pendingPayoutCents)],
    ["Paid out to date", money(data.totals.paidPayoutCents)],
  ];

  return (
    <Shell>
      <h1 style={{ fontSize: 28, margin: "0 0 4px", fontWeight: 700 }}>Admin console</h1>
      <p style={{ color: T.mut, margin: "0 0 22px", fontSize: 14 }}>
        Vendors, money and disputes across the whole marketplace.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 22 }}>
        {stats.map(([k, v]) => (
          <div key={k} style={card}>
            <div style={{ color: T.mut, fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em" }}>{k}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: T.accent }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              ...ghost,
              background: tab === k ? T.accent : "transparent",
              color: tab === k ? "#04121B" : T.ink,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "operators" && <AdminOperators />}
      {tab === "members" && <AdminMembers />}
      {tab === "listings" && <AdminListings />}
      {tab === "bookings" && <AdminBookings />}
      {tab === "activity" && <AdminAudit />}


      {tab === "verifications" && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.verifications.length === 0 && <div style={{ ...card, color: T.mut }}>No verification requests yet.</div>}
          {data.verifications.map((v: any) => (
            <div key={v.id} style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>{v.business?.name ?? "Unknown business"}</div>
                <div style={{ color: T.mut, fontSize: 13 }}>
                  {v.business?.category_key ?? "—"} · submitted {day(v.created_at)} · {v.doc_urls?.length ?? 0} document(s)
                </div>
                {v.notes && <div style={{ color: T.mut, fontSize: 13, marginTop: 4 }}>{v.notes}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.mut, textTransform: "uppercase", letterSpacing: ".08em" }}>{v.status}</span>
                {v.status === "pending" && (
                  <>
                    <button style={btn} disabled={decideMut.isPending} onClick={() => decideMut.mutate({ requestId: v.id, approve: true })}>Approve</button>
                    <button style={ghost} disabled={decideMut.isPending} onClick={() => decideMut.mutate({ requestId: v.id, approve: false })}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "calendar" && <AdminTripCalendar />}

      {tab === "payouts" && (
        <div style={{ ...card, overflowX: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
            <thead>
              <tr style={{ color: T.mut, textAlign: "left" }}>
                {["Business", "Amount", "Status", "Created", "Paid", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.payouts.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 18, color: T.mut }}>No payouts recorded yet.</td></tr>
              )}
              {data.payouts.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>{p.business?.name ?? p.business_id}</td>
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontWeight: 700 }}>{money(p.amount_cents)}</td>
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, color: p.status === "paid" ? T.accent : T.mut }}>{p.status}</td>
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, color: T.mut }}>{day(p.created_at)}</td>
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, color: T.mut }}>{day(p.paid_at)}</td>
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>
                    {p.status !== "paid" && (
                      <button
                        style={ghost}
                        disabled={payMut.isPending}
                        onClick={() => {
                          if (!window.confirm(`Send ${money(p.amount_cents)} to ${p.business?.name ?? "this business"} now?`)) return;
                          payMut.mutate(p.id);
                        }}
                      >
                        {payMut.isPending && payMut.variables === p.id ? "Sending…" : "Approve & send"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "reconciliation" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Daily payout check</div>
              <div style={{ color: T.mut, fontSize: 13.5 }}>
                {recon.data?.runDate
                  ? `Last run ${day(recon.data.runDate)} · ${recon.data.totals.checked} payouts checked · ${recon.data.totals.problems} need attention`
                  : "The check runs automatically every night at 04:00 UTC."}
              </div>
            </div>
            <button style={ghost} disabled={reconMut.isPending} onClick={() => reconMut.mutate()}>
              {reconMut.isPending ? "Checking…" : "Run check now"}
            </button>
          </div>

          {recon.isLoading && <div style={{ ...card, color: T.mut }}>Loading the latest check…</div>}
          {recon.error && <div style={{ ...card, color: "#FF8A8A" }}>Could not load the check.</div>}

          {recon.data && recon.data.totals.problems === 0 && recon.data.totals.checked > 0 && (
            <div style={{ ...card, color: T.accent }}>Every payout matches its booking or order.</div>
          )}
          {recon.data && recon.data.totals.checked === 0 && (
            <div style={{ ...card, color: T.mut }}>No payouts to check yet.</div>
          )}

          {recon.data && recon.data.rows.some((r: any) => r.status !== "matched") && (
            <div style={{ ...card, overflowX: "auto", padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 760 }}>
                <thead>
                  <tr style={{ color: T.mut, textAlign: "left" }}>
                    {["Business", "Type", "Issue", "Expected", "Actual", "Difference"].map((h) => (
                      <th key={h} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recon.data.rows
                    .filter((r: any) => r.status !== "matched")
                    .map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>{r.business_name ?? "—"}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, color: T.mut }}>
                          {r.scope === "booking" ? "Trip" : "Shop order"}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>{r.detail ?? r.status}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, color: T.mut }}>{money(r.expected_cents)}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>{money(r.actual_cents)}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontWeight: 700, color: r.delta_cents === 0 ? T.mut : "#FFB86B" }}>
                          {money(r.delta_cents)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "disputes" && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.disputes.length === 0 && <div style={{ ...card, color: T.mut }}>No disputes open. Good sign.</div>}
          {data.disputes.map((d: any) => (
            <DisputeRow
              key={d.id}
              dispute={d}
              busy={resolveMut.isPending}
              onResolve={(note, outcome) => resolveMut.mutate({ disputeId: d.id, note, outcome })}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function DisputeRow({
  dispute,
  busy,
  onResolve,
}: {
  dispute: any;
  busy: boolean;
  onResolve: (note: string, outcome: "resolved" | "rejected") => void;
}) {
  const [note, setNote] = useState("");
  const open = dispute.status !== "resolved" && dispute.status !== "rejected";
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{String(dispute.kind).replace(/_/g, " ")}</div>
          <div style={{ color: T.mut, fontSize: 13 }}>Opened {day(dispute.created_at)} · booking {String(dispute.booking_id).slice(0, 8)}</div>
        </div>
        <span style={{ fontSize: 12, color: open ? T.accent : T.mut, textTransform: "uppercase", letterSpacing: ".08em" }}>{dispute.status}</span>
      </div>
      {dispute.description && <p style={{ color: T.mut, fontSize: 13.5, margin: "10px 0 0" }}>{dispute.description}</p>}
      {dispute.resolution_note && (
        <p style={{ color: T.ink, fontSize: 13.5, margin: "10px 0 0" }}>Outcome: {dispute.resolution_note}</p>
      )}
      {open && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution note"
            style={{ flex: "1 1 240px", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", color: T.ink, outline: "none", fontSize: 13.5 }}
          />
          <button style={btn} disabled={busy || note.trim().length < 3} onClick={() => onResolve(note.trim(), "resolved")}>Resolve</button>
          <button style={ghost} disabled={busy || note.trim().length < 3} onClick={() => onResolve(note.trim(), "rejected")}>Reject</button>
        </div>
      )}
    </div>
  );
}
