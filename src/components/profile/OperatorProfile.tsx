import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { MarinaServiceRequest } from "@/components/profile/MarinaServiceRequest";
import { StorefrontBooking } from "@/components/profile/StorefrontBooking";

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listFollowedSellers, toggleFollowSeller } from "@/lib/shopping.functions";

/** Follow / unfollow a seller — only rendered for signed-in shoppers. */
function FollowButton({ businessId }: { businessId: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadFollowed = useServerFn(listFollowedSellers);
  const toggle = useServerFn(toggleFollowSeller);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive || !data.session) return;
      setSignedIn(true);
      try {
        const rows = await loadFollowed();
        if (alive) setFollowing((rows ?? []).some((r) => r.businessId === businessId));
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId, loadFollowed]);

  if (!signedIn) return null;

  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const res = await toggle({ data: { businessId } });
          setFollowing(!!res?.following);
        } catch {
          /* non-fatal */
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      style={{
        alignSelf: "flex-end",
        background: following ? "transparent" : "#2DE2F2",
        color: following ? "#2DE2F2" : "#04121B",
        border: `1px solid ${following ? "rgba(45,226,242,.5)" : "#2DE2F2"}`,
        borderRadius: 30,
        padding: "11px 20px",
        fontSize: 13,
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {following ? "✓ Following" : "Follow seller"}
    </button>
  );
}

type Service = {
  id: string;
  slug: string | null;
  kind: string;
  title: string;
  description: string | null;
  hero_url: string | null;
  duration_minutes: number | null;
  capacity: number | null;
  base_price_cents: number;
  deposit_cents: number | null;
  target_species: string[] | null;
  departure_location: string | null;
};

type Review = {
  id: string;
  rating: number;
  body: string | null;
  response_body: string | null;
  created_at: string;
  angler: { display_name: string | null; avatar_url: string | null } | null;
};

type Business = {
  id: string;
  slug: string;
  name: string;
  category_key: string;
  tagline: string | null;
  description: string | null;
  hero_url: string | null;
  logo_url: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  verified_at: string | null;
  premium_until: string | null;
};

type Boat = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  length_ft: number | null;
  capacity: number | null;
  home_port: string | null;
  description: string | null;
  hero_image_url: string | null;
  image_urls: string[] | null;
};

type Product = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock_qty: number;
  image: string | null;
};

type Slip = {
  id: string;
  slip_number: string;
  length_ft: number | null;
  beam_ft: number | null;
  draft_ft: number | null;
  amperage: string | null;
  monthly_rate_cents: number | null;
  nightly_rate_cents: number | null;
  status: string;
};

type Departure = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  seatsLeft: number;
  priceCents: number;
};

type Post = { id: string; body: string; media_json: any; created_at: string };

type Props = {
  business: Business;
  services: Service[];
  reviews: Review[];
  ratingSummary: { average: number; count: number; buckets: number[] };
  variant: "captain" | "guide";
  boats?: Boat[];
  products?: Product[];
  slips?: Slip[];
  upcoming?: Departure[];
  posts?: Post[];
};

const fmtPrice = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString()}`;

const CARD: React.CSSProperties = {
  background: "#14202B",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 20,
  padding: 26,
};

const LABEL_BY_CATEGORY: Record<string, { services: string; blurb: string }> = {
  charter: { services: "Trips offered", blurb: "All escrow-protected" },
  guide_service: { services: "Guided trips", blurb: "All escrow-protected" },
  tackle_shop: { services: "Services & clinics", blurb: "Book in-store services" },
  bait_shop: { services: "Services", blurb: "Book ahead" },
  marina: { services: "Dockage & services", blurb: "Reserve ahead" },
  lodge: { services: "Stays & packages", blurb: "Escrow-protected" },
  apparel: { services: "Services", blurb: "" },
  gear_mfg: { services: "Services", blurb: "" },
};

export function OperatorProfile({
  business: b,
  services,
  reviews,
  ratingSummary,
  variant,
  boats = [],
  products = [],
  slips = [],
  upcoming = [],
  posts = [],
}: Props) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(services[0]?.id ?? null);
  const selected = useMemo(() => services.find((s) => s.id === selectedServiceId) ?? services[0], [services, selectedServiceId]);
  const location = [b.city, b.region, b.country].filter(Boolean).join(", ");
  const avg = ratingSummary.average ? ratingSummary.average.toFixed(2) : "—";
  const hours = normalizeHours((b as any).hours_json);
  const amenities = normalizeAmenities((b as any).amenities_json);
  const gallery: string[] = Array.isArray((b as any).gallery_json) ? (b as any).gallery_json : [];
  const highlights: string[] = Array.isArray((b as any).highlights_json) ? (b as any).highlights_json : [];
  const social = ((b as any).social_json ?? {}) as Record<string, string>;
  const policies = ((b as any).policies_json ?? {}) as Record<string, string>;
  const faq: Array<{ q: string; a: string }> = Array.isArray((b as any).faq_json) ? (b as any).faq_json : [];
  const yearFounded = (b as any).year_founded as number | null;
  const socialLinks = Object.entries(social).filter(([, v]) => typeof v === "string" && v.trim());
  const labels = LABEL_BY_CATEGORY[b.category_key] ?? { services: "What we offer", blurb: "" };
  const isShop = ["tackle_shop", "bait_shop", "apparel", "gear_mfg"].includes(b.category_key);

  const roleLabel = variant === "captain" ? "Verified captain" : "Verified guide";
  const heroFallback = "linear-gradient(135deg,#F0F2F5,#031029)";


  return (
    <div className="fx-shell" style={{ background: "#0D161F", minHeight: "100vh", fontFamily: "'Outfit', system-ui, sans-serif", color: "#F0F2F5" }}>
      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(9,27,44,.94)", backdropFilter: "saturate(140%) blur(12px)", borderBottom: "1px solid rgba(255,255,255,.1)", color: "#F0F2F5" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px", height: 62, display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#F0F2F5" }}>
            <BrandLogo size="md" accent="#2DE2F2" color="#F0F2F5" />
          </Link>
          <Link to="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#92A0AB", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
            <span>←</span> Back to directory
          </Link>
        </div>
      </header>

      {/* Cover */}
      <div style={{ position: "relative", height: 280, overflow: "hidden", background: b.hero_url ? `#0D161F url(${b.hero_url}) center/cover` : heroFallback }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,34,54,.35) 0%,rgba(10,34,54,0) 40%,rgba(238,242,245,0) 70%,#F0F2F5 100%)" }} />
      </div>

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px 64px" }}>
        {/* Identity */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginTop: -64, position: "relative", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "none" }}>
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.name} style={{ width: 128, height: 128, borderRadius: 24, objectFit: "cover", border: "5px solid #273744", boxShadow: "0 24px 48px -24px rgba(4,10,16,.62)" }} />
            ) : (
              <div style={{ width: 128, height: 128, borderRadius: 24, background: "#0D161F", border: "5px solid #273744", display: "grid", placeItems: "center", color: "#2DE2F2", fontFamily: "'Outfit', Georgia, serif", fontSize: 44, fontWeight: 600, boxShadow: "0 24px 48px -24px rgba(4,10,16,.62)" }}>
                {b.name.charAt(0)}
              </div>
            )}
            {b.verified_at && (
              <span title={roleLabel} style={{ position: "absolute", bottom: -8, right: -8, width: 36, height: 36, borderRadius: "50%", background: "#2DE2F2", display: "grid", placeItems: "center", color: "#04121B", fontSize: 16, border: "3px solid #273744" }}>✓</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 260, paddingBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: "'Outfit', Georgia, serif", fontWeight: 600, fontSize: 38, letterSpacing: "-.01em", lineHeight: 1, margin: 0 }}>{b.name}</h1>
              {ratingSummary.average >= 4.9 && ratingSummary.count >= 10 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(45,226,242,.15)", color: "#2DE2F2", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", borderRadius: 20, padding: "5px 11px" }}>★ Top rated</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#92A0AB", marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#2DE2F2" }}>★</span>
              <b style={{ color: "#F0F2F5" }}>{avg}</b>
              <span>({ratingSummary.count} review{ratingSummary.count === 1 ? "" : "s"})</span>
              {location && <>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#92A0AB", opacity: .5 }} />
                <span>{location}</span>
              </>}
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#92A0AB", opacity: .5 }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#22C55E", fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E" }} />
                Accepting bookings
              </span>
            </div>
          </div>
          <FollowButton businessId={b.id} />
          <div style={{ display: "flex", gap: 26, padding: "16px 22px", background: "#14202B", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, flex: "none", flexWrap: "wrap" }}>
            <Stat n={services.length} label={isShop ? "services" : "trips"} />
            {boats.length > 0 && <Stat n={boats.length} label={boats.length === 1 ? "boat" : "boats"} divider />}
            {products.length > 0 && <Stat n={products.length} label="products" divider />}
            {slips.length > 0 && <Stat n={slips.length} label="slips" divider />}
            <Stat n={ratingSummary.count} label="reviews" divider />
            <Stat n={b.verified_at ? "✓" : "—"} label={b.verified_at ? "verified" : "pending"} divider />
          </div>

        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 26, marginTop: 34 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* About */}
            {(b.description || highlights.length > 0 || yearFounded) && (
              <section style={{ background: "#14202B", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: 26 }}>
                <h2 style={sectionTitle}>About</h2>
                {b.description && (
                  <p style={{ color: "#92A0AB", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>{b.description}</p>
                )}
                {yearFounded && (
                  <p style={{ color: "#92A0AB", margin: "12px 0 0", fontSize: 13.5 }}>Operating since {yearFounded}</p>
                )}
                {highlights.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {highlights.map((h) => (
                      <span key={h} style={{ background: "rgba(45,226,242,.12)", color: "#2DE2F2", borderRadius: 20, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {gallery.length > 0 && (
              <section style={CARD}>
                <h2 style={sectionTitle}>Photos</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                  {gallery.map((src, i) => (
                    <img
                      key={`${i}-${src}`}
                      src={src}
                      alt={`${b.name} photo ${i + 1}`}
                      loading="lazy"
                      style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 14, border: "1px solid rgba(255,255,255,.07)" }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Services / Trips */}
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ ...sectionTitle, margin: 0 }}>{labels.services}</h2>
                {labels.blurb && <span style={{ fontSize: 13, color: "#92A0AB" }}>{labels.blurb}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {services.length === 0 && (
                  <div style={{ background: "#14202B", border: "1px dashed rgba(255,255,255,.12)", borderRadius: 18, padding: 32, textAlign: "center", color: "#92A0AB" }}>
                    Nothing published here yet.
                  </div>
                )}

                {services.map((s) => {
                  const active = selectedServiceId === s.id;
                  return (
                    <article key={s.id} style={{ background: "#14202B", border: `1px solid ${active ? "#2DE2F2" : "rgba(255,255,255,.07)"}`, borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 18 }}>
                      <div style={{ width: 104, height: 80, borderRadius: 12, flex: "none", background: s.hero_url ? `#e9edf1 url(${s.hero_url}) center/cover` : "linear-gradient(135deg,#F0F2F5,#031029)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: "'Outfit', Georgia, serif", fontWeight: 600, fontSize: 19, margin: 0, color: "#F0F2F5" }}>{s.title}</h3>
                        <div style={{ fontSize: 13, color: "#92A0AB", marginTop: 4 }}>
                          {[
                            s.duration_minutes ? `${Math.round(s.duration_minutes / 60)} hr` : null,
                            s.capacity ? `up to ${s.capacity}` : null,
                            s.target_species?.slice(0, 3).join(", "),
                          ].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flex: "none" }}>
                        <div>
                          <span style={{ fontSize: 11, color: "#92A0AB" }}>from </span>
                          <span style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#2DE2F2" }}>{fmtPrice(s.base_price_cents)}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#92A0AB" }}>per trip</div>
                      </div>
                      <button
                        onClick={() => setSelectedServiceId(s.id)}
                        style={{ flex: "none", background: active ? "#1C2936" : "#2DE2F2", color: active ? "#F0F2F5" : "#04121B", border: 0, borderRadius: 11, padding: "12px 20px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        {active ? "Selected" : "Select"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Next departures */}
            {upcoming.length > 0 && (
              <section style={CARD}>
                <h2 style={sectionTitle}>Next available departures</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
                  {upcoming.map((u) => (
                    <Link
                      key={u.id}
                      to="/booking"
                      search={{ service_id: u.serviceId }}
                      style={{ textDecoration: "none", background: "#1C2936", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 14, display: "block", color: "#F0F2F5" }}
                    >
                      <div style={{ fontSize: 12, color: "#2DE2F2", fontWeight: 700 }}>
                        {new Date(u.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {new Date(u.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} –{" "}
                        {new Date(u.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div style={{ fontSize: 12, color: "#92A0AB", marginTop: 4 }}>{u.serviceTitle}</div>
                      <div style={{ fontSize: 12, color: "#92A0AB", marginTop: 6 }}>
                        {u.seatsLeft} seat{u.seatsLeft === 1 ? "" : "s"} left · {fmtPrice(u.priceCents)}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Fleet */}
            {boats.length > 0 && (
              <section style={CARD}>
                <h2 style={sectionTitle}>The fleet</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
                  {boats.map((bt) => {
                    const cover = bt.hero_image_url ?? bt.image_urls?.[0] ?? null;
                    const extra = (bt.image_urls ?? []).filter((u) => u && u !== cover);
                    return (
                      <article key={bt.id} style={{ background: "#1C2936", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, overflow: "hidden" }}>
                        {cover ? (
                          <img src={cover} alt={bt.name} style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ height: 150, background: "linear-gradient(135deg,#0D161F,#1C2936)" }} />
                        )}
                        <div style={{ padding: 14 }}>
                          <div style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 19, fontWeight: 600 }}>{bt.name}</div>
                          <div style={{ fontSize: 12.5, color: "#92A0AB", marginTop: 4 }}>
                            {[
                              [bt.make, bt.model].filter(Boolean).join(" "),
                              bt.length_ft ? `${bt.length_ft} ft` : null,
                              bt.capacity ? `up to ${bt.capacity} anglers` : null,
                            ].filter(Boolean).join(" · ")}
                          </div>
                          {bt.home_port && <div style={{ fontSize: 12, color: "#92A0AB", marginTop: 4 }}>⚓ {bt.home_port}</div>}
                          {bt.description && (
                            <p style={{ fontSize: 12.5, color: "#92A0AB", lineHeight: 1.5, margin: "8px 0 0" }}>
                              {bt.description.slice(0, 120)}{bt.description.length > 120 ? "…" : ""}
                            </p>
                          )}
                          {extra.length > 0 && (
                            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                              {extra.slice(0, 4).map((u, idx) => (
                                <img key={idx} src={u} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover" }} />
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Shop */}
            {products.length > 0 && (
              <section style={CARD}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ ...sectionTitle, margin: 0 }}>From the shop</h2>
                  <Link to="/marketplace" style={{ fontSize: 13, color: "#2DE2F2", textDecoration: "none" }}>All products →</Link>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      to="/marketplace/$productId"
                      params={{ productId: p.id }}
                      style={{ textDecoration: "none", color: "#F0F2F5", background: "#1C2936", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, overflow: "hidden", display: "block" }}
                    >
                      {p.image ? (
                        <img src={p.image} alt={p.title} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ height: 130, background: "linear-gradient(135deg,#0D161F,#1C2936)" }} />
                      )}
                      <div style={{ padding: 12 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{p.title}</div>
                        {p.category && <div style={{ fontSize: 11.5, color: "#92A0AB", marginTop: 3 }}>{p.category}</div>}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                          <span style={{ color: "#2DE2F2", fontWeight: 700 }}>{fmtPrice(p.price_cents)}</span>
                          {p.compare_at_cents && p.compare_at_cents > p.price_cents && (
                            <span style={{ fontSize: 12, color: "#92A0AB", textDecoration: "line-through" }}>{fmtPrice(p.compare_at_cents)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: p.stock_qty > 0 ? "#22C55E" : "#92A0AB", marginTop: 4 }}>
                          {p.stock_qty > 0 ? `${p.stock_qty} in stock` : "Out of stock"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Marina slips */}
            {slips.length > 0 && (
              <section style={CARD}>
                <h2 style={sectionTitle}>Slips & dockage</h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#92A0AB", textAlign: "left" }}>
                        <th style={th}>Slip</th>
                        <th style={th}>LOA</th>
                        <th style={th}>Beam</th>
                        <th style={th}>Power</th>
                        <th style={th}>Nightly</th>
                        <th style={th}>Monthly</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slips.map((s) => (
                        <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
                          <td style={td}><b>{s.slip_number}</b></td>
                          <td style={td}>{s.length_ft ? `${s.length_ft} ft` : "—"}</td>
                          <td style={td}>{s.beam_ft ? `${s.beam_ft} ft` : "—"}</td>
                          <td style={td}>{s.amperage ?? "—"}</td>
                          <td style={td}>{s.nightly_rate_cents ? fmtPrice(s.nightly_rate_cents) : "—"}</td>
                          <td style={td}>{s.monthly_rate_cents ? fmtPrice(s.monthly_rate_cents) : "—"}</td>
                          <td style={{ ...td, color: s.status === "available" ? "#22C55E" : "#92A0AB", textTransform: "capitalize" }}>{s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {b.category_key === "marina" && (
              <MarinaServiceRequest
                businessId={b.id}
                amenities={((b as any).amenities_json ?? {}) as Record<string, boolean>}
              />
            )}

            {/* Updates */}
            {posts.length > 0 && (
              <section style={CARD}>
                <h2 style={sectionTitle}>Latest updates</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {posts.map((p) => (
                    <div key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 14 }}>
                      <div style={{ fontSize: 12, color: "#92A0AB" }}>
                        {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <p style={{ margin: "6px 0 0", color: "#F0F2F5", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{p.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}



            {(policies.cancellation || policies.rules || policies.languages || policies.payment_methods) && (
              <section style={CARD}>
                <h2 style={sectionTitle}>Good to know</h2>
                <div style={{ display: "grid", gap: 14 }}>
                  {policies.cancellation && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F2F5", marginBottom: 4 }}>Cancellation policy</div>
                      <p style={{ margin: 0, color: "#92A0AB", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{policies.cancellation}</p>
                    </div>
                  )}
                  {policies.rules && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F2F5", marginBottom: 4 }}>House rules</div>
                      <p style={{ margin: 0, color: "#92A0AB", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{policies.rules}</p>
                    </div>
                  )}
                  {policies.languages && (
                    <div style={{ fontSize: 13.5, color: "#92A0AB" }}>
                      <b style={{ color: "#F0F2F5" }}>Languages:</b> {policies.languages}
                    </div>
                  )}
                  {policies.payment_methods && (
                    <div style={{ fontSize: 13.5, color: "#92A0AB" }}>
                      <b style={{ color: "#F0F2F5" }}>Payments accepted:</b> {policies.payment_methods}
                    </div>
                  )}
                </div>
              </section>
            )}

            {faq.length > 0 && (
              <section style={CARD}>
                <h2 style={sectionTitle}>Frequently asked</h2>
                <div style={{ display: "grid", gap: 14 }}>
                  {faq.map((f, i) => (
                    <div key={i} style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : "none", paddingTop: i ? 14 : 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5" }}>{f.q}</div>
                      <p style={{ margin: "5px 0 0", color: "#92A0AB", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section style={{ background: "#14202B", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: 26 }}>
              <div style={{ display: "flex", gap: 34, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 24 }}>
                <div style={{ flex: "none", textAlign: "center", padding: "6px 0" }}>
                  <div style={{ fontFamily: "'Outfit', Georgia, serif", fontWeight: 600, fontSize: 54, lineHeight: 1 }}>{avg}</div>
                  <div style={{ color: "#2DE2F2", fontSize: 14, letterSpacing: 2, margin: "6px 0 2px" }}>★★★★★</div>
                  <div style={{ fontSize: 12, color: "#92A0AB" }}>{ratingSummary.count} verified review{ratingSummary.count === 1 ? "" : "s"}</div>
                </div>
                <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 7, paddingTop: 4 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const cnt = ratingSummary.buckets[star - 1] ?? 0;
                    const pct = ratingSummary.count ? (cnt / ratingSummary.count) * 100 : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#92A0AB", width: 44 }}>{star} star{star === 1 ? "" : "s"}</span>
                        <div style={{ flex: 1, height: 7, borderRadius: 7, background: "#1C2936", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#2DE2F2", borderRadius: 7 }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#92A0AB", width: 34, textAlign: "right" }}>{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {reviews.length === 0 && (
                  <p style={{ color: "#92A0AB", margin: "20px 0" }}>No reviews yet. Be the first to book and share your experience.</p>
                )}
                {reviews.map((r) => (
                  <figure key={r.id} style={{ margin: 0, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      {r.angler?.avatar_url ? (
                        <img src={r.angler.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#0D161F", color: "#2DE2F2", display: "grid", placeItems: "center", fontWeight: 600 }}>
                          {(r.angler?.display_name ?? "A").charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.angler?.display_name ?? "Fish-X angler"}</div>
                        <div style={{ fontSize: 12, color: "#92A0AB" }}>{new Date(r.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                      </div>
                      <span style={{ color: "#2DE2F2", fontSize: 12, letterSpacing: 1.5, flex: "none" }}>{"★".repeat(r.rating)}</span>
                    </div>
                    {r.body && <blockquote style={{ fontSize: 14, lineHeight: 1.6, color: "#92A0AB", margin: 0 }}>{r.body}</blockquote>}
                    {r.response_body && (
                      <div style={{ marginTop: 12, padding: 12, background: "#1C2936", borderRadius: 10, fontSize: 13, color: "#F0F2F5" }}>
                        <b>Response from {b.name}:</b> {r.response_body}
                      </div>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          </div>

          {/* Right rail */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 86, alignSelf: "flex-start" }}>
            {socialLinks.length > 0 && (
              <div style={{ background: "#14202B", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: 20 }}>
                <h2 style={{ ...sectionTitle, fontSize: 15 }}>Follow along</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {socialLinks.map(([k, v]) => (
                    <a
                      key={k}
                      href={/^https?:\/\//.test(v) ? v : `https://${v}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ background: "#1C2936", color: "#2DE2F2", borderRadius: 20, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", textTransform: "capitalize" }}
                    >
                      {k}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <StorefrontBooking
              services={services.map((s) => ({
                id: s.id,
                title: s.title,
                base_price_cents: s.base_price_cents,
                capacity: s.capacity,
                duration_minutes: s.duration_minutes,
              }))}
              selectedServiceId={selected?.id ?? null}
              onSelectService={setSelectedServiceId}
            />


            <div style={{ background: "#0D161F", color: "#F0F2F5", borderRadius: 20, padding: 22 }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#2DE2F2", fontWeight: 700 }}>Contact</div>
              <Link
                to="/messages"
                search={{ business: b.id, tab: "shops" as const }}
                style={{ display: "block", marginTop: 12, textAlign: "center", background: "#2DE2F2", color: "#04121B", borderRadius: 12, padding: "12px 16px", fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", textDecoration: "none" }}
              >
                Message this operator
              </Link>
              <div style={{ marginTop: 10, fontSize: 13.5, display: "flex", flexDirection: "column", gap: 8 }}>
                {b.address && <div>📍 {[b.address, b.city].filter(Boolean).join(", ")}</div>}
                {b.website && <a href={b.website} target="_blank" rel="noreferrer" style={{ color: "#2DE2F2", textDecoration: "none" }}>Website ↗</a>}
              </div>
            </div>

            {hours.length > 0 && (
              <div style={{ ...CARD, padding: 22 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#2DE2F2", fontWeight: 700 }}>Hours</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
                  {hours.map((h) => (
                    <div key={h.day} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "#92A0AB", textTransform: "capitalize" }}>{h.day}</span>
                      <span>{h.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {amenities.length > 0 && (
              <div style={{ ...CARD, padding: 22 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#2DE2F2", fontWeight: 700 }}>Amenities</div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {amenities.map((a) => (
                    <span key={a} style={{ background: "#1C2936", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: "6px 12px", fontSize: 12.5, color: "#F0F2F5" }}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Stat({ n, label, divider }: { n: number | string; label: string; divider?: boolean }) {
  return (
    <div style={divider ? { borderLeft: "1px solid rgba(255,255,255,.07)", paddingLeft: 26 } : undefined}>
      <div style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: "#92A0AB", marginTop: 3 }}>{label}</div>
    </div>
  );
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** hours_json is operator-authored, so tolerate strings or {open,close} shapes. */
function normalizeHours(raw: unknown): { day: string; value: string }[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: { day: string; value: string }[] = [];
  for (const day of DAY_ORDER) {
    const v = (raw as Record<string, unknown>)[day];
    if (v == null) continue;
    if (typeof v === "string") out.push({ day, value: v });
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o.closed) out.push({ day, value: "Closed" });
      else if (typeof o.open === "string" && typeof o.close === "string") out.push({ day, value: `${o.open} – ${o.close}` });
    }
  }
  return out;
}

function normalizeAmenities(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/_/g, " "));
  }
  return [];
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12, letterSpacing: ".04em", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "10px", color: "#F0F2F5" };

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Outfit', Georgia, serif",
  fontWeight: 600,
  fontSize: 23,
  margin: "0 0 14px",
  color: "#F0F2F5",
};

