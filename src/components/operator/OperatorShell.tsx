/**
 * Shared shell for operator dashboards (marina, tackle, gear, apparel, guide).
 * Provides sidebar + top bar + page frame in the Fish-X design system.
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Settings, UserRound, X } from "lucide-react";


async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}

export interface OperatorNavItem {
  key: string;
  label: string;
  badge?: number | string;
  icon: ReactNode;
}

export interface OperatorDockItem {
  key: string;
  label: string;
}

/**
 * "Preview" link — opens the public Fish-X page exactly as anglers see it.
 * Passing a serviceId deep-links to that single listing on the page.
 */
export function PreviewLink({
  slug,
  serviceId,
  label = "Preview",
  tone = "ghost",
}: {
  slug?: string | null;
  serviceId?: string | null;
  label?: string;
  tone?: "ghost" | "solid";
}) {
  if (!slug) return null;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "7px 13px",
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: "'Outfit', system-ui, sans-serif",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };
  const style =
    tone === "solid"
      ? { ...base, background: "#2DE2F2", color: "#04121B", border: "1px solid #2DE2F2" }
      : { ...base, background: "rgba(45,226,242,.10)", color: "#2DE2F2", border: "1px solid rgba(45,226,242,.35)" };
  return (
    <Link
      to="/b/$slug"
      params={{ slug }}
      search={serviceId ? { service: serviceId } : {}}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the public page in a new tab"
      style={style}
    >
      {label} ↗
    </Link>
  );
}

export function OperatorShell({
  workspaceName,
  workspaceKind,
  operatorName,
  operatorRole,
  nav,
  active,
  onNav,
  pageTitle,
  pageSub,
  headerRight,
  previewSlug,
  dock,
  children,
}: {
  workspaceName: string;
  workspaceKind: string;
  operatorName: string;
  operatorRole: string;
  nav: OperatorNavItem[];
  active: string;
  onNav: (key: string) => void;
  pageTitle: string;
  pageSub?: string;
  headerRight?: ReactNode;
  previewSlug?: string | null;
  dock?: OperatorDockItem[];
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const compactDock = (dock ?? nav.slice(0, 3).map(({ key, label }) => ({ key, label }))).slice(0, 3);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const tab = tabRefs.current[active];
    if (!tab) return;
    tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", close);
    };
  }, [drawerOpen]);

  const choose = (key: string) => {
    onNav(key);
    setDrawerOpen(false);
  };

  return (
    <div
      className="fx-shell"
      style={{
        ["--serif" as never]: "'Outfit', Georgia, serif",
        ["--sans" as never]: "'Outfit', system-ui, sans-serif",
        ["--ink" as never]: "var(--foreground)",
        ["--navy" as never]: "var(--deep-hull)",
        ["--paper" as never]: "var(--deep-hull)",
        ["--card" as never]: "var(--deep-hull-2)",
        ["--goldtext" as never]: "var(--crisp-cyan)",
        ["--cyan" as never]: "var(--crisp-cyan)",
        ["--green" as never]: "var(--sea-foam)",
        ["--greensoft" as never]: "color-mix(in oklab, var(--sea-foam) 14%, transparent)",
        ["--ond" as never]: "var(--on-deep)",
        ["--ondmut" as never]: "var(--on-deep-muted)",
        ["--tmut" as never]: "var(--muted-foreground)",
        ["--line" as never]: "var(--border)",
        ["--lined" as never]: "var(--border)",
        display: "flex",
        minHeight: "100vh",
        background: "#0D161F",
        color: "#F0F2F5",
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      {/* Desktop sidebar */}
      <aside
        className="fx-operator-side"
        style={{
          width: 256,
          flex: "none",
          background: "#0D161F",
          color: "#F0F2F5",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          borderRight: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px 22px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <BrandLogo size="md" accent="var(--cyan, #2DE2F2)" />
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.10)",
            borderRadius: 13,
            padding: "11px 12px",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "rgba(45,226,242,.14)",
              display: "grid",
              placeItems: "center",
              color: "#2DE2F2",
              flex: "none",
              fontWeight: 700,
            }}
          >
            {workspaceName.charAt(0)}
          </span>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "#92A0AB",
              }}
            >
              {workspaceKind}
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#F0F2F5",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {workspaceName}
            </div>
          </div>
        </div>

        <nav aria-label={`${workspaceKind} dashboard`} style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", minHeight: 0, paddingRight: 2 }}>
          {nav.map((n) => {
            const isActive = n.key === active;
            return (
              <Button
                variant="ghost"
                key={n.key}
                onClick={() => onNav(n.key)}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  background: isActive ? "rgba(45,226,242,.12)" : "transparent",
                  border: 0,
                  borderRadius: 11,
                  padding: "11px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  color: isActive ? "#F0F2F5" : "#92A0AB",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "inline-flex", color: isActive ? "#2DE2F2" : "inherit" }}>
                  {n.icon}
                </span>
                {n.label}
                {n.badge !== undefined && n.badge !== 0 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "#2DE2F2",
                      color: "#04121B",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 20,
                      padding: "1px 8px",
                    }}
                  >
                    {n.badge}
                  </span>
                )}
              </Button>
            );
          })}
        </nav>

        <Link
          to="/settings"
          className="fx-side-settings"
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "10px 12px",
            marginBottom: 8,
            borderRadius: 12,
            color: "#92A0AB",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7.5a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
          </svg>
          Settings
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.10)",
            borderRadius: 13,
            padding: "10px 12px",
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(45,226,242,.16)",
              display: "grid",
              placeItems: "center",
              fontFamily: "'Outfit', Georgia, serif",
              fontSize: 16,
              fontWeight: 600,
              color: "#2DE2F2",
              flex: "none",
            }}
          >
            {operatorName.charAt(0)}
          </span>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#F0F2F5",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {operatorName}
            </div>
            <div style={{ fontSize: 11, color: "#2DE2F2" }}>{operatorRole}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => signOut()}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: 0,
              color: "#92A0AB",
              cursor: "pointer",
              flex: "none",
              padding: 4,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
            </svg>
          </Button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="fx-operator-stage" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="fx-operator-compact" data-operator-header>
          <div className="fx-operator-identity">
            <Button
              variant="ghost"
              size="icon"
              className="fx-operator-menu"
              aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={drawerOpen}
              aria-controls="operator-navigation-drawer"
              onClick={() => setDrawerOpen((open) => !open)}
            >
              {drawerOpen ? <X /> : <Menu />}
            </Button>
            <Link className="fx-operator-brand" to="/dashboard" aria-label="Fish-X dashboard">
              <BrandLogo size="sm" accent="var(--cyan, #2DE2F2)" />
            </Link>
            <div className="fx-operator-workspace" title={workspaceName}>
              <span>{workspaceName.charAt(0).toUpperCase()}</span>
              <div>
                <small>{workspaceKind}</small>
                <strong>{workspaceName}</strong>
              </div>
            </div>
            <div className="fx-operator-compact-actions">
              <PreviewLink slug={previewSlug} />
              {headerRight}
              <NotificationBell />
            </div>
          </div>

          <div className="fx-operator-tabs-wrap">
            <nav className="fx-operator-tabs" aria-label="Dashboard sections">
              {nav.map((item) => {
                const isActive = item.key === active;
                return (
                  <Button
                    variant="ghost"
                    key={item.key}
                    ref={(node) => { tabRefs.current[item.key] = node; }}
                    className="fx-operator-tab"
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => choose(item.key)}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge !== 0 ? <b>{item.badge}</b> : null}
                  </Button>
                );
              })}
            </nav>
          </div>
        </header>

        {drawerOpen ? (
          <>
            <Button variant="ghost" className="fx-operator-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
            <aside id="operator-navigation-drawer" className="fx-operator-drawer" aria-label="Operator menu">
              <div className="fx-operator-drawer-head">
                <div className="fx-operator-drawer-avatar">{operatorName.charAt(0).toUpperCase()}</div>
                <div><strong>{operatorName}</strong><span>{operatorRole}</span></div>
                <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}><X /></Button>
              </div>
              <nav>
                {nav.map((item) => (
                  <Button key={item.key} variant="ghost" data-active={item.key === active ? "true" : "false"} onClick={() => choose(item.key)}>
                    <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
                    {item.badge !== undefined && item.badge !== 0 ? <b>{item.badge}</b> : null}
                  </Button>
                ))}
              </nav>
              <div className="fx-operator-drawer-account">
                <Link to="/account" onClick={() => setDrawerOpen(false)}><UserRound />Account</Link>
                <Button variant="ghost" onClick={() => choose("settings")}><Settings />Settings</Button>
                <Button variant="ghost" onClick={() => signOut()}><LogOut />Sign out</Button>
              </div>
            </aside>
          </>
        ) : null}

        <header
          className="fx-topbar fx-operator-titlebar"
          data-operator-header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(13,22,31,.86)",
            backdropFilter: "saturate(140%) blur(12px)",
            WebkitBackdropFilter: "saturate(140%) blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,.07)",
            padding: "18px 34px",
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Outfit', Georgia, serif",
                fontWeight: 600,
                fontSize: 26,
                lineHeight: 1.1,
                color: "#F0F2F5",
              }}
            >
              {pageTitle}
            </div>
            {pageSub && (
              <div style={{ fontSize: 13, color: "#92A0AB", marginTop: 1 }}>{pageSub}</div>
            )}
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <PreviewLink slug={previewSlug} label="Preview public page" />
            {headerRight}
            <NotificationBell />
          </div>

        </header>

        <main
          className="fx-main fx-operator-main"
          style={{
            flex: 1,
            padding: "30px 34px 48px",
            maxWidth: 1180,
            width: "100%",
          }}
        >
          {children}
          <div className="fx-operator-dock-clearance" aria-hidden="true" />
        </main>

        <nav className="fx-operator-dock" aria-label="Quick navigation">
          {compactDock.map((item) => {
            const source = nav.find((entry) => entry.key === item.key);
            const isActive = active === item.key;
            return (
              <Button key={item.key} variant="ghost" data-active={isActive ? "true" : "false"} aria-current={isActive ? "page" : undefined} onClick={() => choose(item.key)}>
                <span aria-hidden="true">{source?.icon}</span><small>{item.label}</small>
              </Button>
            );
          })}
          <Button variant="ghost" data-active={active === "settings" ? "true" : "false"} onClick={() => choose("settings")}>
            <UserRound aria-hidden="true" /><small>Account</small>
          </Button>
        </nav>
      </div>
    </div>
  );
}

/* ============ Shared building blocks ============ */

export function KPICard({
  label,
  value,
  trend,
  trendPositive = true,
}: {
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
}) {
  return (
    <div
      style={{
        background: "#14202B",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#92A0AB",
          }}
        >
          {label}
        </span>
        {trend && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: trendPositive ? "#22C55E" : "#F87171",
              background: trendPositive ? "rgba(34,197,94,.14)" : "rgba(216,81,74,.16)",
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            {trend}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "'Outfit', Georgia, serif",
          fontWeight: 600,
          fontSize: 34,
          lineHeight: 1,
          color: "#F0F2F5",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function Card({
  title,
  eyebrow,
  right,
  children,
}: {
  title?: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#14202B",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 20,
        padding: 24,
      }}
    >
      {(title || eyebrow || right) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 18,
            gap: 12,
          }}
        >
          <div>
            {eyebrow && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "#2DE2F2",
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <div
                style={{
                  fontFamily: "'Outfit', Georgia, serif",
                  fontWeight: 600,
                  fontSize: 22,
                  color: "#F0F2F5",
                  marginTop: eyebrow ? 3 : 0,
                }}
              >
                {title}
              </div>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusPill({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "green" | "gold" | "cyan" | "red" | "navy";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    muted: { bg: "#1C2936", fg: "#92A0AB" },
    green: { bg: "rgba(34,197,94,.14)", fg: "#22C55E" },
    gold: { bg: "rgba(45,226,242,.15)", fg: "#2DE2F2" },
    cyan: { bg: "rgba(45,226,242,.12)", fg: "#2DE2F2" },
    red: { bg: "rgba(216,81,74,.16)", fg: "#F87171" },
    navy: { bg: "#0D161F", fg: "#F0F2F5" },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 20,
        padding: "4px 11px",
        whiteSpace: "nowrap",
        color: t.fg,
        background: t.bg,
      }}
    >
      {label}
    </span>
  );
}

export function money(cents: number | null | undefined) {
  const v = ((cents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return v;
}
