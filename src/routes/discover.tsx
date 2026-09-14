import { createFileRoute, Link } from "@tanstack/react-router";
import { cachedMediaUrl } from "@/lib/media-url";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listPublicBusinesses, listCategories } from "@/lib/businesses.functions";
import { PublicHeader } from "@/components/public/PublicHeader";
import { searchServices } from "@/lib/services-search.functions";
import { logImpressions, logListing } from "@/lib/listing-telemetry";
import { useEffect } from "react";


export const businessesQO = (category?: string) =>
  queryOptions({
    queryKey: ["businesses", category ?? "all"],
    queryFn: () => listPublicBusinesses({ data: { category } }),
  });
export const rankedQO = queryOptions({
  queryKey: ["ranked-listings"],
  queryFn: () => searchServices({ data: { sort: "recommended" } }),
});
export const categoriesQO = queryOptions({
  queryKey: ["business-categories"],
  queryFn: () => listCategories(),
});

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover operators — Fish-X" },
      { name: "description", content: "Browse verified charter captains, tackle shops, marinas, guides, and gear brands across the Fish-X ecosystem." },
      { property: "og:title", content: "Discover fishing operators — Fish-X" },
      { property: "og:description", content: "Charters, tackle shops, marinas, guides, lodges, and gear brands." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { category?: string } =>
    typeof s.category === "string" ? { category: s.category } : {},
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(businessesQO(deps.category)),
      context.queryClient.ensureQueryData(categoriesQO),
      context.queryClient.ensureQueryData(rankedQO),
    ]);
  },
  component: DiscoverPage,
  errorComponent: ({ error }) => (
    <div className="p-10">Couldn't load directory: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10">Not found.</div>,
});

function DiscoverPage() {
  const { category } = Route.useSearch();
  const { data: businesses } = useSuspenseQuery(businessesQO(category));
  const { data: categories } = useSuspenseQuery(categoriesQO);
  const { data: ranked } = useSuspenseQuery(rankedQO);
  const top = ranked.slice(0, 6);

  useEffect(() => {
    logImpressions(top.map((r) => r.id), { surface: "discover" });
  }, [top]);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "'Outfit', system-ui, sans-serif", color: "#031029" }}>
      <PublicHeader />
      <header style={{ padding: "40px 48px 24px", borderBottom: "1px solid rgba(13,34,54,.08)" }}>
        <h1 style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: "clamp(40px,5vw,64px)", letterSpacing: "-.02em", margin: "0 0 8px", fontWeight: 600 }}>
          Discover operators.
        </h1>
        <p style={{ color: "#5c6b78", fontSize: 16, maxWidth: 560 }}>
          Every fishing-industry business inside Fish-X — charters, tackle shops, marinas, guides, lodges, apparel and gear brands.
        </p>
      </header>


      {top.length > 0 && (
        <section style={{ padding: "28px 48px 4px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <h2 style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 30, margin: 0, fontWeight: 600 }}>
              Top-ranked listings
            </h2>
            <Link to="/services/search" search={{ sort: "recommended" }} style={{ color: "#1F9FBE", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Search all experiences →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 16 }}>
            {top.map((r, i) => (
              <Link
                key={r.id}
                to="/b/$slug"
                params={{ slug: r.business?.slug ?? "" }}
                onClick={() => void logListing("click", r.id, { position: i + 1, query: { surface: "discover" } })}
                style={{ textDecoration: "none", color: "inherit", background: "#fff", borderRadius: 14, border: "1px solid rgba(13,34,54,.08)", overflow: "hidden" }}
              >
                <div style={{ height: 120, background: r.heroUrl ? `url(${cachedMediaUrl(r.heroUrl)}) center/cover` : "linear-gradient(135deg,#072057,#1f9fbe)" }} />
                <div style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: "#5c6b78" }}>{r.business?.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>
                    ${(r.basePriceCents / 100).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "20px 48px", borderBottom: "1px solid rgba(13,34,54,.06)" }}>
        <Link
          to="/discover"
          search={{}}
          style={pill(!category)}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.key}
            to="/discover"
            search={{ category: c.key }}
            style={pill(category === c.key)}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      <section style={{ padding: "32px 48px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {businesses.length === 0 && (
          <div style={{ color: "#5c6b78", padding: "60px 0", textAlign: "center", gridColumn: "1 / -1" }}>
            No operators listed yet in this category.
          </div>
        )}
        {businesses.map((b) => (
          <Link
            key={b.id}
            to="/b/$slug"
            params={{ slug: b.slug }}
            style={{
              background: "#fff",
              border: "1px solid rgba(13,34,54,.08)",
              borderRadius: 16,
              overflow: "hidden",
              textDecoration: "none",
              color: "#031029",
              display: "flex",
              flexDirection: "column",
              transition: "transform .2s, box-shadow .2s",
            }}
          >
            <div style={{ aspectRatio: "4/3", background: b.hero_url ? `#e9edf1 url(${cachedMediaUrl(b.hero_url)}) center/cover` : "linear-gradient(135deg,#072057,#031029)" }} />
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#1F9FBE", fontWeight: 700 }}>
                {b.category_key.replace(/_/g, " ")}
                {b.verified_at && <span style={{ marginLeft: 8, color: "#031029" }}>· Verified</span>}
              </div>
              <div style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 24, fontWeight: 600, marginTop: 6 }}>{b.name}</div>
              {b.tagline && <div style={{ color: "#5c6b78", fontSize: 14, marginTop: 4 }}>{b.tagline}</div>}
              {(b.city || b.country) && (
                <div style={{ color: "#5c6b78", fontSize: 13, marginTop: 10 }}>
                  {[b.city, b.region, b.country].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 999,
    background: active ? "#031029" : "#fff",
    color: active ? "#fff" : "#031029",
    border: "1px solid rgba(13,34,54,.10)",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  };
}
