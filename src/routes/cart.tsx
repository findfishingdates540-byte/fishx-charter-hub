import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { quoteShipping } from "@/lib/product-checkout.functions";
import { groupByShop, useCart, usd } from "@/hooks/use-cart";
import { C, card, input, LineRow, PageShell, primaryBtn, SummaryRow } from "@/components/shopping/checkout-ui";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — FISH-X.COM Marketplace" },
      { name: "description", content: "Review the gear in your Fish-X cart, adjust quantities and continue to checkout." },
      { property: "og:title", content: "Your cart — FISH-X.COM Marketplace" },
      { property: "og:description", content: "Review your Fish-X cart and continue to secure checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const groups = groupByShop(cart.lines);
  const quote = useServerFn(quoteShipping);
  const ship = useQuery({
    queryKey: ["shipping-quote", cart.items],
    queryFn: () => quote({ data: { items: cart.items.map(({ productId, quantity }) => ({ productId, quantity })) } }),
    enabled: cart.items.length > 0,
  });
  const [code, setCode] = useState("");
  const shipFor = (bid: string) => ship.data?.byVendor.find((v) => v.businessId === bid)?.shippingCents ?? 0;
  const shippingCents = ship.data?.shippingCents ?? 0;

  const goCheckout = async () => {
    if (code.trim()) window.sessionStorage.setItem("fx-checkout-code", code.trim());
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await navigate({ to: "/auth", search: { redirect: "/checkout" } });
      return;
    }
    await navigate({ to: "/checkout" });
  };

  if (cart.ready && cart.lines.length === 0) {
    return (
      <PageShell title="Your cart" step={1}>
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>Your cart is empty</div>
          <p style={{ color: C.mut }}>Find rods, tackle and apparel from verified Fish-X shops.</p>
          <Link to="/marketplace" style={{ ...primaryBtn(), maxWidth: 260, margin: "16px auto 0" }}>
            Browse the marketplace
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={`Your cart${cart.count ? ` · ${cart.count}` : ""}`} step={1}>
      <div className="fx-checkout-grid">
        <div style={{ display: "grid", gap: 14 }}>
          {!cart.ready && <div style={card}>Loading your cart…</div>}
          {groups.map((g) => (
            <section key={g.businessId} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong>{g.name}</strong>
                <span style={{ fontSize: 13, color: C.mut }}>Ships separately</span>
              </div>
              {g.lines.map((l) => (
                <LineRow key={l.key} line={l}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                    <button aria-label="Decrease" onClick={() => cart.setQty(l.key, l.qty - 1)} style={qtyBtn}>−</button>
                    <span style={{ minWidth: 20, textAlign: "center" }}>{l.qty}</span>
                    <button
                      aria-label="Increase"
                      disabled={l.qty >= Math.min(50, l.product.stockQty)}
                      onClick={() => cart.setQty(l.key, l.qty + 1)}
                      style={qtyBtn}
                    >
                      +
                    </button>
                    <button onClick={() => cart.setQty(l.key, 0)} style={{ marginLeft: 8, background: "none", border: "none", color: C.red, cursor: "pointer", fontFamily: C.sans }}>
                      Remove
                    </button>
                  </div>
                </LineRow>
              ))}
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, fontSize: 14 }}>
                <SummaryRow label="Shop subtotal" value={usd(g.subtotalCents)} />
                <SummaryRow label="Shipping estimate" value={ship.isLoading ? "…" : shipFor(g.businessId) ? usd(shipFor(g.businessId)) : "Free"} />
              </div>
            </section>
          ))}
          <Link to="/marketplace" style={{ color: C.accent }}>← Keep shopping</Link>
        </div>
        <aside style={{ ...card, position: "sticky", top: 16, alignSelf: "start" }}>
          <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Order summary</h2>
          <SummaryRow label="Subtotal" value={usd(cart.subtotalCents)} />
          <SummaryRow label="Shipping" value={ship.isLoading ? "…" : shippingCents ? usd(shippingCents) : "Free"} />
          <SummaryRow label="Estimated total" value={usd(cart.subtotalCents + shippingCents)} strong />
          <label style={{ display: "block", fontSize: 13, color: C.mut, margin: "12px 0 4px" }}>Discount code</label>
          <input value={code} onChange={(e) => setCode(e.target.value.slice(0, 40))} placeholder="Apply at checkout" style={input} />
          <button onClick={() => void goCheckout()} disabled={!cart.lines.length} style={{ ...primaryBtn(!cart.lines.length), marginTop: 14 }}>
            Continue to checkout
          </button>
          <p style={{ fontSize: 12, color: C.mut, marginTop: 10 }}>Payments are held by Fish-X until your order is delivered.</p>
        </aside>
      </div>
    </PageShell>
  );
}

const qtyBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 16 } as const;
