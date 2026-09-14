import { PublicHeader } from "@/components/public/PublicHeader";
import { MediaImg } from "@/components/media/MediaImg";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CATALOG,
  tileFor,
  money,
  ProductIcon,
  catFromCategory,
  iconFromCategory,
  type Product,
} from "@/components/marketplace/catalog";
import {
  getStoreProduct,
  previewStoreProduct,
  createProductCheckout,
  type ProductVariant,
  type StoreProduct,
} from "@/lib/product-checkout.functions";
import { getTradePricing, applyForTradeAccount, tradeUnitPrice } from "@/lib/wholesale.functions";
import { listMyWishlistIds, toggleWishlist } from "@/lib/shopping.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const rowToProduct = (row: StoreProduct): Product => {
  const cat = catFromCategory(row.category, row.sellerCategory);
  return {
    id: row.id,
    name: row.title,
    seller: row.sellerName,
    sellerType: "Verified vendor",
    price: row.priceCents / 100,
    rating: "5.0",
    reviews: 0,
    cat,
    icon: iconFromCategory(cat, row.title),
    description: row.description ?? undefined,
    live: true,
    image: row.image,
    stockQty: row.stockQty,
  };
};

export const Route = createFileRoute("/marketplace/$productId")({
  validateSearch: (s: Record<string, unknown>) => ({
    preview: s.preview === true || s.preview === "1",
  }),
  loaderDeps: ({ search }) => ({ preview: search.preview }),
  loader: async ({ params, deps }) => {
    const demo = CATALOG.find((p) => p.id === params.productId);
    if (demo)
      return {
        product: demo as Product | null,
        businessId: null as string | null,
        variants: [] as ProductVariant[],
      };
    // Real vendor inventory row (UUID id).
    const isUuid = /^[0-9a-f-]{36}$/i.test(params.productId);
    if (isUuid) {
      const row = await getStoreProduct({ data: { productId: params.productId } });
      if (row) {
        return {
          product: rowToProduct(row) as Product | null,
          businessId: row.businessId as string,
          variants: (row.variants ?? []) as ProductVariant[],
        };
      }
      // Owner preview mode: product may be unpublished; load client-side.
      if (deps.preview) return { product: null, businessId: null, variants: [] };
    }
    throw notFound();
  },

  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Product not found — FISH-X.COM Bookings & Marketplace" }, { name: "robots", content: "noindex" }] };
    const { product } = loaderData;
    const title = `${product.name} — Fish-X Marketplace`;
    const description = product.description ?? `${product.name} from ${product.seller}. Escrow-protected on Fish-X.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductDetail,
});

const V = {
  serif: "'Outfit',Georgia,serif",
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  navy: "#072057",
  paper: "#ffffff",
  card: "#ffffff",
  sand: "#2DE2F2",
  goldtext: "#1F9FBE",
  cyan: "#1f9fbe",
  cyansoft: "#e2eef2",
  ondmut: "#93a7b7",
  tmut: "#5c6b78",
  line: "rgba(13,34,54,.10)",
  lined: "rgba(255,255,255,.12)",
};

function ProductDetail() {
  const { product, businessId, variants } = Route.useLoaderData();
  const tile = tileFor(product.cat);
  const related = CATALOG.filter((p) => p.cat === product.cat && p.id !== product.id).slice(0, 3);
  const startCheckout = useServerFn(createProductCheckout);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const readCartCount = () => {
    try {
      const raw = window.localStorage.getItem("fx-cart");
      const cart: Record<string, number> = raw ? JSON.parse(raw) : {};
      return Object.values(cart).reduce((a, b) => a + (Number(b) || 0), 0);
    } catch {
      return 0;
    }
  };

  useEffect(() => setCartCount(readCartCount()), []);

  // ---- Wishlist (signed-in shoppers, real vendor products only) ----
  const loadSavedIds = useServerFn(listMyWishlistIds);
  const toggleSave = useServerFn(toggleWishlist);
  const [canSave, setCanSave] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!product.live) return;
      const { data } = await supabase.auth.getSession();
      if (!alive || !data.session) return;
      setCanSave(true);
      try {
        const ids = await loadSavedIds();
        if (alive) setSaved((ids ?? []).includes(product.id));
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      alive = false;
    };
  }, [product.id, product.live, loadSavedIds]);

  // ---- Variants (size / colour / weight) ----
  const [variantId, setVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const variant = variants.find((v) => v.id === variantId) ?? null;

  // ---- Trade pricing for approved wholesale buyers ----
  const loadTrade = useServerFn(getTradePricing);
  const applyTrade = useServerFn(applyForTradeAccount);
  const [trade, setTrade] = useState<Awaited<ReturnType<typeof getTradePricing>> | null>(null);
  const [tradeCompany, setTradeCompany] = useState("");
  const [tradeMsg, setTradeMsg] = useState("");
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!product.live || !businessId) return;
      const { data } = await supabase.auth.getSession();
      if (!alive || !data.session) return;
      try {
        const res = await loadTrade({ data: { businessId, productId: product.id } });
        if (alive) setTrade(res);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      alive = false;
    };
  }, [product.id, product.live, businessId, loadTrade]);

  const unitCents =
    trade && trade.status === "approved"
      ? tradeUnitPrice(Math.round(product.price * 100), trade, qty) +
        (variant?.price_delta_cents ?? 0)
      : Math.round(product.price * 100) + (variant?.price_delta_cents ?? 0);

  const maxQty = variant
    ? Math.max(1, variant.stock_qty)
    : product.live && product.stockQty != null
      ? Math.max(1, product.stockQty)
      : 99;

  /** Shared cart (localStorage) — the marketplace page hydrates from the same key. */
  const addToCart = () => {
    try {
      const raw = window.localStorage.getItem("fx-cart");
      const cart: Record<string, number> = raw ? JSON.parse(raw) : {};
      cart[product.id] = Math.min(maxQty, (cart[product.id] ?? 0) + qty);
      window.localStorage.setItem("fx-cart", JSON.stringify(cart));
      setCartCount(readCartCount());
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      /* storage unavailable */
    }
  };

  /** Live products go straight to Stripe Checkout; demo items bounce to the cart. */
  const buyNow = async () => {
    if (!product.live) {
      addToCart();
      window.location.href = "/marketplace?cart=1";
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await startCheckout({
        data: {
          items: [
            {
              productId: product.id,
              quantity: qty,
              ...(variantId ? { variantId } : {}),
            },
          ],
          origin: window.location.origin,
        },
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setErr("Could not start checkout.");
    } catch (e) {
      const msg = e instanceof Response ? await e.text() : String(e);
      setErr(msg.slice(0, 160) || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };



  return (
    <div style={{ minHeight: "100vh", background: V.paper, color: V.ink, fontFamily: V.sans }}>
      <PublicHeader
        hideNav
        actions={
          <>
            <Link
              to="/marketplace"
              style={{ color: "#eaf1f6", textDecoration: "none", fontSize: 13.5, fontWeight: 600, opacity: 0.9, whiteSpace: "nowrap" }}
            >
              Browse marketplace
            </Link>
            <Link
              to="/marketplace"
              search={{ cart: "1" }}
              style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 9, background: "var(--sand, #2DE2F2)", color: "#04121B", textDecoration: "none", borderRadius: 30, padding: "11px 18px", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                <path d="M6 8h12l-1.2 10H7.2z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
              Cart
              {cartCount > 0 && (
                <span style={{ background: "#04121B", color: "var(--sand, #2DE2F2)", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 7px" }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </>
        }
      />
      <div style={{ background: V.navy, color: "#eaf1f6", borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px", height: 54, display: "flex", alignItems: "center", gap: 14 }}>
          <Link to="/marketplace" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: V.ondmut, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <span>←</span> Back to marketplace
          </Link>
        </div>
      </div>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 60px" }}>
        <div className="mkt-detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,1fr)", gap: 36 }}>
          <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 22, overflow: "hidden" }}>
            <div style={{ position: "relative", aspectRatio: "1 / 1", background: tile.bg, display: "grid", placeItems: "center" }}>
              {product.image ? (
                <MediaImg src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: tile.ink, opacity: 0.9 }}>
                  <ProductIcon kind={product.icon} size={180} />
                </span>
              )}

              {product.badge && (
                <span style={{ position: "absolute", top: 18, left: 18, background: "rgba(6,21,31,.72)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 20 }}>
                  {product.badge}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: V.sand, display: "grid", placeItems: "center", color: "#04121B", fontSize: 9 }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.tmut }}>{product.seller}</span>
              <span style={{ fontSize: 12, color: V.tmut, opacity: 0.7 }}>· {product.sellerType}</span>
              {businessId && (
                <Link
                  to="/messages"
                  search={{ business: businessId, tab: "shops" as const }}
                  style={{ fontSize: 12, fontWeight: 700, color: "#0f7f95", textDecoration: "none", borderBottom: "1px solid #2DE2F2" }}
                >
                  Message seller
                </Link>
              )}
            </div>
            <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 40, lineHeight: 1.05, letterSpacing: "-.01em", margin: "0 0 12px" }}>
              {product.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: V.tmut, marginBottom: 18 }}>
              <span style={{ color: V.sand }}>★</span>
              <b style={{ color: V.ink }}>{product.rating}</b>
              <span>({product.reviews} reviews)</span>
            </div>
            <div style={{ fontFamily: V.serif, fontSize: 34, fontWeight: 600, color: V.goldtext, marginBottom: 20 }}>{money(product.price)}</div>

            {product.description && (
              <p style={{ fontSize: 15, lineHeight: 1.6, color: V.tmut, margin: "0 0 22px" }}>{product.description}</p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, background: V.cyansoft, border: `1px solid ${V.line}`, borderRadius: 12, padding: "12px 16px", marginBottom: 22 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", display: "grid", placeItems: "center", color: V.cyan, flex: "none" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <span style={{ fontSize: 13, color: V.ink }}>
                <b>Escrow-protected.</b> Seller is paid only after your delivery is confirmed.
              </span>
            </div>

            {variants.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: V.tmut, marginBottom: 8 }}>
                  {variants[0]!.option_name}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {variants.map((v) => {
                    const on = v.id === variantId;
                    const out = v.stock_qty <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out}
                        onClick={() => {
                          setVariantId(v.id);
                          setQty(1);
                        }}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 10,
                          border: `1px solid ${on ? V.navy : V.line}`,
                          background: on ? V.navy : V.card,
                          color: on ? "#fff" : out ? V.ondmut : V.ink,
                          fontFamily: V.sans,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: out ? "not-allowed" : "pointer",
                          textDecoration: out ? "line-through" : "none",
                        }}
                      >
                        {v.option_value}
                        {v.price_delta_cents ? ` (+${money(v.price_delta_cents / 100)})` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {trade && trade.status === "approved" && (
              <div style={{ marginBottom: 14, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14, background: V.cyansoft }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: V.ink }}>
                  Trade price {money(unitCents / 100)} / unit
                </div>
                <div style={{ fontSize: 12, color: V.tmut, marginTop: 4 }}>
                  Minimum order {trade.minOrderQty} units
                  {trade.casePack > 1 ? ` · cases of ${trade.casePack}` : ""}
                  {trade.tiers.length
                    ? ` · breaks: ${trade.tiers.map((t) => `${t.min_qty}+ @ ${money(t.unit_price_cents / 100)}`).join(", ")}`
                    : ""}
                </div>
              </div>
            )}

            {trade && trade.status !== "approved" && businessId && (
              <div style={{ marginBottom: 14, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: V.ink, marginBottom: 6 }}>
                  {trade.status === "pending"
                    ? "Trade account pending review"
                    : trade.status === "rejected"
                      ? "Trade application declined"
                      : "Buying for a shop? Apply for trade pricing"}
                </div>
                {trade.status === "none" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      value={tradeCompany}
                      onChange={(e) => setTradeCompany(e.target.value)}
                      placeholder="Business name"
                      style={{ flex: 1, minWidth: 180, padding: "10px 12px", borderRadius: 10, border: `1px solid ${V.line}`, fontFamily: V.sans, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!tradeCompany.trim()) return;
                        try {
                          await applyTrade({ data: { businessId, companyName: tradeCompany.trim() } });
                          setTrade({ ...trade, status: "pending" });
                          setTradeMsg("Application sent.");
                        } catch {
                          setTradeMsg("Could not send application.");
                        }
                      }}
                      style={{ background: V.navy, color: "#fff", border: 0, borderRadius: 10, padding: "10px 16px", fontFamily: V.sans, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      Apply
                    </button>
                  </div>
                )}
                {tradeMsg && <div style={{ fontSize: 12, color: V.tmut, marginTop: 6 }}>{tradeMsg}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${V.line}`, borderRadius: 12, background: V.card, overflow: "hidden" }}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  style={{ width: 42, height: 48, border: 0, background: "transparent", fontSize: 18, fontWeight: 700, color: V.ink, cursor: "pointer" }}
                >
                  −
                </button>
                <span style={{ minWidth: 36, textAlign: "center", fontSize: 15, fontWeight: 700, color: V.ink }}>{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  style={{ width: 42, height: 48, border: 0, background: "transparent", fontSize: 18, fontWeight: 700, color: V.ink, cursor: "pointer" }}
                >
                  +
                </button>
              </div>
              <button
                onClick={addToCart}
                style={{ flex: 1, background: V.navy, color: "#fff", border: 0, borderRadius: 12, padding: "14px 18px", fontFamily: V.sans, fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {added ? "✓ Added to cart" : "Add to cart"}
              </button>
              <button
                onClick={() => void buyNow()}
                disabled={busy}
                style={{ background: V.sand, color: "#04121B", border: 0, borderRadius: 12, padding: "14px 22px", fontFamily: V.sans, fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "Redirecting…" : "Buy now"}
              </button>
              {canSave && (
                <button
                  aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                  onClick={async () => {
                    setSavingBusy(true);
                    try {
                      const res = await toggleSave({ data: { productId: product.id } });
                      setSaved(!!res?.saved);
                    } catch {
                      /* non-fatal */
                    } finally {
                      setSavingBusy(false);
                    }
                  }}
                  disabled={savingBusy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: V.card,
                    color: saved ? "#d6455d" : V.ink,
                    border: `1px solid ${V.line}`,
                    borderRadius: 12,
                    padding: "14px 18px",
                    fontFamily: V.sans,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: savingBusy ? "wait" : "pointer",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{saved ? "♥" : "♡"}</span>
                  {saved ? "Saved" : "Save"}
                </button>
              )}
            </div>
            {product.live && product.stockQty != null && product.stockQty <= 10 && (
              <div style={{ fontSize: 12, color: V.goldtext, fontWeight: 600, marginBottom: 12 }}>
                Only {product.stockQty} left in stock
              </div>
            )}
            {err && <div style={{ color: "#b3261e", fontSize: 13, marginBottom: 18 }}>{err}</div>}
            <div style={{ marginBottom: 16 }} />


            {product.specs && product.specs.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.tmut, marginBottom: 10 }}>Specifications</div>
                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", margin: 0 }}>
                  {product.specs.map((s: { label: string; value: string }) => (
                    <div key={s.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${V.line}`, padding: "8px 0" }}>
                      <dt style={{ fontSize: 13, color: V.tmut }}>{s.label}</dt>
                      <dd style={{ fontSize: 13, fontWeight: 600, color: V.ink, margin: 0 }}>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <h2 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 26, margin: "0 0 18px" }}>More from this category</h2>
            <div className="mkt-related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
              {related.map((p) => {
                const t = tileFor(p.cat);
                return (
                  <Link
                    key={p.id}
                    to="/marketplace/$productId"
                    params={{ productId: p.id }}
                    style={{ textDecoration: "none", color: "inherit", background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}
                  >
                    <div style={{ height: 150, background: t.bg, display: "grid", placeItems: "center", color: t.ink }}>
                      <ProductIcon kind={p.icon} />
                    </div>
                    <div style={{ padding: "14px 16px 16px" }}>
                      <div style={{ fontSize: 12, color: V.tmut, marginBottom: 4 }}>{p.seller}</div>
                      <h3 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 17, lineHeight: 1.15, margin: "0 0 8px" }}>{p.name}</h3>
                      <div style={{ fontFamily: V.serif, fontSize: 18, fontWeight: 600, color: V.goldtext }}>{money(p.price)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <style>{`
        @media (max-width: 860px) {
          .mkt-detail-grid { grid-template-columns: 1fr !important; }
          .mkt-related-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
