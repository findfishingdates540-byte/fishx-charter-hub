/**
 * Charter results page — filters (port, species, date, duration, guests) + sort.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { searchCharters } from "@/lib/charters.functions";
import { PublicHeader } from "@/components/public/PublicHeader";
import { CharterCard } from "./charters.index";

type Search = {
  city?: string;
  region?: string;
  species?: string;
  date?: string;
  guests?: number;
  duration?: "half" | "threequarter" | "full" | "any";
  sort?: "recommended" | "price_asc" | "price_desc" | "duration_asc" | "newest";
  q?: string;
};

export const charterSearchQO = (s: Search) =>
  queryOptions({
    queryKey: ["charter-search", s],
    queryFn: () => searchCharters({ data: s }),
  });

export const Route = createFileRoute("/charters/search")({
  head: () => ({
    meta: [
      { title: "Fishing charter results — FISH-X.COM" },
      {
        name: "description",
        content:
          "Filter fishing charters by port, target species, date, trip length and party size, then book an exclusive departure time block.",
      },
      { property: "og:title", content: "Fishing charter results — FISH-X.COM" },
      { property: "og:description", content: "Filter and sort verified fishing charters, then book instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.city === "string" && s.city ? { city: s.city } : {}),
    ...(typeof s.region === "string" && s.region ? { region: s.region } : {}),
    ...(typeof s.species === "string" && s.species ? { species: s.species } : {}),
    ...(typeof s.date === "string" && s.date ? { date: s.date } : {}),
    ...(typeof s.q === "string" && s.q ? { q: s.q } : {}),
    ...(s.guests != null && Number(s.guests) > 0 ? { guests: Number(s.guests) } : {}),
    ...(typeof s.duration === "string" && ["half", "threequarter", "full", "any"].includes(s.duration)
      ? { duration: s.duration as Search["duration"] }
      : {}),
    sort: (["recommended", "price_asc", "price_desc", "duration_asc", "newest"].includes(String(s.sort))
      ? (s.sort as Search["sort"])
      : "recommended"),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(charterSearchQO(deps)),
  component: CharterResults,
  errorComponent: ({ error }) => <div className="p-10">Couldn't load results: {error.message}</div>,
});

const serif = "'Outfit', Georgia, serif";

function CharterResults() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(charterSearchQO(search));

  const set = (patch: Partial<Search>) =>
    navigate({ to: "/charters/search", search: (prev) => {
      const next = { ...prev, ...patch } as Record<string, unknown>;
      for (const k of Object.keys(next)) if (next[k] === "" || next[k] == null) delete next[k];
      return next as Search;
    } });

  const place = search.city || search.region;

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "var(--sans, 'Outfit', system-ui)", color: "#031029" }}>
      <PublicHeader />

      <style>{`
        .fx-res { display: grid; grid-template-columns: 280px 1fr; gap: 28px; }
        .fx-res-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 1100px) { .fx-res-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 900px) {
          .fx-res { grid-template-columns: 1fr; }
          .fx-res-grid { grid-template-columns: 1fr; }
          .fx-res-side { position: static !important; }
        }
      `}</style>

      <header style={{ padding: "36px 24px 20px", maxWidth: 1280, margin: "0 auto" }}>
        <Link to="/charters" style={{ fontSize: 13, color: "#5c6b78", textDecoration: "none" }}>
          ← All charter destinations
        </Link>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(32px,4.4vw,52px)", fontWeight: 600, letterSpacing: "-.02em", margin: "10px 0 6px" }}>
          {place ? `Fishing charters in ${place}` : "All fishing charters"}
        </h1>
        <p style={{ color: "#5c6b78", fontSize: 15, margin: 0 }}>
          {data.count} {data.count === 1 ? "charter" : "charters"} match your filters
          {search.date ? ` on ${search.date}` : ""}.
        </p>
      </header>

      <div className="fx-res" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 80px" }}>
        <aside
          className="fx-res-side"
          style={{ position: "sticky", top: 96, alignSelf: "start", background: "#fff", border: "1px solid rgba(13,34,54,.08)", borderRadius: 16, padding: 20, display: "grid", gap: 18 }}
        >
          <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: "#8496a5", fontWeight: 700 }}>
            Filters
          </div>

          <Row label="Port / city">
            <input
              value={search.city ?? ""}
              onChange={(e) => set({ city: e.target.value })}
              placeholder="Any port"
              style={field}
            />
          </Row>

          <Row label="Target species">
            <select value={search.species ?? ""} onChange={(e) => set({ species: e.target.value })} style={field}>
              <option value="">Any species</option>
              {data.speciesFacets.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
          </Row>

          <Row label="Date">
            <input type="date" value={search.date ?? ""} onChange={(e) => set({ date: e.target.value })} style={field} />
          </Row>

          <Row label="Trip length">
            <select value={search.duration ?? "any"} onChange={(e) => set({ duration: e.target.value as Search["duration"] })} style={field}>
              <option value="any">Any length</option>
              <option value="half">Half day (up to 5h)</option>
              <option value="threequarter">3/4 day (5–7h)</option>
              <option value="full">Full day (7h+)</option>
            </select>
          </Row>

          <Row label="Guests">
            <select value={String(search.guests ?? "")} onChange={(e) => set({ guests: e.target.value ? Number(e.target.value) : undefined })} style={field}>
              <option value="">Any party size</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "angler" : "anglers"}
                </option>
              ))}
            </select>
          </Row>

          <Link
            to="/charters/search"
            search={{ sort: "recommended" as const }}
            style={{ fontSize: 13, color: "#1F9FBE", fontWeight: 700, textDecoration: "none" }}
          >
            Clear all filters
          </Link>
        </aside>

        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5c6b78" }}>
              Sort
              <select
                value={search.sort ?? "recommended"}
                onChange={(e) => set({ sort: e.target.value as Search["sort"] })}
                style={{ ...field, width: "auto", padding: "8px 12px" }}
              >
                <option value="recommended">Recommended</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="duration_asc">Shortest trip</option>
                <option value="newest">Newest listings</option>
              </select>
            </label>
          </div>

          {data.listings.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#5c6b78", background: "#fff", border: "1px solid rgba(13,34,54,.08)", borderRadius: 16 }}>
              No charters match these filters yet. Try widening the date or party size.
            </div>
          ) : (
            <div className="fx-res-grid">
              {data.listings.map((l) => (
                <CharterCard key={l.id} l={l as never} rating={data.ratings[l.business?.id ?? ""] ?? null} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const field: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(13,34,54,.14)",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#031029",
  background: "#fff",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5c6b78" }}>{label}</span>
      {children}
    </label>
  );
}
