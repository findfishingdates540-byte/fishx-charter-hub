/**
 * Public vertical directory: /explore/guides, /explore/marinas, …
 * Anglers browse every operator in one part of the industry, filter by
 * category and city, and open an operator to book directly.
 */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPublicBusinesses } from "@/lib/businesses.functions";
import { cachedMediaUrl } from "@/lib/media-url";
import { photoFor } from "@/lib/platform-photos";
import { verticalFor, VERTICALS } from "@/lib/explore-verticals";
import { PublicHeader } from "@/components/public/PublicHeader";

type Search = { category?: string; city?: string };

const serif = "'Outfit', Georgia, serif";

const directoryQO = () =>
  queryOptions({
    queryKey: ["public-businesses", "all"],
    queryFn: () => listPublicBusinesses({ data: {} }),
  });

const CATEGORY_LABELS: Record<string, string> = {
  charter: "Charter operators",
  guide_service: "Guide services",
  marina: "Marinas",
  tackle_shop: "Tackle shops",
  bait_shop: "Bait shops",
  lodge: "Lodges",
  gear_mfg: "Gear makers",
  apparel: "Apparel brands",
};

export const Route = createFileRoute("/explore/$vertical")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.category === "string" && s.category ? { category: s.category } : {}),
    ...(typeof s.city === "string" && s.city ? { city: s.city } : {}),
  }),
  beforeLoad: ({ params }) => {
    if (!verticalFor(params.vertical)) throw notFound();
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQO());
  },
  head: ({ params }) => {
    const v = verticalFor(params.vertical);
    const title = v ? `${v.title} on FISH-X.COM` : "Explore FISH-X.COM";
    const description =
      v?.blurb ?? "Browse verified fishing operators and book directly on Fish-X.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: VerticalPage,
  errorComponent: ({ error }) => <div className="p-10">Couldn't load this page: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">That part of Explore doesn't exist.</div>,
});

function VerticalPage() {
  const { vertical } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const v = verticalFor(vertical)!;
  const { data } = useSuspenseQuery(directoryQO());

  const inVertical = (data ?? []).filter((b) => v.categories.includes(b.category_key));
  const list = inVertical.filter(
    (b) =>
      (!search.category || b.category_key === search.category) &&
      (!search.city ||
        `${b.city ?? ""} ${b.region ?? ""}`.toLowerCase().includes(search.city.toLowerCase())),
  );

  const set = (patch: Search) =>
    navigate({
      to: "/explore/$vertical",
      params: { vertical },
      search: (prev) => {
        const next = { ...prev, ...patch } as Record<string, unknown>;
        for (const k of Object.keys(next)) if (!next[k]) delete next[k];
        return next as Search;
      },
    });

  return (
    <div style={{ background: "#fff", minHeight: "100vh", fontFamily: "'Outfit', system-ui, sans-serif", color: "#031029" }}>
      <PublicHeader />
      <style>{`
        .fx-vp-grid { display:grid; grid-template-columns: repeat(3,1fr); gap:20px; }
        @media (max-width:1080px){ .fx-vp-grid{ grid-template-columns: repeat(2,1fr);} }
        @media (max-width:680px){ .fx-vp-grid{ grid-template-columns: 1fr;} }
      `}</style>

      <section
        style={{
          padding: "clamp(32px,4vw,60px) 24px clamp(24px,3vw,40px)",
          background: `linear-gradient(180deg, rgba(7,26,42,.82), rgba(7,26,42,.94)), #071a2a url(${v.photo}) center/cover`,
          color: "#eaf1f6",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            to="/discover"
            style={{ color: "var(--sand,#2DE2F2)", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}
          >
            ← All of Fish-X
          </Link>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,46px)", fontWeight: 600, letterSpacing: "-.025em", margin: "12px 0 10px" }}>
            {v.title}
          </h1>
          <p style={{ color: "#b8c9d6", fontSize: 15.5, maxWidth: 620, margin: 0 }}>{v.blurb}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            {v.key === "charters" && (
              <Link to="/charters" style={cta}>
                Search charter trips →
              </Link>
            )}
            {v.marketplace && (
              <Link to="/marketplace" search={{}} style={cta}>
                Shop the marketplace →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(22px,3vw,34px) 24px 0", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => set({ category: undefined })} style={pill(!search.category)}>
          All ({inVertical.length})
        </button>
        {v.categories.map((c) => (
          <button key={c} type="button" onClick={() => set({ category: c })} style={pill(search.category === c)}>
            {CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
        <input
          defaultValue={search.city ?? ""}
          placeholder="City or region"
          onKeyDown={(e) => e.key === "Enter" && set({ city: (e.target as HTMLInputElement).value })}
          style={field}
          aria-label="Filter by city or region"
        />
      </section>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(22px,3vw,34px) 24px clamp(56px,8vw,96px)" }}>
        {list.length === 0 ? (
          <div style={{ padding: 44, textAlign: "center", color: "#5c6b78", border: "1px solid rgba(13,34,54,.10)", borderRadius: 16 }}>
            No {v.title.toLowerCase()} match these filters yet — try clearing the city filter.
          </div>
        ) : (
          <div className="fx-vp-grid">
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
                <div style={{ aspectRatio: "16/10", background: `#e9edf1 url(${cachedMediaUrl(b.hero_url) || photoFor(b.id)}) center/cover` }} />
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#5c6b78" }}>
                    {[b.city, b.region, b.country].filter(Boolean).join(", ") || "—"}
                    {b.verified_at ? " · Verified" : ""}
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{b.name}</div>
                  {b.tagline && <div style={{ fontSize: 13.5, color: "#5c6b78" }}>{b.tagline}</div>}
                  <span style={{ marginTop: "auto", paddingTop: 12, color: "#1F9FBE", fontWeight: 700, fontSize: 13.5 }}>
                    View & book →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <nav style={{ marginTop: 48, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {VERTICALS.filter((o) => o.key !== v.key).map((o) => (
            <Link key={o.key} to="/explore/$vertical" params={{ vertical: o.key }} style={pill(false)}>
              {o.title}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}

const cta: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 22px",
  borderRadius: 12,
  background: "var(--sand,#2DE2F2)",
  color: "#031029",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
};

const field: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(13,34,54,.14)",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 13,
  minWidth: 180,
};

const pill = (on: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 999,
  border: `1px solid ${on ? "#072057" : "rgba(13,34,54,.14)"}`,
  background: on ? "#072057" : "#fff",
  color: on ? "#fff" : "#031029",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
});
