/**
 * BrandLogo — the single source of truth for the FISH-X.COM wordmark.
 *
 * Always renders: diamond + "FISH-X.COM" + small-caps "Bookings & Marketplace".
 * Never hand-roll the wordmark in a component; use this instead so every
 * surface of the app shows the identical logo.
 */
type Props = {
  /** Wordmark colour (defaults to inherit) */
  color?: string;
  /** Accent used for the diamond and the sub-line */
  accent?: string;
  /** Visual scale */
  size?: "sm" | "md" | "lg";
  /** Override the sub-line (e.g. "Account", "Admin") — defaults to the brand line */
  subtitle?: string;
  style?: React.CSSProperties;
};

const SIZES = {
  sm: { mark: 9, word: 17, sub: 8.5 },
  md: { mark: 11, word: 20, sub: 10 },
  lg: { mark: 12, word: 23, sub: 10.5 },
} as const;

export function BrandLogo({
  color = "inherit",
  accent = "var(--cyan, #2DE2F2)",
  size = "md",
  subtitle = "Bookings & Marketplace",
  style,
}: Props) {
  const s = SIZES[size];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color, ...style }}>
      <span
        style={{
          width: s.mark,
          height: s.mark,
          background: accent,
          transform: "rotate(45deg)",
          display: "inline-block",
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      <span style={{ display: "grid", lineHeight: 1.05 }}>
        <span
          style={{
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: s.word,
            letterSpacing: ".02em",
            whiteSpace: "nowrap",
          }}
        >
          FISH-X.COM
        </span>
        <span
          style={{
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: s.sub,
            fontWeight: 700,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: accent,
            marginTop: 3,
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </span>
      </span>
    </span>
  );
}

export default BrandLogo;
