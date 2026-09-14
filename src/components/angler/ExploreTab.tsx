/**
 * Angler → Explore tab. Mirrors the public charter discovery page (search hero,
 * ports, regions, featured charters) but lives entirely inside the signed-in
 * dashboard: results render in-tab and every card books through /booking.
 */
import { Link } from "@tanstack/react-router";
import { cachedMediaUrl } from "@/lib/media-url";
import { useState } from "react";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { getCharterDirectory, searchCharters } from "@/lib/charters.functions";
import { logListingEvent } from "@/lib/ranking.functions";
import { DEFAULT_HERO } from "@/lib/platform-photos";

export const anglerExploreQO = queryOptions({
  queryKey: ["charter-directory"],
  queryFn: () => getCharterDirectory(),
});

type Filters = {
  city?: string;
  region?: string;
  species?: string;
  date?: string;
  guests?: number;
  duration?: "half" | "threequarter" | "full" | "any";
  sort: "recommended" | "price_asc" | "price_desc" | "duration_asc" | "newest";
};

type Listing = Awaited<ReturnType<typeof getCharterDirectory>>["featured"][number];

const money = (c: number | null) => (c == null ? "—" : `$${Math.round(c / 100).toLocaleString()}`);
const serif = "'Outfit', Georgia, serif";

const trackClick = (serviceId: string) => {
  void logListingEvent({ data: { serviceId, kind: "click" } }).catch(() => {});
};

export function ExploreTab() {
  const { data } = useSuspenseQuery(anglerExploreQO);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [where, setWhere] = useState("");
  const [date, setDate] = useState("");
  const [species, setSpecies] = useState("");
  const [guests, setGuests] = useState("2");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      ...(where ? { city: where } : {}),
      ...(date ? { date } : {}),
      ...(species ? { species } : {}),
      guests: Number(guests) || 1,
      sort: "recommended",
    });
  };

  return (
    <div style={{ background: "#ffffff", minHeight: "calc(100vh - 66px)", fontFamily: "var(--sans, 'Outfit', system-ui)", color: "#031029" }}>
      <style>{`
        .fx-ch-search { display: grid; grid-template-columns: 1.3fr 1fr 1.1fr .8fr auto; gap: 0; }
        .fx-ch-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .fx-ch-feat { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 900px) {
          .fx-ch-search { grid-template-columns: 1fr; }
          .fx-ch-grid, .fx-ch-feat { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Hero + search */}
      <section
        style={{
          position: "relative",
          padding: "clamp(48px,6vw,92px) 24px clamp(40px,5vw,72px)",
          background: `linear-gradient(180deg, rgba(7,26,42,.86), rgba(7,26,42,.94)), #071a2a url(${DEFAULT_HERO}) center/cover`,
          color: "#eaf1f6",
          textAlign: "left",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <span style={{ fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--sand,#2DE2F2)", fontWeight: 700 }}>
            Explore
          </span>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(34px,5vw,60px)", fontWeight: 600, letterSpacing: "-.02em", margin: "10px 0 12px", lineHeight: 1.05 }}>
            Book your next fishing charter.
          </h1>
          <p style={{ color: "#b8c9d6", fontSize: 16, maxWidth: 620, margin: "0 0 30px" }}>
            Search verified captains by port, date and target species. Every departure is an exclusive
            time block — never double-booked.
          </p>

          <form onSubmit={submit} className="fx-ch-search" style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 70px -34px rgba(0,0,0,.85)", textAlign: "left" }}>
            <Field label="Where">
              <input list="fx-ports" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="All ports" style={inputStyle} />
              <datalist id="fx-ports">
                {data.ports.map((p) => (
                  <option key={`${p.city}-${p.region}`} value={p.city} />
                ))}
              </datalist>
            </Field>
            <Field label="When">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Target species">
              <input list="fx-species" value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Any species" style={inputStyle} />
              <datalist id="fx-species">
                {data.species.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Guests">
              <select value={guests} onChange={(e) => setGuests(e.target.value)} style={inputStyle}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "angler" : "anglers"}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ padding: 10, display: "flex", alignItems: "center" }}>
              <button type="submit" style={{ width: "100%", height: 52, padding: "0 28px", borderRadius: 12, border: "none", background: "#031029", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Search charters
              </button>
            </div>
          </form>
        </div>
      </section>

      {filters ? (
        <SearchResults filters={filters} onChange={setFilters} onClear={() => setFilters(null)} />
      ) : (
        <>
          {/* Popular ports */}
          <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(36px,5vw,64px) 24px 0" }}>
            <SectionHead title="Popular right now" note={data.total ? `${data.total} charter listings live` : undefined} />
            {data.ports.length === 0 ? (
              <Empty>No charter ports listed yet.</Empty>
            ) : (
              <div className="fx-ch-grid">
                {data.ports.map((p) => (
                  <button
                    key={`${p.city}-${p.region}`}
                    type="button"
                    onClick={() => setFilters({ city: p.city, sort: "recommended" })}
                    style={{
                      position: "relative",
                      display: "block",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      borderRadius: 18,
                      overflow: "hidden",
                      minHeight: 220,
                      textAlign: "left",
                      color: "#fff",
                      background: `linear-gradient(180deg, rgba(7,26,42,.15) 30%, rgba(7,26,42,.9)), #072057 url(${DEFAULT_HERO}) center/cover`,
                    }}
                  >
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 20 }}>
                      <div style={{ fontFamily: serif, fontSize: 27, fontWeight: 600 }}>{p.city}</div>
                      <div style={{ fontSize: 13, color: "#cbd9e4" }}>
                        {p.region ? `${p.region} · ` : ""}
                        {p.captains} {p.captains === 1 ? "captain" : "captains"} · from{" "}
                        <b style={{ color: "var(--sand,#2DE2F2)" }}>{money(p.fromCents)}</b>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Regions */}
          {data.regions.length > 0 && (
            <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(32px,4vw,56px) 24px 0" }}>
              <SectionHead title="Browse by state or region" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {data.regions.map((r) => (
                  <button
                    key={r.region}
                    type="button"
                    onClick={() => setFilters({ region: r.region, sort: "recommended" })}
                    style={{ padding: "10px 18px", borderRadius: 999, background: "#fff", border: "1px solid rgba(13,34,54,.10)", color: "#031029", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    {r.region} <span style={{ color: "#5c6b78", fontWeight: 500 }}>· {r.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Featured */}
          {data.featured.length > 0 && (
            <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(32px,4vw,56px) 24px clamp(56px,8vw,96px)" }}>
              <SectionHead
                title="Charters to book now"
                action={
                  <button
                    type="button"
                    onClick={() => setFilters({ sort: "recommended" })}
                    style={{ background: "none", border: "none", color: "#1F9FBE", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
                  >
                    See all charters →
                  </button>
                }
              />
              <div className="fx-ch-feat">
                {data.featured.map((l) => (
                  <CharterCard key={l.id} l={l} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SearchResults({
  filters,
  onChange,
  onClear,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["angler-charter-search", filters],
    queryFn: () => searchCharters({ data: filters }),
  });

  const label =
    filters.city || filters.region || (filters.species ? `${filters.species} charters` : "All charters");

  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(28px,4vw,52px) 24px clamp(56px,8vw,96px)" }}>
      <SectionHead
        title={label}
        note={data ? `${data.count} ${data.count === 1 ? "charter" : "charters"}` : undefined}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <select
              value={filters.sort}
              onChange={(e) => onChange({ ...filters, sort: e.target.value as Filters["sort"] })}
              style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(13,34,54,.14)", background: "#fff", fontSize: 13.5, color: "#031029" }}
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="duration_asc">Shortest trip</option>
              <option value="newest">Newest</option>
            </select>
            <button type="button" onClick={onClear} style={{ background: "none", border: "none", color: "#1F9FBE", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              ← Back to explore
            </button>
          </div>
        }
      />

      {data && data.speciesFacets.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {data.speciesFacets.slice(0, 10).map((s) => {
            const active = filters.species === s.name;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => onChange({ ...filters, species: active ? undefined : s.name })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "#031029" : "rgba(13,34,54,.12)"}`,
                  background: active ? "#031029" : "#fff",
                  color: active ? "#fff" : "#5c6b78",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {s.name} · {s.count}
              </button>
            );
          })}
        </div>
      )}

      {isPending ? (
        <Empty>Finding charters…</Empty>
      ) : !data || data.listings.length === 0 ? (
        <Empty>No charters match these filters yet. Try another port or date.</Empty>
      ) : (
        <div className="fx-ch-feat">
          {data.listings.map((l) => (
            <CharterCard key={l.id} l={l} rating={data.ratings[l.business?.id ?? ""] ?? null} />
          ))}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  fontSize: 15,
  fontFamily: "inherit",
  color: "#031029",
  background: "transparent",
  padding: 0,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", padding: "14px 18px", borderRight: "1px solid rgba(13,34,54,.08)" }}>
      <span style={{ display: "block", fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#8496a5", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionHead({ title, note, action }: { title: string; note?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderBottom: "1px solid rgba(13,34,54,.10)", paddingBottom: 14, marginBottom: 22 }}>
      <h2 style={{ fontFamily: serif, fontSize: "clamp(24px,3vw,34px)", fontWeight: 600, margin: 0 }}>{title}</h2>
      {note && <span style={{ fontSize: 13, color: "#5c6b78" }}>{note}</span>}
      {action}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "#5c6b78", border: "1px solid rgba(13,34,54,.10)", borderRadius: 16, background: "#fff" }}>
      {children}
    </div>
  );
}

function CharterCard({ l, rating }: { l: Listing; rating?: { avg: number; count: number } | null }) {
  const hours = l.duration_minutes ? Math.round((l.duration_minutes / 60) * 10) / 10 : null;
  return (
    <Link
      to="/booking"
      search={{ service_id: l.id }}
      onClick={() => trackClick(l.id)}
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
      <div style={{ aspectRatio: "16/10", background: `#e9edf1 url(${cachedMediaUrl(l.hero_url) || DEFAULT_HERO}) center/cover` }} />
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ fontSize: 12, color: "#5c6b78" }}>
          {[l.business?.city, l.business?.region].filter(Boolean).join(", ") || l.departure_location || "—"}
          {l.business?.verified_at ? " · Verified" : ""}
          {rating ? ` · ★ ${rating.avg} (${rating.count})` : ""}
        </div>
        <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{l.title}</div>
        <div style={{ fontSize: 13, color: "#5c6b78" }}>
          {l.business?.name}
          {hours ? ` · ${hours}h` : ""}
          {l.capacity ? ` · up to ${l.capacity} anglers` : ""}
        </div>
        {(l.target_species ?? []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            {(l.target_species ?? []).slice(0, 3).map((s) => (
              <span key={s} style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 999, background: "#f2f5f7", color: "#5c6b78" }}>
                {s}
              </span>
            ))}
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: 12, fontSize: 13, color: "#5c6b78" }}>
          from <b style={{ fontFamily: serif, fontSize: 21, color: "#1F9FBE" }}>{money(l.base_price_cents)}</b>{" "}
          <span style={{ fontSize: 12 }}>/ trip</span>
        </div>
      </div>
    </Link>
  );
}
