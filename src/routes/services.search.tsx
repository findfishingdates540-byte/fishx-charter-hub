/**
 * Cross-vertical search: guided trips, marina slips, lodging, workshops, rentals.
 * Uses the ranked feed and logs impressions with position + query.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { cachedMediaUrl } from "@/lib/media-url";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { searchServices, SERVICE_KINDS } from "@/lib/services-search.functions";
import { logImpressions, logListing } from "@/lib/listing-telemetry";
import { PublicHeader } from "@/components/public/PublicHeader";

type Search = {
  kind?: string;
  city?: string;
  q?: string;
  sort?: "recommended" | "price_asc" | "price_desc" | "newest";
};

export const servicesSearchQO = (s: Search) =>
  queryOptions({
    queryKey: ["services-search", s],
    queryFn: () => searchServices({ data: s }),
  });

export const Route = createFileRoute("/services/search")({
  head: () => ({
    meta: [
      { title: "Guided trips, slips, lodging & workshops — FISH-X.COM" },
      {
        name: "description",
        content:
          "Search every bookable fishing experience on Fish-X: guided trips, marina slips, lodging, workshops and gear rentals, ranked by real performance.",
      },
      { property: "og:title", content: "Search fishing experiences — FISH-X.COM" },
      {
        property: "og:description",
        content: "Guided trips, marina slips, lodging, workshops and rentals from verified operators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.kind === "string" && s.kind ? { kind: s.kind } : {}),
    ...(typeof s.city === "string" && s.city ? { city: s.city } : {}),
    ...(typeof s.q === "string" && s.q ? { q: s.q } : {}),
    sort: (["recommended", "price_asc", "price_desc", "newest"].includes(String(s.sort))
      ? (s.sort as Search["sort"])
      : "recommended"),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(servicesSearchQO(deps)),
  component: ServiceResults,
  errorComponent: ({ error }) => <div className="p-10">Couldn't load results: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">Not found.</div>,
});

const serif = "'Outfit', Georgia, serif";
const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function ServiceResults() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(servicesSearchQO(search));

  useEffect(() => {
    logImpressions(
      data.map((r) => r.id),
      { kind: search.kind ?? "all", city: search.city ?? "", q: search.q ?? "" },
    );
  }, [data, search.kind, search.city, search.q]);

  const set = (patch: Partial<Search>) =>
    navigate({
      to: "/services/search",
      search: (prev) => {
        const next = { ...prev, ...patch } as Record<string, unknown>;
        for (const k of Object.keys(next)) if (next[k] === "" || next[k] == null) delete next[k];
        return next as Search;
      },
    });

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "'Outfit', system-ui, sans-serif", color: "#031029" }}>
      <PublicHeader />
      <style>{`
        .fx-svc-grid { display:grid; grid-template-columns: repeat(3,1fr); gap:20px; }
        @media (max-width:1100px){ .fx-svc-grid{ grid-template-columns: repeat(2,1fr);} }
        @media (max-width:760px){ .fx-svc-grid{ grid-template-columns: 1fr;} }
        .fx-svc-head { padding: 36px 48px 18px; }
        @media (max-width:760px){ .fx-svc-head{ padding: 24px 18px 12px;} .fx-svc-body{ padding: 18px !important;} }
      `}</style>

      <header className="fx-svc-head">
        <h1 style={{ fontFamily: serif, fontSize: "clamp(34px,4.4vw,54px)", margin: "0 0 6px", fontWeight: 600, letterSpacing: "-.02em" }}>
          Everything bookable on Fish-X.
        </h1>
        <p style={{ color: "#5c6b78", fontSize: 15, margin: 0 }}>
          {data.length} listing{data.length === 1 ? "" : "s"} · ranked by verified performance.
        </p>
      </header>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 48px 16px" }}>
        <button type="button" onClick={() => set({ kind: undefined })} style={pill(!search.kind)}>
          All
        </button>
        {SERVICE_KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => set({ kind: k.key })} style={pill(search.kind === k.key)}>
            {k.label}
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "0 48px 20px" }}>
        <input
          defaultValue={search.q ?? ""}
          placeholder="Search listings"
          onKeyDown={(e) => e.key === "Enter" && set({ q: (e.target as HTMLInputElement).value })}
          style={field}
        />
        <input
          defaultValue={search.city ?? ""}
          placeholder="City"
          onKeyDown={(e) => e.key === "Enter" && set({ city: (e.target as HTMLInputElement).value })}
          style={field}
        />
        <select value={search.sort ?? "recommended"} onChange={(e) => set({ sort: e.target.value as Search["sort"] })} style={field}>
          <option value="recommended">Recommended</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <section className="fx-svc-body" style={{ padding: "0 48px 56px" }}>
        {data.length === 0 ? (
          <div style={{ padding: 40, background: "#fff", borderRadius: 16, border: "1px solid rgba(13,34,54,.08)", color: "#5c6b78" }}>
            No listings match these filters yet.
          </div>
        ) : (
          <div className="fx-svc-grid">
            {data.map((r, i) => (
              <Link
                key={r.id}
                to="/b/$slug"
                params={{ slug: r.business?.slug ?? "" }}
                onClick={() => void logListing("click", r.id, { position: i + 1 })}
                style={{ textDecoration: "none", color: "inherit", background: "#fff", borderRadius: 16, border: "1px solid rgba(13,34,54,.08)", overflow: "hidden", display: "block" }}
              >
                <div style={{ height: 160, background: r.heroUrl ? `url(${cachedMediaUrl(r.heroUrl)}) center/cover` : "linear-gradient(135deg,#072057,#1f9fbe)" }} />
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#1F9FBE", fontWeight: 800 }}>
                    {SERVICE_KINDS.find((k) => k.key === r.kind)?.label ?? r.kind}
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, margin: "4px 0 2px" }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: "#5c6b78" }}>
                    {r.business?.name}
                    {r.business?.city ? ` · ${r.business.city}` : ""}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800 }}>{money(r.basePriceCents)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const field: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(13,34,54,.14)",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 14,
  minWidth: 160,
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
});
