import { formatWaterTypes } from "@/lib/water-types";
/**
 * Charter detail page — shows a charter's packages (time/duration variants),
 * lets the angler pick one and redirects to /_authenticated/booking?service_id=X&base=<charter-id>
 * so the BookingFlow stays stable when switching between packages.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { charterDetailQO } from "@/lib/charter-detail.query";
import { PublicHeader } from "@/components/public/PublicHeader";
import { DEFAULT_HERO } from "@/lib/platform-photos";
import { CharterCard } from "./charters.index";

type CharterDetailData = {
  charter: {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    hero_url: string | null;
    image_urls: string[] | null;
    water_type: string | null;
    target_species: string[] | null;
    departure_location: string | null;
    duration_minutes: number | null;
    capacity: number;
    base_price_cents: number;
    boat: { name: string | null } | null;
    business: {
      id: string;
      slug: string;
      name: string;
      city: string | null;
      region: string | null;
      country: string | null;
      verified_at: string | null;
    } | null;
  };
  packages: {
    id: string;
    slug: string | null;
    title: string;
    hero_url: string | null;
    base_price_cents: number;
    capacity: number | null;
    duration_minutes: number | null;
    target_species: string[] | null;
    is_published: boolean;
  }[];
};


export const Route = createFileRoute("/charters/$charterId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(charterDetailQO(params.charterId)),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Charter not found — FISH-X.COM" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const charter = loaderData.charter;
    const hours = charter.duration_minutes
      ? `${Math.round(charter.duration_minutes / 60)}h`
      : "—";
    const title = `${charter.name} · FISH-X.COM Bookings & Marketplace`;
    const description =
      charter.description?.slice(0, 160) ??
      `Book a fishing charter — ${formatWaterTypes(charter.water_type) || "unknown water type"} · ${hours} · $${Math.round(
        charter.base_price_cents / 100,
      ).toLocaleString()}`;
    const meta: Array<Record<string, string>> = [
      { title },
      {
        name: "description",
        content: description,
      },
      { property: "og:title", content: title },
      {
        property: "og:description",
        content: description,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (charter.hero_url && /^https?:\/\//.test(charter.hero_url)) {
      meta.push({ property: "og:image", content: charter.hero_url });
      meta.push({ name: "twitter:image", content: charter.hero_url });
    }
    return { meta };
  },
  component: CharterDetail,
  errorComponent: CharterError,
  notFoundComponent: CharterNotFound,
});
function CharterError() {
  return <CharterUnavailable />;
}

function CharterNotFound() {
  return <CharterUnavailable />;
}

function CharterUnavailable() {
  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "var(--sans, 'Outfit', system-ui)", color: "#031029" }}>
      <PublicHeader />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(48px,10vw,120px) 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Outfit',Georgia,serif", fontSize: "clamp(30px,4vw,44px)", margin: "0 0 12px" }}>
          This charter isn't available
        </h1>
        <p style={{ color: "#5c6b78", fontSize: 15, margin: "0 0 24px" }}>
          The captain may have unlisted it. Browse other trips to find your next day on the water.
        </p>
        <Link
          to="/charters"
          style={{ display: "inline-block", padding: "12px 22px", borderRadius: 999, background: "#031029", color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 14 }}
        >
          Browse charters
        </Link>
      </div>
    </div>
  );
}

function CharterDetail() {
  const params = Route.useParams();
  const { data, isLoading } = useSuspenseQuery(charterDetailQO(params.charterId));

  // Loader ensures data is present, but handle gracefully
  if (isLoading || !data) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Outfit',Georgia,serif", fontSize: "clamp(32px,4.4vw,52px)" }}>
          Loading…
        </h2>
      </div>
    );
  }

  const { charter, packages } = data;

  const hours = charter.duration_minutes ? Math.round(charter.duration_minutes / 60) : null;
  const locationParts = [charter.departure_location, charter.business?.city, charter.business?.region]
    .filter(Boolean)
    .join(", ");

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "var(--sans, 'Outfit', system-ui)", color: "#031029" }}>
      <PublicHeader />

      <section
        style={{
          position: "relative",
          padding: "clamp(48px,8vw,96px) 24px clamp(40px,6vw,72px)",
          background: "#fff",
          color: "#031029",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Link
              to="/charters"
              style={{
                fontSize: 13,
                color: "#5c6b78",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Back to charters
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: "'Outfit',Georgia,serif",
                  fontSize: "clamp(36px,5vw,56px)",
                  fontWeight: 600,
                  letterSpacing: "-.02em",
                  margin: "0 0 8px",
                }}
              >
                {charter.name}
              </h1>
              <p style={{ color: "#5c6b78", fontSize: 15, margin: 0 }}>
                {hours ? `${hours} · ` : ""}{formatWaterTypes(charter.water_type) || "Unknown water type"} · {charter.capacity} anglers max
                {charter.boat?.name ? ` · ${charter.boat.name}` : ""}
              </p>
            </div>
            {charter.business?.verified_at && (
              <span style={{ fontSize: 12, color: "#1F9FBE", fontWeight: 600 }}>
                Verified captain
              </span>
            )}
          </div>

          {charter.description && (
            <div
              style={{
                margin: "24px 0",
                fontSize: 15,
                lineHeight: 1.7,
                color: "#2a3f4f",
                fontFamily: "'Outfit',Georgia,serif",
              }}
            >
              {charter.description}
            </div>
          )}

          {locationParts && (
            <div style={{ marginBottom: 24, fontSize: 13, color: "#5c6b78" }}>
              Departing from: {locationParts}
            </div>
          )}

          {/* Target species tags */}
          {charter.target_species && charter.target_species.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {charter.target_species.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: 12,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "#eef3f7",
                    color: "#3a5a72",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Packages grid */}
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "0 24px clamp(40px,6vw,96px)",
            }}
          >
            {packages.length === 0 ? (
              <div
                style={{
                  padding: "48px",
                  textAlign: "center",
                  color: "#5c6b78",
                  border: "1px solid rgba(13,34,54,.08)",
                  borderRadius: 16,
                  background: "#fff",
                }}
              >
                No package variants available for this charter.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 24,
                  marginTop: 32,
                }}
              >
                {packages.map((pkg) => (
                  <CharterCard
                    key={pkg.id}
                    l={{
                      id: pkg.id,
                      title: pkg.title,
                      hero_url: pkg.hero_url,
                      base_price_cents: pkg.base_price_cents,
                      duration_minutes: pkg.duration_minutes,
                      capacity: pkg.capacity,
                      target_species: pkg.target_species ?? [],
                      departure_location: charter.departure_location ?? "",
                      business: {
                        name: charter.business?.name ?? "",
                        slug: charter.business?.slug ?? "",
                        city: charter.business?.city ?? "",
                        region: charter.business?.region ?? "",
                        verified_at: charter.business?.verified_at ?? new Date().toISOString(),
                      },
                    }}
                    rating={null}
                  />
                ))}
              </div>
            )}
          </div>

          {packages.length > 0 && (
            <div
              style={{
                maxWidth: 1280,
                margin: "0 auto",
                padding: "0 24px clamp(40px,6vw,96px)",
                marginTop: 40,
                textAlign: "center",
              }}
            >
              <p style={{ color: "#5c6b78", fontSize: 15, margin: "0 0 20px" }}>
                Select a departure variant to book:
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}