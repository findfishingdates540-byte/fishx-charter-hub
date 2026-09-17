/**
 * Angler → Explore. Landing hub where anglers pick a vertical (charters,
 * guides, marinas, tackle & bait, lodges, gear & apparel). Each card links to
 * that vertical's own directory page, where anglers filter operators and book.
 */
import { Link } from "@tanstack/react-router";
import { VERTICALS } from "@/lib/explore-verticals";
import { DEFAULT_HERO } from "@/lib/platform-photos";

const serif = "'Outfit', Georgia, serif";

export function ExploreHub() {
  return (
    <div
      style={{
        background: "#fff",
        minHeight: "calc(100vh - 66px)",
        fontFamily: "var(--sans, 'Outfit', system-ui)",
        color: "#031029",
      }}
    >
      <style>{`
        .fx-vert-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 1080px) { .fx-vert-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 680px) { .fx-vert-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section
        style={{
          padding: "clamp(40px,5vw,72px) 24px clamp(28px,4vw,44px)",
          background: `linear-gradient(180deg, rgba(7,26,42,.86), rgba(7,26,42,.94)), #071a2a url(${DEFAULT_HERO}) center/cover`,
          color: "#eaf1f6",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <span
            style={{
              fontSize: 11,
              letterSpacing: ".24em",
              textTransform: "uppercase",
              color: "var(--sand,#2DE2F2)",
              fontWeight: 700,
            }}
          >
            Explore
          </span>
          <h1
            style={{
              fontFamily: serif,
              fontSize: "clamp(30px,4.6vw,54px)",
              fontWeight: 600,
              letterSpacing: "-.025em",
              margin: "10px 0 12px",
              lineHeight: 1.06,
            }}
          >
            What are you looking for today?
          </h1>
          <p style={{ color: "#b8c9d6", fontSize: 16, maxWidth: 640, margin: 0 }}>
            Pick a part of the fishing industry to explore — every operator inside Fish-X, from captains
            and guides to marinas, shops and gear brands.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(28px,4vw,48px) 24px clamp(56px,8vw,96px)" }}>
        <div className="fx-vert-grid">
          {VERTICALS.map((v) => (
            <Link
              key={v.key}
              to="/explore/$vertical"
              params={{ vertical: v.key }}
              search={{}}
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                padding: 0,
                background: "#fff",
                border: "1px solid rgba(13,34,54,.10)",
                borderRadius: 18,
                overflow: "hidden",
                color: "#031029",
                textDecoration: "none",
              }}
            >
              <div style={{ aspectRatio: "16/9", background: `#e9edf1 url(${v.photo}) center/cover` }} />
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>
                  {v.title}
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#5c6b78" }}>{v.blurb}</p>
                <span style={{ marginTop: "auto", paddingTop: 14, color: "#1F9FBE", fontWeight: 700, fontSize: 13.5 }}>
                  {v.action} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
