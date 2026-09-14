/**
 * Charter discovery landing — search hero (ports, date, species, guests),
 * destinations by state/port, and a featured charter rail.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCharterDirectory } from "@/lib/charters.functions";
import { PublicHeader } from "@/components/public/PublicHeader";
import { DEFAULT_HERO } from "@/lib/platform-photos";

export const charterDirectoryQO = queryOptions({
  queryKey: ["charter-directory"],
  queryFn: () => getCharterDirectory(),
});

export const Route = createFileRoute("/charters/")({
  head: () => ({
    meta: [
      { title: "Book fishing charters — FISH-X.COM" },
      {
        name: "description",
        content:
          "Search fishing charters by port, date, target species and party size. Verified captains, escrow-protected deposits, no double-booked departures.",
      },
      { property: "og:title", content: "Book fishing charters — FISH-X.COM" },
      {
        property: "og:description",
        content: "Find and book charters by port, date and target species across the FISH-X marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(charterDirectoryQO);
  },
  component: ChartersLanding,
  errorComponent: ({ error }) => <div className="p-10">Couldn't load charters: {error.message}</div>,
});

const money = (c: number | null) =>
  c == null ? "—" : `$${Math.round(c / 100).toLocaleString()}`;

const serif = "'Outfit', Georgia, serif";

function ChartersLanding() {
  const { data } = useSuspenseQuery(charterDirectoryQO);
  const navigate = useNavigate();
  const [where, setWhere] = useState("");
  const [date, setDate] = useState("");
  const [species, setSpecies] = useState("");
  const [guests, setGuests] = useState("2");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/charters/search",
      search: {
        ...(where ? { city: where } : {}),
        ...(date ? { date } : {}),
        ...(species ? { species } : {}),
        guests: Number(guests) || 1,
        sort: "recommended" as const,
      },
    });
  };

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "var(--sans, 'Outfit', system-ui)", color: "#031029" }}>
      <PublicHeader />

      <style>{`
        .fx-ch-search { display: grid; grid-template-columns: 1.3fr 1fr 1.1fr .8fr auto; gap: 0; }
        .fx-ch-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .fx-ch-feat { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 900px) {
          .fx-ch-search { grid-template-columns: 1fr; }
          .fx-ch-grid, .fx-ch-feat { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Hero */}
      <section
        style={{
          position: "relative",
          padding: "clamp(56px,8vw,110px) 24px clamp(48px,6vw,86px)",
          background: `linear-gradient(180deg, rgba(7,26,42,.86), rgba(7,26,42,.94)), #071a2a url(${DEFAULT_HERO}) center/cover`,
          color: "#eaf1f6",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <span style={{ fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--sand,#2DE2F2)", fontWeight: 700 }}>
            Charters
          </span>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(38px,6vw,68px)", fontWeight: 600, letterSpacing: "-.02em", margin: "10px 0 12px", lineHeight: 1.05 }}>
            Book your next fishing charter.
          </h1>
          <p style={{ color: "#b8c9d6", fontSize: 16, maxWidth: 620, margin: "0 auto 30px" }}>
            Search verified captains by port, date and target species. Every departure is an exclusive
            time block — never double-booked.
          </p>

          <form
            onSubmit={submit}
            className="fx-ch-search"
            style={{
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 30px 70px -34px rgba(0,0,0,.85)",
              textAlign: "left",
            }}
          >
            <Field label="Where">
              <input
                list="fx-ports"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="All ports"
                style={inputStyle}
              />
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
              <input
                list="fx-species"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="Any species"
                style={inputStyle}
              />
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
              <button
                type="submit"
                style={{
                  width: "100%",
                  height: 52,
                  padding: "0 28px",
                  borderRadius: 12,
                  border: "none",
                  background: "#031029",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Search charters
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Popular ports */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,72px) 24px 0" }}>
        <SectionHead
          title="Popular right now"
          note={data.total ? `${data.total} charter listings live` : undefined}
        />
        {data.ports.length === 0 ? (
          <Empty>No charter ports listed yet.</Empty>
        ) : (
          <div className="fx-ch-grid">
            {data.ports.map((p) => (
              <Link
                key={`${p.city}-${p.region}`}
                to="/charters/search"
                search={{ city: p.city, sort: "recommended" as const }}
                style={{
                  position: "relative",
                  display: "block",
                  borderRadius: 18,
                  overflow: "hidden",
                  minHeight: 220,
                  textDecoration: "none",
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
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Regions */}
      {data.regions.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(36px,5vw,60px) 24px 0" }}>
          <SectionHead title="Browse by state or region" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {data.regions.map((r) => (
              <Link
                key={r.region}
                to="/charters/search"
                search={{ region: r.region, sort: "recommended" as const }}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(13,34,54,.10)",
                  color: "#031029",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {r.region} <span style={{ color: "#5c6b78", fontWeight: 500 }}>· {r.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured charters */}
      {data.featured.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(36px,5vw,60px) 24px clamp(56px,8vw,96px)" }}>
          <SectionHead
            title="Charters to book now"
            action={
              <Link to="/charters/search" search={{ sort: "recommended" as const }} style={{ color: "#1F9FBE", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
                See all charters →
              </Link>
            }
          />
          <div className="fx-ch-feat">
            {data.featured.map((l) => (
              <CharterCard key={l.id} l={l} />
            ))}
          </div>
        </section>
      )}
    </div>
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

export function CharterCard({
  l,
  rating,
}: {
  l: {
    id: string;
    title: string;
    hero_url: string | null;
    base_price_cents: number;
    duration_minutes: number | null;
    capacity: number | null;
    target_species: string[] | null;
    departure_location: string | null;
    charter_id?: string | null;
    business: { slug: string; name: string; city: string | null; region: string | null; verified_at: string | null } | null;
  };
  rating?: { avg: number; count: number } | null;
}) {
  const hours = l.duration_minutes ? Math.round((l.duration_minutes / 60) * 10) / 10 : null;
  const cardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    border: "1px solid rgba(13,34,54,.08)",
    borderRadius: 16,
    overflow: "hidden",
    textDecoration: "none",
    color: "#031029",
  };

  const body = (
    <>
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
          from{" "}
          <b style={{ fontFamily: serif, fontSize: 21, color: "#1F9FBE" }}>{money(l.base_price_cents)}</b>{" "}
          <span style={{ fontSize: 12 }}>/ trip</span>
        </div>
      </div>
    </>
  );

  // Route through the charter detail page (which shows all packages) when
  // the listing has a charter_id; otherwise link straight to booking.
  if (l.charter_id) {
    return (
      <Link to="/charters/$charterId" params={{ charterId: l.charter_id }} style={cardStyle}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/booking" search={{ service_id: l.id }} style={cardStyle}>
      {body}
    </Link>
  );
}
