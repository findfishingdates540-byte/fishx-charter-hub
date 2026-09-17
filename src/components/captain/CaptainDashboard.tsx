/**
 * Captain dashboard — React port of public/dashboards/captain.html,
 * wired to live Supabase data via getCaptainDashboard and the
 * captain-management server functions (bookings list, services CRUD,
 * earnings, messages).
 */
import { useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCaptainDashboard } from "@/lib/captain-dashboard.functions";
import {
  listCaptainBookings,
  listCaptainConversations,
  getCaptainEarnings,
} from "@/lib/captain-management.functions";
import { CaptainMessages } from "./CaptainMessages";
import { MessagesFullScreen } from "@/components/messages/MessagesFullScreen";
import { PaymentsDashboard } from "@/components/operator/PaymentsDashboard";
import { BusinessSettings } from "@/components/business/BusinessSettings";
import { DEFAULT_HERO } from "@/lib/platform-photos";
import { ReadinessGate } from "@/components/operator/ReadinessGate";
import { RequestInbox } from "@/components/operator/RequestInbox";
import { FleetPanel } from "@/components/captain/FleetPanel";
import { ChartersPanel } from "@/components/captain/ChartersPanel";
import { BlockoutDatesPanel } from "@/components/captain/BlockoutDatesPanel";
import { CaptainTripCalendar } from "@/components/captain/CaptainTripCalendar";


export const captainDashboardQO = queryOptions({
  queryKey: ["captain-dashboard"],
  queryFn: () => getCaptainDashboard(),
});

type Tab = "overview" | "bookings" | "calendar" | "services" | "blockouts" | "fleet" | "messages" | "earnings" | "settings";

const money = (cents: number) =>
  `$${(Math.max(0, cents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const shell: React.CSSProperties = {
  ["--serif" as never]: "'Outfit',Georgia,serif",
  ["--sans" as never]: "'Outfit',system-ui,sans-serif",
  ["--ink" as never]: "#F0F2F5",
  ["--navy" as never]: "#0D161F",
  ["--paper" as never]: "#0D161F",
  ["--card" as never]: "#14202B",
  ["--goldtext" as never]: "#2DE2F2",
  ["--cyan" as never]: "#2DE2F2",
  ["--green" as never]: "#22C55E",
  ["--greensoft" as never]: "rgba(34,197,94,.14)",
  ["--ond" as never]: "#F0F2F5",
  ["--ondmut" as never]: "#92A0AB",
  ["--tmut" as never]: "#92A0AB",
  ["--line" as never]: "rgba(255,255,255,.08)",
  ["--lined" as never]: "rgba(255,255,255,.10)",
  display: "flex",
  minHeight: "100vh",
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
};

const TABS: Tab[] = ["overview", "bookings", "calendar", "services", "blockouts", "fleet", "messages", "earnings", "settings"];

export function CaptainDashboard({ initialTab }: { initialTab?: string } = {}) {
  const { data } = useSuspenseQuery(captainDashboardQO);
  // Editor pages return here with ?tab=services, so honour the requested tab.
  const [tab, setTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview",
  );
  // Which Settings section to open when arriving from the readiness checklist.
  const [settingsSection, setSettingsSection] = useState<string>("profile");
  const [accepting, setAccepting] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const biz = data.business;
  const initial = (data.profile?.display_name || data.profile?.full_name || "C")
    .trim()
    .charAt(0)
    .toUpperCase();

  const pageTitle: Record<Tab, string> = {
    overview: `Welcome back, Captain`,
    bookings: "Bookings",
    calendar: "Trip Calendar",

    services: "Charter Trips",
    blockouts: "Blockout Dates",
    fleet: "Fleet",
    messages: "Messages",
    earnings: "Earnings",
    settings: "Settings",
  };
  const pageSub: Record<Tab, string> = {
    overview: biz ? `${biz.name} · ${[biz.city, biz.region].filter(Boolean).join(", ")}` : "Set up your business to see bookings.",
    bookings: `${data.stats.upcomingCount} upcoming · ${data.stats.completedCount} completed`,
    services: "Create the charter trips anglers can book",
    blockouts: "Close date ranges across all your charters",
    fleet: "Boats, specs, and photo galleries — each charter picks one",
    messages: "Guest conversations",
    earnings: "Payouts and escrow",
    settings: "Business & payout settings",
  };

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="fx-shell" style={shell}>
      {/* SIDEBAR */}
      <aside className={`fx-side${navOpen ? " fx-open" : ""}`} style={{ width: 256, flex: "none", background: "var(--navy)", color: "var(--ond)", display: "flex", flexDirection: "column", padding: "22px 16px", position: "sticky", top: 0, height: "100vh", borderRight: "1px solid rgba(255,255,255,.06)" }}>
        <div className="fx-side-head" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 22px" }}>
          <BrandLogo size="md" accent="var(--cyan)" color="var(--ond)" />
          <button
            type="button"
            className="fx-side-burger"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
            style={{ marginLeft: "auto", background: "rgba(255,255,255,.06)", border: "1px solid var(--lined)", borderRadius: 10, width: 40, height: 40, display: "grid", placeItems: "center", color: "var(--ink)", cursor: "pointer" }}
          >
            {navOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            )}
          </button>
        </div>
        <div className="fx-side-body" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,.04)", border: "1px solid var(--lined)", borderRadius: 13, padding: "11px 12px", marginBottom: 18 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(45,226,242,.14)", display: "grid", placeItems: "center", color: "var(--cyan)", flex: "none", fontFamily: "var(--serif)", fontWeight: 600 }}>
            {biz?.name.charAt(0).toUpperCase() ?? "C"}
          </span>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ondmut)" }}>Workspace</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#F0F2F5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {biz?.name ?? "No business"}
            </div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {(["overview", "bookings", "services", "blockouts", "fleet", "messages", "earnings"] as Tab[]).map((t) => (
            <NavBtn key={t} label={t === "services" ? "Charter Trips" : t === "blockouts" ? "Blockout Dates" : t === "fleet" ? "Fleet" : cap(t)} active={tab === t} onClick={() => { setTab(t); setNavOpen(false); }} badge={t === "bookings" ? data.stats.upcomingCount : undefined} />
          ))}
        </nav>
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--lined)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ondmut)", padding: "0 12px 8px" }}>Account</div>
          <NavBtn label="Settings" active={tab === "settings"} onClick={() => { setTab("settings"); setNavOpen(false); }} />
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,.04)", border: "1px solid var(--lined)", borderRadius: 13, padding: "10px 12px" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(45,226,242,.14)", display: "grid", placeItems: "center", color: "var(--cyan)", fontFamily: "var(--serif)", fontWeight: 600 }}>{initial}</div>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F0F2F5" }}>{data.profile?.display_name ?? data.profile?.full_name ?? "Captain"}</div>
            <div style={{ fontSize: 11, color: "var(--cyan)" }}>{biz?.verified_at ? "★ Verified" : "Pending verification"}</div>
          </div>
          <button onClick={signOut} title="Sign out" style={{ marginLeft: "auto", background: "transparent", color: "var(--ondmut)", border: 0, cursor: "pointer", flex: "none" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></svg>
          </button>
        </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="fx-topbar" style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(13,22,31,.86)", backdropFilter: "saturate(140%) blur(12px)", borderBottom: "1px solid var(--line)", padding: "18px 34px", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 26, lineHeight: 1.1, color: "var(--ink)" }}>{pageTitle[tab]}</div>
            <div style={{ fontSize: 13, color: "var(--tmut)", marginTop: 1 }}>{pageSub[tab]}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 30, padding: "5px 6px 5px 14px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accepting ? "var(--green)" : "#F87171" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{accepting ? "Accepting" : "Paused"}</span>
              </span>
              <button
                onClick={() => setAccepting((v) => !v)}
                style={{ position: "relative", width: 40, height: 23, borderRadius: 20, border: 0, cursor: "pointer", background: accepting ? "var(--green)" : "#F87171", padding: 0 }}
              >
                <span style={{ position: "absolute", top: 2, left: accepting ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#14202B", transition: "left .3s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
              </button>
            </div>
          </div>
        </header>

        <main className="fx-main" style={{ flex: 1, padding: "30px 34px 48px", maxWidth: 1180, width: "100%" }}>
          {tab === "overview" && (
            <OverviewPanel
              data={data}
              onGoto={setTab}
              onGotoSettings={(section) => {
                setSettingsSection(section);
                setTab("settings");
              }}
            />
          )}
          {tab === "bookings" && <BookingsPanel />}
          {tab === "calendar" && <CaptainTripCalendar />}
          {tab === "services" && <ChartersPanel data={data} />}
          {tab === "blockouts" && <BlockoutDatesPanel />}
          {tab === "fleet" && <FleetPanel businessId={data.business?.id ?? null} />}
          {tab === "messages" && (
            <MessagesFullScreen theme="dark" title="Messages" subtitle="Trip threads and direct enquiries" onBack={() => setTab("overview")}>
              <CaptainMessages businessId={data.business?.id ?? null} fullHeight />
            </MessagesFullScreen>
          )}
          {tab === "earnings" && <EarningsPanel businessId={data.business?.id ?? null} />}
          {tab === "settings" && <SettingsPanel data={data} section={settingsSection} />}
        </main>
      </div>
    </div>
  );
}

function cap(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function NavBtn({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        background: active ? "rgba(45,226,242,.12)" : "transparent",
        border: 0,
        borderRadius: 11,
        padding: "11px 12px",
        cursor: "pointer",
        fontFamily: "var(--sans)",
        fontSize: 14,
        fontWeight: 600,
        color: active ? "#F0F2F5" : "var(--ondmut)",
        textAlign: "left",
      }}
    >
      {label}
      {badge ? (
        <span style={{ marginLeft: "auto", background: "var(--cyan)", color: "#04121B", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 8px" }}>{badge}</span>
      ) : null}
    </button>
  );
}

type CaptainData = Awaited<ReturnType<typeof getCaptainDashboard>>;

/* ---------------- OVERVIEW ---------------- */

function OverviewPanel({
  data,
  onGoto,
  onGotoSettings,
}: {
  data: CaptainData;
  onGoto: (t: Tab) => void;
  onGotoSettings: (section: string) => void;
}) {
  const { stats, upcoming, services } = data;
  // Each readiness item opens the exact place where it can be fixed.
  const navToTab: Record<string, Tab> = {
    listings: "services",
    slots: "services",
  };
  const navToSettingsSection: Record<string, string> = {
    payouts: "payouts",
    verification: "visibility",
    profile: "profile",
    settings: "profile",
  };
  return (
    <div>
      <ReadinessGate
        onNav={(k) => {
          const tab = navToTab[k];
          if (tab) {
            onGoto(tab);
            return;
          }
          onGotoSettings(navToSettingsSection[k] ?? "profile");
        }}
        compact
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 22 }}>
        <KpiCard label="This month" value={money(stats.grossCents)} sub="Gross earnings" />
        <KpiCard label="Upcoming" value={String(stats.upcomingCount)} sub="Trips booked" />
        <KpiCard label="In escrow" value={money(stats.escrowCents)} sub="Held until completed" />
        <KpiCard label="Completed" value={String(stats.completedCount)} sub="Lifetime trips" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginBottom: 22 }}>
        <Panel title="Upcoming bookings" action={{ label: "View all →", onClick: () => onGoto("bookings") }}>
          {upcoming.length === 0 && <Empty text="No upcoming trips yet." />}
          {upcoming.map((b, i) => (
            <Link
              key={b.id}
              to="/bookings/detail"
              search={{ id: b.id }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < upcoming.length - 1 ? "1px solid var(--line)" : "none", textDecoration: "none", color: "inherit" }}
            >
              <MediaImg src={b.service?.hero_url || DEFAULT_HERO} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{b.service?.title ?? "Charter"}</div>
                <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
                  {new Date(b.trip_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  {b.start_time ? ` · ${b.start_time.slice(0, 5)}` : ""}
                  {b.party_size ? ` · ${b.party_size} guests` : ""}
                </div>
              </div>
              <StatusPill status={b.status} />
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--goldtext)", fontWeight: 600, marginLeft: 12 }}>{money(b.total_cents ?? 0)}</div>
            </Link>
          ))}
        </Panel>

        <Panel title="Your services" action={{ label: "Manage →", onClick: () => onGoto("services") }}>
          {services.length === 0 && <Empty text="Publish a trip to start receiving bookings." />}
          {services.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < services.length - 1 ? "1px solid var(--line)" : "none" }}>
              <MediaImg src={s.hero_url || DEFAULT_HERO} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--tmut)" }}>{money(s.base_price_cents ?? 0)} · up to {s.capacity ?? "—"}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 9px", color: s.is_published ? "var(--green)" : "var(--tmut)", background: s.is_published ? "var(--greensoft)" : "var(--line)" }}>
                {s.is_published ? "Live" : "Draft"}
              </span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- BOOKINGS ---------------- */

const BOOKING_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending_confirmation", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

function BookingsPanel() {
  const [filter, setFilter] = useState<(typeof BOOKING_FILTERS)[number]["key"]>("all");
  const fn = useServerFn(listCaptainBookings);
  const { data, isLoading } = useQuery({
    queryKey: ["captain-bookings", filter],
    queryFn: () => fn({ data: { status: filter as any } }),
  });
  const rows = data?.rows ?? [];
  return (
    <div>
      <Panel title="Requests awaiting your response">
        <RequestInbox emptyText="No booking requests waiting on you right now." />
      </Panel>
      <div style={{ height: 18 }} />
    <Panel title="All bookings">
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {BOOKING_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--line)",
              background: filter === f.key ? "var(--sand, #2DE2F2)" : "transparent",
              color: filter === f.key ? "#04121B" : "var(--tmut)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isLoading && <Empty text="Loading…" />}
      {!isLoading && rows.length === 0 && <Empty text="No bookings match this filter." />}
      {rows.map((b: any, i: number) => (
        <Link
          key={b.id}
          to="/bookings/detail"
          search={{ id: b.id }}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none", textDecoration: "none", color: "inherit" }}
        >
          <MediaImg src={b.service?.hero_url || DEFAULT_HERO} alt="" style={{ width: 52, height: 52, borderRadius: 11, objectFit: "cover", flex: "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{b.service?.title ?? "Charter"}</div>
            <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
              {new Date(b.trip_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {b.customer?.full_name ? ` · ${b.customer.full_name}` : ""}
              {b.party_size ? ` · ${b.party_size} guests` : ""}
            </div>
          </div>
          <StatusPill status={b.status} />
          <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--goldtext)", fontWeight: 600, marginLeft: 12, minWidth: 90, textAlign: "right" }}>{money(b.total_cents ?? 0)}</div>
        </Link>
      ))}
    </Panel>
    </div>
  );
}

/* ---------------- EARNINGS ---------------- */

function EarningsPanel({ businessId }: { businessId: string | null }) {
  const fn = useServerFn(getCaptainEarnings);
  const { data, isLoading } = useQuery({ queryKey: ["captain-earnings"], queryFn: () => fn() });
  if (isLoading || !data) return <Empty text="Loading…" />;
  const maxMonth = Math.max(1, ...data.monthly.map((m) => m.cents));
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
        <KpiCard label="Gross" value={money(data.totals.grossCents)} sub="Completed trips" />
        <KpiCard label="Platform fee (10%)" value={money(data.totals.feeCents)} sub="Fish-X commission" />
        <KpiCard label="Net earnings" value={money(data.totals.netCents)} sub="Your payout" />
        <KpiCard label="In escrow" value={money(data.totals.escrowCents)} sub="Releases on completion" />
      </div>

      <Panel title="Monthly gross">
        {data.monthly.length === 0 && <Empty text="No completed trips yet." />}
        {data.monthly.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180, padding: "10px 0" }}>
            {data.monthly.map((m) => (
              <div key={m.ym} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--goldtext)" }}>{money(m.cents)}</div>
                <div
                  style={{
                    width: "100%",
                    height: `${(m.cents / maxMonth) * 140}px`,
                    minHeight: 4,
                    background: "linear-gradient(180deg,var(--cyan),var(--goldtext))",
                    borderRadius: "6px 6px 0 0",
                  }}
                />
                <div style={{ fontSize: 11, color: "var(--tmut)" }}>{m.ym}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="By service">
        {data.byService.length === 0 && <Empty text="No breakdown yet." />}
        {data.byService.map((s, i) => (
          <div key={s.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < data.byService.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{s.title}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--goldtext)", fontWeight: 600 }}>{money(s.cents)}</div>
          </div>
        ))}
      </Panel>

      {businessId && (
        <div style={{ background: "#1C2936", margin: -4, padding: 4, borderRadius: 18 }}>
          <PaymentsDashboard businessId={businessId} />
        </div>
      )}
    </div>

  );
}

/* ---------------- MESSAGES ---------------- */

function SettingsPanel({ data, section }: { data: CaptainData; section?: string }) {
  const biz = data.business;
  if (!biz) return <Empty text="Complete onboarding to set up your business." />;
  return (
    <div style={{ background: "#1C2936", margin: -4, padding: 4, borderRadius: 18 }}>
      <BusinessSettings businessId={biz.id} initialSection={section} />
    </div>
  );
}

/* ---------------- SHARED ---------------- */

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tmut)", marginBottom: 12 }}>{label}</div>
      <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 30, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--tmut)", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 21, color: "var(--ink)" }}>{title}</div>
        {action && (
          <button onClick={action.onClick} style={{ background: "transparent", border: 0, color: "var(--goldtext)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: "24px 0", fontSize: 13.5, color: "var(--tmut)", textAlign: "center" }}>{text}</div>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending_payment: { bg: "rgba(45,226,242,.15)", fg: "#2DE2F2", label: "Awaiting payment" },
    pending_confirmation: { bg: "rgba(45,226,242,.15)", fg: "#2DE2F2", label: "Pending" },
    confirmed: { bg: "rgba(45,226,242,.12)", fg: "#2DE2F2", label: "In escrow" },
    in_progress: { bg: "rgba(34,197,94,.14)", fg: "#22C55E", label: "In progress" },
    completed: { bg: "rgba(34,197,94,.14)", fg: "#22C55E", label: "Completed" },
    reviewed: { bg: "rgba(34,197,94,.14)", fg: "#22C55E", label: "Reviewed" },
    cancelled: { bg: "rgba(216,81,74,.12)", fg: "#F87171", label: "Cancelled" },
    refunded: { bg: "rgba(216,81,74,.12)", fg: "#F87171", label: "Refunded" },
  };
  const cfg = map[status] ?? { bg: "rgba(255,255,255,.06)", fg: "#92A0AB", label: status.replace(/_/g, " ") };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.fg, borderRadius: 20, padding: "3px 9px", flex: "none", textTransform: "capitalize" }}>
      {cfg.label}
    </span>
  );
}
