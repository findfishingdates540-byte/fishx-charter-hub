/**
 * CaptainPageShell — full-page dark shell used by the standalone captain
 * editor pages (charter editor, package editor).
 */
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";

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
  ["--tmut" as never]: "#92A0AB",
  ["--line" as never]: "rgba(255,255,255,.08)",
  ["--lined" as never]: "rgba(255,255,255,.10)",
  minHeight: "100vh",
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
};

export function CaptainPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={shell}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(13,22,31,.9)",
          backdropFilter: "saturate(140%) blur(12px)",
          borderBottom: "1px solid var(--line)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <BrandLogo size="sm" accent="var(--cyan)" color="var(--ink)" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 20, lineHeight: 1.15 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12.5, color: "var(--tmut)", marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <Link
          to="/dashboard"
          style={{
            marginLeft: "auto",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--cyan)",
            textDecoration: "none",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "8px 14px",
          }}
        >
          ← Back to dashboard
        </Link>
      </header>
      <main style={{ padding: "24px 20px 60px", maxWidth: 980, width: "100%", margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
