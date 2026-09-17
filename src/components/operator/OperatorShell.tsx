/**
 * Shared shell for operator dashboards (marina, tackle, gear, apparel, guide).
 * Provides sidebar + top bar + page frame in the Fish-X design system.
 */
import { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";


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
  children: ReactNode;
}) {
  return (
    <div
      className="fx-shell"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0D161F",
        color: "#F0F2F5",
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      {/* SIDEBAR */}
      <aside
        className="fx-side"
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

        <nav style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", minHeight: 0, paddingRight: 2 }}>
          {nav.map((n) => {
            const isActive = n.key === active;
            return (
              <button
                key={n.key}
                onClick={() => onNav(n.key)}
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
              </button>
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
          <button
            title="Sign out"
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
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          className="fx-topbar"
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
            {headerRight}
            <NotificationBell />
          </div>

        </header>

        <main
          className="fx-main"
          style={{
            flex: 1,
            padding: "30px 34px 48px",
            maxWidth: 1180,
            width: "100%",
          }}
        >
          {children}
        </main>
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
