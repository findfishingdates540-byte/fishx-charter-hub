/**
 * Angler dashboard — React port of public/dashboards/angler.html.
 * Pixel-close to the DC template, wired to live Supabase data.
 */
import { useMemo, useState, useEffect, Suspense } from "react";
import { cachedMediaUrl } from "@/lib/media-url";
import { MediaImg } from "@/components/media/MediaImg";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";

import {
  getAnglerDashboard,
  listRecommendedCharters,
} from "@/lib/angler-dashboard.functions";
import { ExploreHub } from "./ExploreHub";
import { TripsTab } from "./TripsTab";
import { DEFAULT_HERO } from "@/lib/platform-photos";
import { AnglerBookingHistory, AnglerPayments } from "./AnglerConsole";

const anglerHomeQO = queryOptions({
  queryKey: ["angler-dashboard"],
  queryFn: () => getAnglerDashboard(),
});
const recosQO = queryOptions({
  queryKey: ["angler-recos"],
  queryFn: () => listRecommendedCharters(),
});

type Tab = "home" | "trips" | "history" | "explore" | "wallet" | "orders";

const money = (cents: number) =>
  `$${(Math.max(0, cents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const styleVars: React.CSSProperties = {
  ["--serif" as never]: "'Outfit',Georgia,serif",
  ["--sans" as never]: "'Outfit',system-ui,sans-serif",
  ["--ink" as never]: "#031029",
  ["--navy" as never]: "#072057",
  ["--navy2" as never]: "#0c2a42",
  ["--paper" as never]: "#ffffff",
  ["--card" as never]: "#ffffff",
  ["--sand" as never]: "#2DE2F2",
  ["--sandsoft" as never]: "#E2F6FA",
  ["--goldtext" as never]: "#1F9FBE",
  ["--cyan" as never]: "#1f9fbe",
  ["--green" as never]: "#1f8a5b",
  ["--greensoft" as never]: "#e2f2ea",
  ["--ond" as never]: "#eaf1f6",
  ["--ondmut" as never]: "#93a7b7",
  ["--tmut" as never]: "#5c6b78",
  ["--line" as never]: "rgba(13,34,54,.10)",
  ["--lined" as never]: "rgba(255,255,255,.12)",
  minHeight: "100vh",
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
};

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [target]);
  return useMemo(() => {
    if (!target) return { days: "—", hrs: "—", min: "—" };
    const diff = Math.max(0, target.getTime() - now.getTime());
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return {
      days: String(d).padStart(2, "0"),
      hrs: String(h).padStart(2, "0"),
      min: String(m).padStart(2, "0"),
    };
  }, [target, now]);
}

export function AnglerDashboard() {
  const search = useSearch({ strict: false }) as { tab?: string };
  const initialTab: Tab =
    search.tab && ["home", "trips", "history", "explore", "wallet", "orders"].includes(search.tab)
      ? (search.tab as Tab)
      : "home";
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const navigate = useNavigate();
  // Tab changes are written to the URL (?tab=…) so the browser back button and
  // page refreshes restore the exact tab the angler was on.
  const goTab = (t: Tab) => {
    setTab(t);
    navigate({ to: "/dashboard", search: (prev) => ({ ...prev, tab: t }) });
  };
  const { data: home } = useSuspenseQuery(anglerHomeQO);
  const { data: recos } = useSuspenseQuery(recosQO);

  const initial =
    (home.profile?.display_name || home.profile?.full_name || "A").trim().charAt(0).toUpperCase() ||
    "A";
  const firstName =
    (home.profile?.display_name || home.profile?.full_name || "Angler").split(" ")[0] || "Angler";
  const nextTrip = home.upcoming[0] ?? null;
  const nextTripDate = nextTrip ? new Date(`${nextTrip.trip_date}T${nextTrip.start_time ?? "08:00"}`) : null;
  const cd = useCountdown(nextTripDate);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div id="ang-dash" style={styleVars}>
      {/* TOP NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--navy)", color: "var(--ond)" }}>
        <div className="ang-topbar" style={{ maxWidth: "100%", margin: "0 auto", padding: "0 44px", minHeight: 66, height: "auto", display: "flex", alignItems: "center", flexWrap: "nowrap", gap: 16, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "0 0 auto" }}>
            <BrandLogo size="md" accent="var(--sand)" color="var(--ond)" />
          </div>
          <nav className="ang-topnav" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: "1 1 auto", overflowX: "auto", overflowY: "hidden" }}>
            {(["home", "trips", "history", "explore", "wallet", "orders"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => goTab(t)}
                style={{
                  background: tab === t ? "rgba(255,255,255,.08)" : "transparent",
                  border: 0,
                  borderRadius: 10,
                  padding: "9px 15px",
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: tab === t ? "#fff" : "var(--ondmut)",
                  whiteSpace: "nowrap",
                }}
              >
                {t === "home" ? "Home" : t === "trips" ? "My Trips" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <Link
              to="/messages"
              style={{
                background: "transparent",
                borderRadius: 10,
                padding: "9px 15px",
                fontFamily: "var(--sans)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ondmut)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Messages
            </Link>
            <Link
              to="/marketplace"
              style={{
                background: "transparent",
                borderRadius: 10,
                padding: "9px 15px",
                fontFamily: "var(--sans)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ondmut)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Marketplace ↗
            </Link>
          </nav>
          <div className="ang-topactions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flex: "0 0 auto", minWidth: 0 }}>
            <NotificationBell />

            <label className="ang-topsearch" style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.06)", border: "1px solid var(--lined)", borderRadius: 30, padding: "7px 11px", maxWidth: 145, width: "100%", flex: "0 1 145px", minWidth: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93a7b7" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search charters & gear…"
                style={{ border: 0, outline: "none", background: "transparent", fontFamily: "var(--sans)", fontSize: 12.5, color: "#fff", width: "100%" }}
              />
            </label>
            <Link
              to="/settings"
              title="Settings"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "1px solid var(--lined)", display: "grid", placeItems: "center", color: "var(--ond)", textDecoration: "none" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M4.8 14.6 3.4 15.6l1.6 2.8 1.7-.6a7.6 7.6 0 0 0 1.7 1l.3 1.8h3.2l.3-1.8a7.6 7.6 0 0 0 1.7-1l1.7.6 1.6-2.8-1.4-1a7.7 7.7 0 0 0 0-2l1.4-1-1.6-2.8-1.7.6a7.6 7.6 0 0 0-1.7-1L12 4.4H8.8l-.3 1.8a7.6 7.6 0 0 0-1.7 1l-1.7-.6-1.6 2.8 1.4 1a7.7 7.7 0 0 0 0 2Z" />
              </svg>
            </Link>
            <Link
              to="/settings"
              title="Your account"
              style={{ display: "flex", alignItems: "center", gap: 9, background: "transparent", border: 0, cursor: "pointer", textDecoration: "none" }}
            >
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(45,226,242,.16)", display: "grid", placeItems: "center", fontFamily: "var(--sans)", fontSize: 15, fontWeight: 700, color: "var(--sand)" }}>
                {initial}
              </div>
              <span className="ang-topname" style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>{firstName}</span>
            </Link>
            <button
              className="ang-signout"
              onClick={handleSignOut}
              title="Sign out"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "1px solid var(--lined)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ond)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>


      <main
        style={
          tab === "explore" || tab === "trips"
            ? { width: "100%", margin: 0, padding: 0 }
            : { maxWidth: 1160, margin: "0 auto", padding: "30px 28px 56px" }
        }
      >
        <Suspense fallback={<TabLoading />}>
          {tab === "home" && (
            <HomeTab
              firstName={firstName}
              nextTrip={nextTrip}
              cd={cd}
              escrowCents={home.escrowCents}
              upcomingCount={home.upcomingCount}
              completedCount={home.completedCount}
              upcoming={home.upcoming}
              recos={recos}
              onGoTrips={() => goTab("trips")}
              onGoExplore={() => goTab("explore")}
            />
          )}
          {tab === "trips" && <TripsTab />}
          {tab === "history" && <AnglerBookingHistory />}
          {tab === "explore" && <ExploreHub />}
          {tab === "wallet" && <AnglerPayments />}
          {tab === "orders" && <AnglerPayments />}
        </Suspense>
      </main>
    </div>
  );
}

function TabLoading() {
  return (
    <div
      style={{
        minHeight: 320,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ondmut, #7d93a6)",
        fontFamily: "var(--sans)",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}


/* ------------------------------ HOME TAB ------------------------------ */

type UpcomingBooking = Awaited<ReturnType<typeof getAnglerDashboard>>["upcoming"][number];
type Reco = Awaited<ReturnType<typeof listRecommendedCharters>>[number];

function HomeTab(props: {
  firstName: string;
  nextTrip: UpcomingBooking | null;
  cd: { days: string; hrs: string; min: string };
  escrowCents: number;
  upcomingCount: number;
  completedCount: number;
  upcoming: UpcomingBooking[];
  recos: Reco[];
  onGoTrips: () => void;
  onGoExplore: () => void;
}) {
  const { nextTrip, cd, escrowCents, upcomingCount, completedCount, upcoming, recos } = props;
  const nextHero = nextTrip?.service?.hero_url || nextTrip?.business?.hero_url || DEFAULT_HERO;
  const nextTitle = nextTrip?.service?.title ?? "No trips booked yet";
  const nextPlace = nextTrip?.service?.departure_location || [nextTrip?.business?.city, nextTrip?.business?.region].filter(Boolean).join(", ") || "—";
  const nextDateStr = nextTrip
    ? new Date(nextTrip.trip_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "Book your first charter to see it here.";
  const capName = nextTrip?.business?.name ?? "Your captain";

  return (
    <div>
      {/* NEXT TRIP HERO */}
      <div style={{ position: "relative", background: "var(--navy)", borderRadius: 22, overflow: "hidden", display: "grid", gridTemplateColumns: "1.05fr 1fr", minHeight: 300, marginBottom: 22 }}>
        <div style={{ position: "relative", minHeight: 240 }}>
          <MediaImg src={nextHero} alt="Upcoming charter" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(10,34,54,0) 40%,rgba(10,34,54,.9))" }} />
          <span style={{ position: "absolute", top: 18, left: 18, display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(6,21,31,.66)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 30 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cyan)" }} /> Escrow-protected
          </span>
        </div>
        <div style={{ padding: "32px 34px", color: "var(--ond)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--sand)" }}>
            {nextTrip ? "Your next adventure" : `Welcome, ${props.firstName}`}
          </div>
          <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 32, lineHeight: 1.08, margin: "10px 0 6px", color: "#fff" }}>{nextTitle}</h2>
          <div style={{ fontSize: 14, color: "var(--ondmut)", marginBottom: 18 }}>
            {nextPlace} · {nextDateStr}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            {[
              { label: "Days", val: cd.days },
              { label: "Hrs", val: cd.hrs },
              { label: "Min", val: cd.min },
            ].map((c) => (
              <div key={c.label} style={{ textAlign: "center", background: "rgba(255,255,255,.06)", border: "1px solid var(--lined)", borderRadius: 12, padding: "10px 0", minWidth: 62 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{c.val}</div>
                <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ondmut)", marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(45,226,242,.16)", display: "grid", placeItems: "center", fontFamily: "var(--serif)", color: "var(--sand)", fontWeight: 600 }}>
              {capName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>{capName}</div>
              <div style={{ fontSize: 12, color: "var(--sand)" }}>★ 4.98 · Verified</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {nextTrip ? (
              <Link
                to="/trips/detail"
                search={{ id: nextTrip.id }}
                style={{ display: "inline-block", background: "var(--sand)", color: "#04121B", textDecoration: "none", borderRadius: 11, padding: "13px 20px", fontSize: 13, fontWeight: 700, letterSpacing: ".04em" }}
              >
                View trip details
              </Link>
            ) : (
              <Link to="/marketplace" style={{ display: "inline-block", background: "var(--sand)", color: "#04121B", textDecoration: "none", borderRadius: 11, padding: "13px 20px", fontSize: 13, fontWeight: 700, letterSpacing: ".04em" }}>
                Explore charters
              </Link>
            )}
            <Link
              to="/messages"
              search={nextTrip ? { booking: nextTrip.id } : {}}
              style={{ background: "transparent", color: "#fff", border: "1px solid var(--lined)", borderRadius: 11, padding: "13px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              Message captain
            </Link>
          </div>

        </div>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 22 }}>
        <Stat value={String(upcomingCount)} label="Upcoming trips" />
        <Stat value={String(completedCount)} label="Trips completed" />
        <Stat value={"0"} label="Saved charters" />
        <Stat value={money(escrowCents)} label="Protected in escrow" gold />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginBottom: 22 }}>
        {/* UPCOMING TRIPS */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 21, color: "var(--ink)" }}>Your upcoming trips</div>
            <button onClick={props.onGoTrips} style={{ background: "transparent", border: 0, color: "var(--goldtext)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              All trips →
            </button>
          </div>
          {upcoming.length === 0 && (
            <div style={{ padding: "24px 0", fontSize: 13.5, color: "var(--tmut)" }}>
              No upcoming trips yet.{" "}
              <Link to="/marketplace" style={{ color: "var(--goldtext)", fontWeight: 600 }}>Find one →</Link>
            </div>
          )}
          {upcoming.map((b, i) => (
            <Link
              key={b.id}
              to="/trips/detail"
              search={{ id: b.id }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", textDecoration: "none", cursor: "pointer", borderBottom: i < upcoming.length - 1 ? "1px solid var(--line)" : "none" }}
            >
              <MediaImg src={b.service?.hero_url || b.business?.hero_url || DEFAULT_HERO} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flex: "none" }} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{b.service?.title ?? "Charter"}</div>
                <div style={{ fontSize: 12.5, color: "var(--tmut)" }}>
                  {[b.business?.city, b.business?.name].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cyan)", background: "#e2eef2", borderRadius: 20, padding: "3px 9px", flex: "none" }}>
                {b.status === "confirmed" || b.status === "in_progress" ? "In escrow" : b.status.replace("_", " ")}
              </span>
            </Link>
          ))}

        </div>

        {/* PROTECTION */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
            <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#e2eef2", display: "grid", placeItems: "center", color: "var(--cyan)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--cyan)" }}>Trip protection</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)" }}>You're covered</div>
            </div>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--tmut)", margin: "0 0 16px" }}>
            Your {money(escrowCents)} is held safely in escrow and only released to your captains after each trip is completed.
          </p>
          {upcoming.slice(0, 3).map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "9px 0", borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--tmut)" }}>{b.service?.title ?? "Charter"}</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{money(b.total_cents ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RECOMMENDED */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--goldtext)" }}>Picked for you</div>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 24, color: "var(--ink)", marginTop: 2 }}>Charters you might love</div>
        </div>
        <button onClick={props.onGoExplore} style={{ background: "transparent", border: 0, color: "var(--goldtext)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Explore all →
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
        {recos.slice(0, 3).map((c) => (
          <RecoCard key={c.id} c={c} />
        ))}
        {recos.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--tmut)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18 }}>
            No published charters yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div
      style={{
        background: gold ? "linear-gradient(160deg,#0c2a42,#072057)" : "var(--card)",
        border: gold ? "none" : "1px solid var(--line)",
        borderRadius: 16,
        padding: 18,
        color: gold ? "var(--ond)" : undefined,
      }}
    >
      <div style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, color: gold ? "#fff" : "var(--ink)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: gold ? "var(--sand)" : "var(--tmut)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function RecoCard({ c }: { c: Reco }) {
  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden" }}>
      <div style={{ position: "relative", height: 150 }}>
        <div style={{ width: "100%", height: "100%", backgroundImage: `url(${cachedMediaUrl(c.hero_url) || DEFAULT_HERO})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      </div>
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--tmut)", marginBottom: 6 }}>
          <span style={{ color: "var(--sand)" }}>★</span>
          <b style={{ color: "var(--ink)" }}>4.9</b> ·{" "}
          {[c.business?.city, c.business?.region].filter(Boolean).join(", ") || c.departure_location || "—"}
        </div>
        <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 19, lineHeight: 1.15, margin: "0 0 12px", color: "var(--ink)" }}>{c.title}</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--tmut)" }}>
            from <b style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--goldtext)" }}>{money(c.base_price_cents)}</b>
          </span>
          <Link
            to="/booking"
            search={{ service_id: c.id }}
            style={{ background: "var(--navy)", color: "#fff", borderRadius: 9, padding: "9px 15px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
          >
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------ OTHER TABS ------------------------------ */

function WalletTab({ escrowCents, upcoming }: { escrowCents: number; upcoming: UpcomingBooking[] }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 28 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600 }}>Wallet</div>
      <div style={{ fontSize: 13.5, color: "var(--tmut)", marginBottom: 20 }}>Balances and escrow across your trips.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 24 }}>
        <Stat value={money(escrowCents)} label="Held in escrow" gold />
        <Stat value={"$0"} label="Refunded (lifetime)" />
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Escrow breakdown</div>
      {upcoming.length === 0 ? (
        <div style={{ color: "var(--tmut)", fontSize: 13 }}>Nothing in escrow.</div>
      ) : upcoming.map((b) => (
        <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
          <span style={{ color: "var(--tmut)" }}>{b.service?.title ?? "Charter"} · {new Date(b.trip_date).toLocaleDateString()}</span>
          <span style={{ fontWeight: 600 }}>{money(b.total_cents ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function OrdersTab() {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 28, textAlign: "center", color: "var(--tmut)" }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>No gear orders yet</div>
      <div style={{ fontSize: 13.5, marginTop: 8 }}>Orders from tackle shops & gear brands will show up here.</div>
    </div>
  );
}
