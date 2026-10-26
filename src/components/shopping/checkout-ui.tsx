import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MediaImg } from "@/components/media/MediaImg";
import type { CartLine } from "@/hooks/use-cart";
import { usd } from "@/hooks/use-cart";

/** Light angler-side palette shared with the marketplace pages. */
export const C = {
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  navy: "#072057",
  paper: "#f6f9fb",
  card: "#ffffff",
  accent: "#1f9fbe",
  green: "#1f8a5b",
  red: "#b23a34",
  mut: "#5c6b78",
  line: "rgba(13,34,54,.10)",
};

export const card: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  padding: 18,
};

export const input: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: `1px solid ${C.line}`,
  fontFamily: C.sans,
  fontSize: 15,
  color: C.ink,
  background: "#fff",
  boxSizing: "border-box",
};

export const primaryBtn = (disabled?: boolean): CSSProperties => ({
  width: "100%",
  padding: "14px 18px",
  borderRadius: 12,
  border: "none",
  background: disabled ? "#9aa8b4" : C.navy,
  color: "#fff",
  fontFamily: C.sans,
  fontWeight: 600,
  fontSize: 16,
  cursor: disabled ? "not-allowed" : "pointer",
  textAlign: "center",
  textDecoration: "none",
  display: "block",
});

export function PageShell({ title, children, step }: { title: string; children: ReactNode; step: 1 | 2 | 3 }) {
  const steps = ["Cart", "Details", "Pay"];
  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: C.sans }}>
      <header style={{ background: C.navy, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link to="/marketplace" style={{ color: "#fff", textDecoration: "none", fontWeight: 700, letterSpacing: ".04em" }}>
          FISH-X.COM <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12 }}>Marketplace</span>
        </Link>
        <ol style={{ display: "flex", gap: 14, listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
          {steps.map((s, i) => (
            <li key={s} style={{ opacity: i + 1 <= step ? 1 : 0.5, fontWeight: i + 1 === step ? 700 : 400 }}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px 60px" }}>
        <h1 style={{ fontSize: 28, margin: "0 0 18px", fontWeight: 600 }}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function LineRow({ line, children }: { line: CartLine; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
      <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", background: "#eaf1f6", flex: "none" }}>
        {line.product.image && (
          <MediaImg src={line.product.image} alt={line.product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.product.title}</div>
        {line.variantLabel && <div style={{ fontSize: 13, color: C.mut }}>{line.variantLabel}</div>}
        <div style={{ fontSize: 13, color: C.mut }}>{usd(line.unitCents)} each</div>
        {children}
      </div>
      <div style={{ fontWeight: 600 }}>{usd(line.unitCents * line.qty)}</div>
    </div>
  );
}

export function SummaryRow({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontWeight: strong ? 700 : 400, fontSize: strong ? 18 : 15, color }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
