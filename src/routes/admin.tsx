/**
 * Platform admin console: verification queue, payout ledger, dispute tracker.
 * Uses the operator dark theme; every read/write is admin-gated server-side.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getAdminOverview,
  decideVerification,
  decideVerificationDocument,
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
import { AdminHistory, BusinessHistory } from "@/components/admin/BusinessHistory";
import { AdminPayments } from "@/components/admin/AdminPayments";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { DocumentPreviewDialog } from "@/components/admin/DocumentPreviewDialog";
import { supabase } from "@/integrations/supabase/client";

const SECTIONS = ["dashboard","operators","members","verifications","history","listings","bookings","calendar","payments","payouts","reconciliation","disputes","activity"] as const;

export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { section?: (typeof SECTIONS)[number] } => ({
    section: (SECTIONS as readonly string[]).includes(String(s.section)) ? (s.section as any) : undefined,
  }),
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
  component: AdminGate,
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

type Tab = (typeof SECTIONS)[number];

const TABS: Array<[Tab, string]> = [
  ["dashboard", "Dashboard"],
  ["operators", "Operators"],
  ["members", "Users"],
  ["verifications", "Verification"],
  ["history", "Readiness history"],
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab: Tab = search.section ?? "dashboard";
  const setTab = (k: Tab) => { navigate({ to: "/admin", search: { section: k } }); setMenuOpen(false); };
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

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
  const decideDocument = useServerFn(decideVerificationDocument);
  const resolve = useServerFn(resolveDispute);
  const payPayout = useServerFn(markPayoutPaid);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  const decideMut = useMutation({
    mutationFn: (v: { requestId: string; approve: boolean; note?: string }) => decide({ data: v }),
    onSuccess: () => {
      setRejecting(null);
      setRejectReason("");
      setRejectError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setRejectError(e instanceof Error ? e.message : "That decision could not be saved."),
  });
  const documentDecision = useMutation({
    mutationFn: (value: { documentId: string; action: "approve" | "reject" | "reopen"; reason?: string }) => decideDocument({ data: value }),
    onSuccess: () => { setRejecting(null); setRejectReason(""); setRejectError(null); refresh(); },
    onError: (e: unknown) => setRejectError(e instanceof Error ? e.message : "That decision could not be saved."),
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

  const pendingDocs = data.verificationDocuments.filter((v: any) => v.status === "pending").length;

  return (
    <div className="fx-admin" style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: "Outfit, sans-serif", letterSpacing: "-0.025em" }}>
      <style>{`
        .fx-admin-side{position:fixed;inset:0 auto 0 0;width:240px;background:${T.card};border-right:1px solid ${T.line};padding:22px 14px;overflow-y:auto;z-index:40;transition:transform .2s}
        .fx-admin-main{margin-left:240px;padding:28px 24px 80px;max-width:1280px}
        .fx-admin-top{display:none}
        @media (max-width: 900px){
          .fx-admin-side{transform:translateX(-100%)}
          .fx-admin-side.open{transform:none;box-shadow:0 0 0 100vmax rgba(0,0,0,.55)}
          .fx-admin-main{margin-left:0;padding:16px 14px 80px}
          .fx-admin-top{display:flex}
        }
      `}</style>
      <aside className={`fx-admin-side${menuOpen ? " open" : ""}`} aria-label="Admin menu">
        <div style={{ color: T.accent, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700 }}>FISH-X.COM</div>
        <div style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 20px" }}>Admin console</div>
        <nav style={{ display: "grid", gap: 2 }}>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                textAlign: "left", border: 0, borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                fontSize: 14, fontFamily: "inherit", fontWeight: tab === k ? 700 : 500,
                background: tab === k ? "rgba(45,226,242,.14)" : "transparent",
                color: tab === k ? T.accent : T.ink,
              }}
            >
              <span>{label}</span>
              {k === "verifications" && pendingDocs > 0 && <span style={{ background: T.accent, color: "#04121B", borderRadius: 999, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>{pendingDocs}</span>}
              {k === "disputes" && data.totals.openDisputes > 0 && <span style={{ background: "#FFB86B", color: "#04121B", borderRadius: 999, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>{data.totals.openDisputes}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()} style={{ ...ghost, width: "100%", marginTop: 20 }}>Sign out</button>
      </aside>
      <main className="fx-admin-main">
        <div className="fx-admin-top" style={{ alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button aria-label="Open menu" onClick={() => setMenuOpen(true)} style={{ ...ghost, padding: "8px 11px", fontSize: 16 }}>☰</button>
          <div style={{ fontWeight: 700 }}>Admin console</div>
        </div>
        {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />}
        <h1 style={{ fontSize: 26, margin: "0 0 18px", fontWeight: 700 }}>{TABS.find(([k]) => k === tab)?.[1]}</h1>

      {tab === "dashboard" && <AdminDashboard overview={data} onGo={(k) => setTab(k as Tab)} />}
      {tab === "operators" && <AdminOperators />}
      {tab === "members" && <AdminMembers />}
      {tab === "listings" && <AdminListings />}
      {tab === "bookings" && <AdminBookings />}
      {tab === "payments" && <AdminPayments />}
      {tab === "activity" && <AdminAudit />}


      {tab === "history" && <AdminHistory businesses={data.businesses as any} />}

      {tab === "verifications" && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.verificationDocuments.length === 0 && <div style={{ ...card, color: T.mut }}>No verification documents yet.</div>}
          {data.verificationDocuments.map((v: any) => (
            <div key={v.id} style={{ ...card, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{v.business?.name ?? "Unknown business"}</div>
                  <div style={{ color: T.mut, fontSize: 13 }}>
                    {v.document_label} · version {v.version} · submitted {day(v.created_at)}
                  </div>
                  {v.status === "rejected" && (v.rejection_reason || v.notes) && (
                    <div style={{ color: "#F87171", fontSize: 13, marginTop: 4, overflowWrap: "anywhere" }}>
                      Rejected {day(v.decided_at)}: {v.rejection_reason || v.notes}
                    </div>
                  )}
                  {v.rejection_reason && <div style={{ color: v.status === "approved" ? T.mut : "#F87171", fontSize: 13, marginTop: 4 }}>{v.rejection_reason}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.mut, textTransform: "uppercase", letterSpacing: ".08em" }}>{v.status}</span>
                  {v.status === "pending" && (
                    <>
                      <button
                        style={btn}
                        disabled={documentDecision.isPending}
                        title="Open the document to approve it"
                        onClick={() => v.viewUrl ? setPreview(v) : undefined}
                      >
                        Review &amp; approve
                      </button>
                      <button
                        style={ghost}
                        disabled={documentDecision.isPending}
                        onClick={() => {
                          setRejectError(null);
                          setRejectReason("");
                          setRejecting(rejecting === v.id ? null : v.id);
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {v.status === "approved" && <button style={ghost} disabled={documentDecision.isPending} onClick={() => { setRejectError(null); setRejectReason(""); setRejecting(rejecting === v.id ? null : v.id); }}>Reopen</button>}
                  {v.viewUrl ? (
                    <button style={{ ...btn, background: "transparent", color: T.accent, border: `1px solid ${T.accent}` }} onClick={() => setPreview(v)}>View document</button>
                  ) : (
                    <span style={{ color: "#FFB86B", fontSize: 12.5 }}>File missing — ask operator to resubmit</span>
                  )}
                  {v.business_id && (
                    <button
                      style={ghost}
                      onClick={() => setHistoryFor(historyFor === v.business_id ? null : v.business_id)}
                    >
                      {historyFor === v.business_id ? "Hide history" : "History"}
                    </button>
                  )}
                </div>
              </div>

              {rejecting === v.id && (
                <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12, display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 13, color: T.mut }}>
                    {v.status === "approved" ? "Why does this accepted document need to be reopened?" : "Why can’t this document be approved? The operator sees this reason."}
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. The insurance certificate expired in March — please upload the current one."
                    style={{
                      background: T.bg,
                      color: T.ink,
                      border: `1px solid ${T.line}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13.5,
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  {rejectError && <div style={{ color: "#F87171", fontSize: 13 }}>{rejectError}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{ ...btn, background: "#F87171" }}
                      disabled={documentDecision.isPending || rejectReason.trim().length < 10}
                      onClick={() =>
                        documentDecision.mutate({ documentId: v.id, action: v.status === "approved" ? "reopen" : "reject", reason: rejectReason.trim() })
                      }
                    >
                      {documentDecision.isPending ? "Sending…" : v.status === "approved" ? "Reopen document" : "Reject with reason"}
                    </button>
                    <button style={ghost} onClick={() => setRejecting(null)}>Cancel</button>
                  </div>
                  {rejectReason.trim().length < 10 && (
                    <div style={{ color: T.mut, fontSize: 12 }}>A reason of at least 10 characters is required.</div>
                  )}
                </div>
              )}

              {historyFor === v.business_id && (
                <BusinessHistory businessId={v.business_id} title="Readiness history" />
              )}
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
      {preview && (
        <DocumentPreviewDialog
          doc={preview}
          busy={documentDecision.isPending}
          error={rejectError}
          onClose={() => { setPreview(null); setRejectError(null); }}
          onDecide={async (action, reason) => {
            setRejectError(null);
            try {
              const r: any = await documentDecision.mutateAsync({ documentId: preview.id, action, reason });
              setPreview(null);
              if (r?.fullyApproved && r.remaining?.length) {
                window.alert(`All documents approved. This operator is still hidden until they complete: ${r.remaining.join(", ")}. They've been notified.`);
              }
            } catch {}
          }}
        />
      )}
      </main>
    </div>
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

/**
 * Staff-only entry point: /admin has its own sign-in screen instead of the
 * public angler/operator auth page. Signing in here never touches the rest of
 * the app's routing.
 */
function AdminGate() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSignedIn(Boolean(data.session?.user));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <Shell><div style={{ ...card, color: T.mut }}>Checking your access…</div></Shell>;
  }
  if (!signedIn) return <AdminLogin />;
  return <AdminConsole />;
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) setErr(error.message);
  };

  const field: React.CSSProperties = {
    width: "100%",
    background: "#0D161F",
    border: `1px solid ${T.line}`,
    borderRadius: 10,
    padding: "11px 12px",
    color: T.ink,
    fontSize: 14,
    fontFamily: "inherit",
    marginTop: 6,
  };

  return (
    <Shell>
      <div style={{ maxWidth: 400, margin: "8vh auto 0" }}>
        <div style={card}>
          <p style={{ margin: 0, color: T.accent, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Fish-X staff
          </p>
          <h1 style={{ margin: "8px 0 4px", fontSize: 24 }}>Admin sign in</h1>
          <p style={{ margin: "0 0 18px", color: T.mut, fontSize: 14 }}>
            This console is limited to Fish-X platform staff.
          </p>
          <form onSubmit={submit}>
            <label style={{ display: "block", fontSize: 13, color: T.mut }}>
              Staff email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={field}
                autoComplete="email"
              />
            </label>
            <label style={{ display: "block", fontSize: 13, color: T.mut, marginTop: 14 }}>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={field}
                autoComplete="current-password"
              />
            </label>
            {err && (
              <p style={{ color: "#FF8A8A", fontSize: 13, margin: "12px 0 0" }}>{err}</p>
            )}
            <button type="submit" disabled={busy} style={{ ...btn, width: "100%", marginTop: 18, padding: "12px 14px", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
