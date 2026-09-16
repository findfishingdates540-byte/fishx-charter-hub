/**
 * Angler → Explore. Landing hub where anglers first pick a vertical
 * (charters, guides, marinas, tackle & bait, lodges, gear & apparel) before
 * diving into that marketplace. Charters open the existing charter explorer;
 * the other verticals open an in-tab operator directory.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPublicBusinesses } from "@/lib/businesses.functions";
import { cachedMediaUrl } from "@/lib/media-url";
import { PLATFORM_PHOTOS, photoFor, DEFAULT_HERO } from "@/lib/platform-photos";
import { ExploreTab } from "./ExploreTab";

const serif = "'Outfit', Georgia, serif";

type Vertical = {
  key: string;
  title: string;
  blurb: string;
  action: string;
  photo: string;
  categories?: string[];
  kind: "charters" | "directory" | "marketplace";
};

const VERTICALS: Vertical[] = [
  {
    key: "charters",
    title: "Charter captains",
    blurb:
      "Book an exclusive time block with a verified captain — offshore, inshore or nearshore, boat and crew included.",
    action: "Browse charters",
    photo: PLATFORM_PHOTOS.marinaSunset,
    kind: "charters",
  },
  {
    key: "guides",
    title: "Fishing guides",
    blurb:
      "Wade, kayak and river guides who bring the local knowledge, the gear and the spots that actually produce.",
    action: "Find a guide",
    photo: PLATFORM_PHOTOS.openWater,
    categories: ["guide_service"],
    kind: "directory",
  },
  {
    key: "marinas",
    title: "Marinas & slips",
    blurb:
      "Reserve a slip or mooring by the night or the season, with fuel, power and dock services on site.",
    action: "Browse marinas",
    photo: PLATFORM_PHOTOS.harbourFleet,
    categories: ["marina"],
    kind: "directory",
  },
  {
    key: "tackle",
    title: "Tackle & bait shops",
    blurb:
      "Local shops stocking rods, reels, terminal tackle and fresh bait — order ahead or shop their full catalog.",
    action: "Shop local",
    photo: PLATFORM_PHOTOS.dockLines,
    categories: ["tackle_shop", "bait_shop"],
    kind: "directory",
  },
  {
    key: "lodges",
    title: "Lodges & stays",
    blurb:
      "Fishing lodges and waterside stays built around early starts — rooms, meals and dock access in one booking.",
    action: "Browse lodges",
    photo: PLATFORM_PHOTOS.quietBasin,
    categories: ["lodge"],
    kind: "directory",
  },
  {
    key: "gear",
    title: "Gear & apparel",
    blurb:
      "Rods, reels, electronics and apparel from verified brands, with escrow-protected checkout and tracked delivery.",
    action: "Open marketplace",
    photo: PLATFORM_PHOTOS.duskFleet,
    categories: ["gear_mfg", "apparel"],
    kind: "marketplace",
  },
];

export function ExploreHub() {
  const [open, setOpen] = useState<Vertical | null>(null);

  if (open?.kind === "charters") return <ExploreTab onBack={() => setOpen(null)} />;
  if (open) return <VerticalDirectory v={open} onBack={() => setOpen(null)} />;

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
            <button
              key={v.key}
              type="button"
              onClick={() => setOpen(v)}
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                padding: 0,
                cursor: "pointer",
                background: "#fff",
                border: "1px solid rgba(13,34,54,.10)",
                borderRadius: 18,
                overflow: "hidden",
                color: "#031029",
                font: "inherit",
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
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function VerticalDirectory({ v, onBack }: { v: Vertical; onBack: () => void }) {
  const { data, isPending } = useQuery({
    queryKey: ["explore-vertical", v.key],
    queryFn: () => listPublicBusinesses({ data: {} }),
  });

  const list = (data ?? []).filter((b) => (v.categories ?? []).includes(b.category_key));

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
        .fx-dir-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 1080px) { .fx-dir-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 680px) { .fx-dir-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section
        style={{
          padding: "clamp(32px,4vw,60px) 24px clamp(24px,3vw,40px)",
          background: `linear-gradient(180deg, rgba(7,26,42,.82), rgba(7,26,42,.94)), #071a2a url(${v.photo}) center/cover`,
          color: "#eaf1f6",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "var(--sand,#2DE2F2)",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              padding: 0,
              marginBottom: 14,
              font: "inherit",
            }}
          >
            ← Back to explore
          </button>
          <h1
            style={{
              fontFamily: serif,
              fontSize: "clamp(28px,4vw,46px)",
              fontWeight: 600,
              letterSpacing: "-.025em",
              margin: "0 0 10px",
            }}
          >
            {v.title}
          </h1>
          <p style={{ color: "#b8c9d6", fontSize: 15.5, maxWidth: 620, margin: 0 }}>{v.blurb}</p>
          {v.kind === "marketplace" && (
            <Link
              to="/marketplace"
              search={{}}
              style={{
                display: "inline-block",
                marginTop: 18,
                padding: "12px 22px",
                borderRadius: 12,
                background: "var(--sand,#2DE2F2)",
                color: "#031029",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Shop the marketplace →
            </Link>
          )}
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(28px,4vw,48px) 24px clamp(56px,8vw,96px)" }}>
        {isPending ? (
          <Empty>Loading {v.title.toLowerCase()}…</Empty>
        ) : list.length === 0 ? (
          <Empty>No {v.title.toLowerCase()} listed yet — check back soon.</Empty>
        ) : (
          <div className="fx-dir-grid">
            {list.map((b) => (
              <Link
                key={b.id}
                to="/b/$slug"
                params={{ slug: b.slug }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "#fff",
                  border: "1px solid rgba(13,34,54,.08)",
                  borderRadius: 16,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "#031029",
                }}
              >
                <div
                  style={{
                    aspectRatio: "16/10",
                    background: `#e9edf1 url(${cachedMediaUrl(b.hero_url) || photoFor(b.id)}) center/cover`,
                  }}
                />
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#5c6b78" }}>
                    {[b.city, b.region, b.country].filter(Boolean).join(", ") || "—"}
                    {b.verified_at ? " · Verified" : ""}
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{b.name}</div>
                  {b.tagline && <div style={{ fontSize: 13.5, color: "#5c6b78" }}>{b.tagline}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 48,
        textAlign: "center",
        color: "#5c6b78",
        border: "1px solid rgba(13,34,54,.10)",
        borderRadius: 16,
        background: "#fff",
      }}
    >
      {children}
    </div>
  );
}
