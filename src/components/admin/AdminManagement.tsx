/**
 * Admin management panels: operator directory, member directory, listing
 * moderation, marketplace booking ledger and the action log.
 * Operator dark theme, all data admin-gated server-side.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOperatorDirectory,
  getMemberDirectory,
  setMemberRole,
  getListingModeration,
  setListingPublished,
  getBookingLedger,
  getAuditTrail,
} from "@/lib/admin-directory.functions";

const T = {
  bg: "#0D161F",
  card: "#14202B",
  line: "#22333F",
  ink: "#E8F2F6",
  mut: "#8AA2B0",
  accent: "#2DE2F2",
  warn: "#FFB86B",
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
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};

const ghost: React.CSSProperties = {
  ...btn,
  background: "transparent",
  color: T.ink,
  border: `1px solid ${T.line}`,
};

const input: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.line}`,
  borderRadius: 10,
  padding: "10px 12px",
  color: T.ink,
  outline: "none",
  fontSize: 13.5,
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

function Stats({ items }: { items: Array<[string, string]> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {items.map(([k, v]) => (
        <div key={k} style={card}>
          <div style={{ color: T.mut, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".1em" }}>
            {k}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: T.accent }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

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

/**
 * The single status an operator shows at a glance: approved + published means
 * their storefront is live and taking bookings.
 */
function operatorStatus(o: any): { label: string; tone: "good" | "warn" | "mut"; hint: string } {
  if (o.verified_at && o.is_published)
    return { label: "Live", tone: "good", hint: "Approved · storefront published" };
  if (o.verified_at)
    return { label: "Approved", tone: "good", hint: "Approved · not published yet" };
  if (o.docStatus === "rejected")
    return { label: "Rejected", tone: "warn", hint: "Documents declined" };
  if (o.docStatus === "pending")
    return { label: "Under review", tone: "warn", hint: "Documents awaiting your decision" };
  if (o.onboarding_completed_at)
    return { label: "Unverified", tone: "mut", hint: "Setup done · no documents" };
  return { label: "Setting up", tone: "mut", hint: "Onboarding in progress" };
}

const DOC_LABEL: Record<string, string> = {
  not_submitted: "No documents yet",
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
};

/* ------------------------------- Operators ------------------------------ */

export function AdminOperators() {
  const fetchDir = useServerFn(getOperatorDirectory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-operator-directory"],
    queryFn: () => fetchDir(),
    staleTime: 20_000,
  });
  const [filter, setFilter] = useState<"all" | "pending" | "not_submitted" | "verified" | "incomplete">("all");
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const all = data?.operators ?? [];
    const q = term.trim().toLowerCase();
    return all.filter((o: any) => {
      if (filter === "pending" && o.docStatus !== "pending") return false;
      if (filter === "not_submitted" && o.docStatus !== "not_submitted") return false;
      if (filter === "verified" && !o.verified_at) return false;
      if (filter === "incomplete" && o.onboarding_completed_at) return false;
      if (!q) return true;
      return (
        String(o.name).toLowerCase().includes(q) ||
        String(o.category_key).toLowerCase().includes(q) ||
        String(o.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, filter, term]);

  if (error) return <div style={{ ...card, color: "#FF8A8A" }}>Could not load operators.</div>;
  if (isLoading || !data) return <div style={{ ...card, color: T.mut }}>Loading operators…</div>;

  const t = data.totals;
  return (
    <div>
      <Stats
        items={[
          ["Operators", String(t.operators)],
          ["Awaiting documents", String(t.awaitingDocs)],
          ["Docs to review", String(t.pendingReview)],
          ["Verified", String(t.verified)],
          ["Live storefronts", String(t.live)],
          ["Setup unfinished", String(t.onboardingIncomplete)],
        ]}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(
          [
            ["all", "All"],
            ["pending", "Docs to review"],
            ["not_submitted", "No documents"],
            ["verified", "Verified"],
            ["incomplete", "Setup unfinished"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              ...ghost,
              background: filter === k ? T.accent : "transparent",
              color: filter === k ? "#04121B" : T.ink,
            }}
          >
            {label}
          </button>
        ))}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, type or city"
          style={{ ...input, flex: "1 1 220px", minWidth: 180 }}
        />
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
          <thead>
            <tr style={{ color: T.mut }}>
              {["Operator", "Status", "Owner", "Signed up", "Documents", "Setup", "Listings", "Bookings", "Gross"].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...td, color: T.mut }}>
                  No operators match that view.
                </td>
              </tr>
            )}
            {rows.map((o: any) => (
              <tr key={o.id}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{o.name}</div>
                  <div style={{ color: T.mut, fontSize: 12.5 }}>
                    {String(o.category_key).replace(/_/g, " ")}
                    {o.city ? ` · ${o.city}` : ""}
                    {o.verified_at ? " · verified" : ""}
                  </div>
                </td>
                <td style={{ ...td, color: T.mut }}>
                  {o.owner?.display_name ?? o.owner?.full_name ?? "—"}
                  <div style={{ fontSize: 12 }}>{o.teamSize} on team</div>
                </td>
                <td style={{ ...td, color: T.mut }}>{day(o.created_at)}</td>
                <td style={td}>
                  <Pill
                    tone={
                      o.docStatus === "approved" ? "good" : o.docStatus === "pending" ? "warn" : "mut"
                    }
                  >
                    {DOC_LABEL[o.docStatus] ?? o.docStatus}
                  </Pill>
                  {o.docCount > 0 && (
                    <div style={{ color: T.mut, fontSize: 12, marginTop: 4 }}>{o.docCount} file(s)</div>
                  )}
                </td>
                <td style={td}>
                  <Pill tone={o.onboarding_completed_at ? "good" : "warn"}>
                    {o.onboarding_completed_at ? "Complete" : "In progress"}
                  </Pill>
                  <div style={{ color: T.mut, fontSize: 12, marginTop: 4 }}>
                    {o.payouts_enabled ? "Payouts on" : "Payouts off"}
                  </div>
                </td>
                <td style={{ ...td, color: T.mut }}>
                  {o.liveListings} live / {o.listings}
                </td>
                <td style={{ ...td, color: T.mut }}>{o.bookingCount}</td>
                <td style={{ ...td, fontWeight: 700 }}>{money(o.grossCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Members ------------------------------- */

const ASSIGNABLE = [
  "admin",
  "angler",
  "captain",
  "guide_service",
  "marina",
  "lodge",
  "tackle_shop",
  "bait_shop",
  "gear_mfg",
  "apparel",
  "business_owner",
] as const;

export function AdminMembers() {
  const fetchMembers = useServerFn(getMemberDirectory);
  const changeRole = useServerFn(setMemberRole);
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<"all" | "angler" | "operator" | "staff">("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-members"],
    queryFn: () => fetchMembers({ data: {} }),
    staleTime: 20_000,
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: string; grant: boolean }) =>
      changeRole({ data: v as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-members"] }),
    onError: (e: unknown) =>
      window.alert(e instanceof Error ? e.message : "That change could not be saved."),
  });

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data?.members ?? []).filter((m: any) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (!q) return true;
      return `${m.display_name ?? ""} ${m.full_name ?? ""}`.toLowerCase().includes(q);
    });
  }, [data, term, kind]);

  if (error) return <div style={{ ...card, color: "#FF8A8A" }}>Could not load members.</div>;
  if (isLoading || !data) return <div style={{ ...card, color: T.mut }}>Loading members…</div>;

  return (
    <div>
      <Stats
        items={[
          ["Members", String(data.totals.all)],
          ["Anglers", String(data.totals.anglers)],
          ["Operators", String(data.totals.operators)],
          ["Staff", String(data.totals.staff)],
        ]}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(["all", "angler", "operator", "staff"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            style={{
              ...ghost,
              textTransform: "capitalize",
              background: kind === k ? T.accent : "transparent",
              color: kind === k ? "#04121B" : T.ink,
            }}
          >
            {k}
          </button>
        ))}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name"
          style={{ ...input, flex: "1 1 220px", minWidth: 180 }}
        />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.length === 0 && <div style={{ ...card, color: T.mut }}>No members match that view.</div>}
        {rows.map((m: any) => (
          <MemberRow key={m.id} member={m} busy={roleMut.isPending} onChange={roleMut.mutate} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  busy,
  onChange,
}: {
  member: any;
  busy: boolean;
  onChange: (v: { userId: string; role: string; grant: boolean }) => void;
}) {
  const [role, setRole] = useState<string>("angler");
  return (
    <div style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
      <div style={{ minWidth: 220 }}>
        <div style={{ fontWeight: 700 }}>{member.display_name ?? member.full_name ?? "Unnamed member"}</div>
        <div style={{ color: T.mut, fontSize: 12.5 }}>
          Joined {day(member.created_at)} · {member.businessCount} business(es)
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {member.roles.length === 0 && <Pill tone="mut">no role</Pill>}
          {member.roles.map((r: string) => (
            <button
              key={r}
              disabled={busy}
              title="Remove this role"
              onClick={() => onChange({ userId: member.id, role: r, grant: false })}
              style={{
                ...ghost,
                padding: "2px 9px",
                fontSize: 11.5,
                borderRadius: 999,
                color: T.accent,
                borderColor: T.accent,
              }}
            >
              {r.replace(/_/g, " ")} ✕
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={input}>
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button
          style={btn}
          disabled={busy}
          onClick={() => onChange({ userId: member.id, role, grant: true })}
        >
          Add role
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Listings ------------------------------ */

export function AdminListings() {
  const fetchListings = useServerFn(getListingModeration);
  const setPublished = useServerFn(setListingPublished);
  const qc = useQueryClient();
  const [view, setView] = useState<"all" | "live" | "hidden">("all");
  const [term, setTerm] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: () => fetchListings(),
    staleTime: 20_000,
  });

  const mut = useMutation({
    mutationFn: (v: { id: string; type: "service" | "product"; published: boolean }) =>
      setPublished({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-listings"] }),
    onError: (e: unknown) =>
      window.alert(e instanceof Error ? e.message : "That listing could not be updated."),
  });

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data?.listings ?? []).filter((l: any) => {
      if (view === "live" && !l.isPublished) return false;
      if (view === "hidden" && l.isPublished) return false;
      if (!q) return true;
      return (
        String(l.title).toLowerCase().includes(q) ||
        String(l.business?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, view, term]);

  if (error) return <div style={{ ...card, color: "#FF8A8A" }}>Could not load listings.</div>;
  if (isLoading || !data) return <div style={{ ...card, color: T.mut }}>Loading listings…</div>;

  return (
    <div>
      <Stats
        items={[
          ["Listings", String(data.totals.all)],
          ["Live", String(data.totals.live)],
          ["Hidden", String(data.totals.hidden)],
        ]}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(["all", "live", "hidden"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setView(k)}
            style={{
              ...ghost,
              textTransform: "capitalize",
              background: view === k ? T.accent : "transparent",
              color: view === k ? "#04121B" : T.ink,
            }}
          >
            {k}
          </button>
        ))}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search listing or operator"
          style={{ ...input, flex: "1 1 220px", minWidth: 180 }}
        />
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 780 }}>
          <thead>
            <tr style={{ color: T.mut }}>
              {["Listing", "Operator", "Price", "Added", "Status", ""].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...td, color: T.mut }}>
                  Nothing to review here.
                </td>
              </tr>
            )}
            {rows.map((l: any) => (
              <tr key={`${l.type}-${l.id}`}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{l.title}</div>
                  <div style={{ color: T.mut, fontSize: 12.5, textTransform: "capitalize" }}>{l.subtitle}</div>
                </td>
                <td style={{ ...td, color: T.mut }}>{l.business?.name ?? "—"}</td>
                <td style={td}>{money(l.priceCents)}</td>
                <td style={{ ...td, color: T.mut }}>{day(l.createdAt)}</td>
                <td style={td}>
                  <Pill tone={l.isPublished ? "good" : "mut"}>{l.isPublished ? "Live" : "Hidden"}</Pill>
                </td>
                <td style={td}>
                  <button
                    style={ghost}
                    disabled={mut.isPending}
                    onClick={() =>
                      mut.mutate({ id: l.id, type: l.type, published: !l.isPublished })
                    }
                  >
                    {l.isPublished ? "Hide" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Bookings ------------------------------ */

export function AdminBookings() {
  const fetchLedger = useServerFn(getBookingLedger);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-booking-ledger"],
    queryFn: () => fetchLedger(),
    staleTime: 20_000,
  });

  if (error) return <div style={{ ...card, color: "#FF8A8A" }}>Could not load bookings.</div>;
  if (isLoading || !data) return <div style={{ ...card, color: T.mut }}>Loading bookings…</div>;

  return (
    <div>
      <Stats
        items={[
          ["Bookings", String(data.totals.bookings)],
          ["Gross value", money(data.totals.grossCents)],
          ["Deposits taken", money(data.totals.depositCents)],
          ["Cancelled", String(data.totals.cancelled)],
        ]}
      />
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 820 }}>
          <thead>
            <tr style={{ color: T.mut }}>
              {["Booked", "Trip date", "Operator", "Guest", "Status", "Deposit", "Total"].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, color: T.mut }}>
                  No bookings yet.
                </td>
              </tr>
            )}
            {data.rows.map((b: any) => (
              <tr key={b.id}>
                <td style={{ ...td, color: T.mut }}>{day(b.created_at)}</td>
                <td style={td}>
                  {b.trip_date ? new Date(b.trip_date).toLocaleDateString() : "—"}
                  {b.start_time ? ` · ${String(b.start_time).slice(0, 5)}` : ""}
                </td>
                <td style={td}>{b.business?.name ?? "—"}</td>
                <td style={{ ...td, color: T.mut }}>
                  {b.angler?.display_name ?? b.angler?.full_name ?? "—"}
                </td>
                <td style={{ ...td, textTransform: "capitalize", color: T.mut }}>
                  {String(b.status).replace(/_/g, " ")}
                </td>
                <td style={td}>{money(b.deposit_cents)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{money(b.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Audit -------------------------------- */

export function AdminAudit() {
  const fetchTrail = useServerFn(getAuditTrail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => fetchTrail(),
    staleTime: 20_000,
  });

  if (error) return <div style={{ ...card, color: "#FF8A8A" }}>Could not load the log.</div>;
  if (isLoading || !data) return <div style={{ ...card, color: T.mut }}>Loading the log…</div>;
  if (data.length === 0) return <div style={{ ...card, color: T.mut }}>No staff actions recorded yet.</div>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((a: any) => (
        <div key={a.id} style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, textTransform: "capitalize" }}>
              {String(a.action).replace(/[._]/g, " ")}
            </div>
            <div style={{ color: T.mut, fontSize: 12.5 }}>
              {a.target_type ?? "—"} {a.target_id ? String(a.target_id).slice(0, 8) : ""}
              {a.meta_json?.role ? ` · ${String(a.meta_json.role).replace(/_/g, " ")}` : ""}
            </div>
          </div>
          <div style={{ color: T.mut, fontSize: 12.5 }}>{new Date(a.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
