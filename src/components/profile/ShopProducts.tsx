import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { MediaImg } from "@/components/media/MediaImg";
import { recommendShopProducts, type ShopRecommendation } from "@/lib/shop-assistant.functions";

export type ShopProduct = {
  id: string;
  title: string;
  category: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock_qty: number;
  image: string | null;
};

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
const input: React.CSSProperties = {
  background: "#0D161F",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 10,
  color: "#F0F2F5",
  fontSize: 13.5,
  padding: "9px 12px",
  fontFamily: "inherit",
  outline: "none",
};

type Sort = "newest" | "price_asc" | "price_desc" | "name";

export function ShopProducts({
  businessId,
  products,
  isShop,
  card,
  titleStyle,
}: {
  businessId: string;
  products: ShopProduct[];
  isShop: boolean;
  card: React.CSSProperties;
  titleStyle: React.CSSProperties;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [onlyStock, setOnlyStock] = useState(true);
  const [need, setNeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ summary: string; items: ShopRecommendation[] } | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const recommend = useServerFn(recommendShopProducts);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(),
    [products],
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (!onlyStock || p.stock_qty > 0) &&
        (cat === "all" || p.category === cat) &&
        (!term || p.title.toLowerCase().includes(term) || (p.category ?? "").toLowerCase().includes(term)),
    );
    if (sort === "price_asc") list.sort((a, b) => a.price_cents - b.price_cents);
    else if (sort === "price_desc") list.sort((a, b) => b.price_cents - a.price_cents);
    else if (sort === "name") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [products, q, cat, sort, onlyStock]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (need.trim().length < 3 || busy) return;
    setBusy(true);
    setAiErr(null);
    setAi(null);
    try {
      const r = await recommend({ data: { businessId, query: need.trim() } });
      if (r.ok) setAi({ summary: r.summary, items: r.items });
      else setAiErr(r.message);
    } catch {
      setAiErr("The assistant couldn't answer right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) return null;
  const showTools = isShop && products.length > 1;

  return (
    <section style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ ...titleStyle, margin: 0 }}>{isShop ? "Products" : "From the shop"}</h2>
        <Link to="/marketplace" style={{ fontSize: 13, color: "#2DE2F2", textDecoration: "none" }}>All products →</Link>
      </div>

      {isShop && (
        <form onSubmit={ask} style={{ background: "rgba(45,226,242,.06)", border: "1px solid rgba(45,226,242,.25)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
            <Sparkles size={16} color="#2DE2F2" /> Not sure what you need? Ask the shop assistant
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              maxLength={500}
              placeholder="e.g. Light rain jacket for inshore trips under $80"
              aria-label="Describe what you need"
              style={{ ...input, flex: "1 1 240px" }}
            />
            <button type="submit" disabled={busy || need.trim().length < 3} style={{ ...input, background: "#2DE2F2", color: "#0D161F", fontWeight: 700, border: "none", cursor: busy ? "wait" : "pointer", opacity: need.trim().length < 3 ? 0.6 : 1 }}>
              {busy ? "Finding…" : "Recommend"}
            </button>
          </div>
          {aiErr && <p style={{ color: "#F87171", fontSize: 12.5, margin: "10px 0 0" }}>{aiErr}</p>}
          {ai && (
            <div style={{ marginTop: 12 }}>
              {ai.summary && <p style={{ fontSize: 13, color: "#D5E1E8", margin: "0 0 8px" }}>{ai.summary}</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {ai.items.map((it) => {
                  const p = byId.get(it.productId);
                  if (!p) return null;
                  return (
                    <Link key={it.productId} to="/marketplace/$productId" params={{ productId: p.id }} style={{ display: "flex", gap: 10, alignItems: "center", textDecoration: "none", color: "#F0F2F5", background: "#1C2936", borderRadius: 10, padding: 8 }}>
                      {p.image ? <MediaImg src={p.image} alt={p.title} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: "#0D161F" }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title} <span style={{ color: "#2DE2F2" }}>{fmt(p.price_cents)}</span></div>
                        <div style={{ fontSize: 12, color: "#92A0AB" }}>{it.reason}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      )}

      {showTools && (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <Search size={15} color="#92A0AB" style={{ position: "absolute", left: 10, top: 11 }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" style={{ ...input, width: "100%", paddingLeft: 32, boxSizing: "border-box" }} />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort products" style={input}>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#D5E1E8" }}>
              <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> In stock only
            </label>
          </div>
          {categories.length > 1 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {["all", ...categories].map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} style={{ whiteSpace: "nowrap", fontSize: 12.5, padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(255,255,255,.12)", background: cat === c ? "#2DE2F2" : "transparent", color: cat === c ? "#0D161F" : "#D5E1E8", fontWeight: cat === c ? 700 : 500 }}>
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p style={{ fontSize: 13, color: "#92A0AB" }}>No products match your filters.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isShop ? "repeat(auto-fill,minmax(200px,1fr))" : "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
          {shown.map((p) => (
            <Link key={p.id} to="/marketplace/$productId" params={{ productId: p.id }} style={{ textDecoration: "none", color: "#F0F2F5", background: "#1C2936", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, overflow: "hidden", display: "block" }}>
              {p.image ? (
                <MediaImg src={p.image} alt={p.title} style={{ width: "100%", height: isShop ? 160 : 130, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ height: isShop ? 160 : 130, background: "linear-gradient(135deg,#0D161F,#1C2936)" }} />
              )}
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{p.title}</div>
                {p.category && <div style={{ fontSize: 11.5, color: "#92A0AB", marginTop: 3 }}>{p.category}</div>}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                  <span style={{ color: "#2DE2F2", fontWeight: 700 }}>{fmt(p.price_cents)}</span>
                  {p.compare_at_cents && p.compare_at_cents > p.price_cents && (
                    <span style={{ fontSize: 12, color: "#92A0AB", textDecoration: "line-through" }}>{fmt(p.compare_at_cents)}</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: p.stock_qty > 0 ? "#22C55E" : "#92A0AB", marginTop: 4 }}>
                  {p.stock_qty > 0 ? `${p.stock_qty} in stock` : "Out of stock"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
