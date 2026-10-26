import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCart, usd } from "@/hooks/use-cart";
import { C, card, PageShell, primaryBtn } from "@/components/shopping/checkout-ui";

export const Route = createFileRoute("/_authenticated/checkout/success")({
  validateSearch: (s: Record<string, unknown>): { orders?: string } =>
    typeof s.orders === "string" && /^[0-9a-f,-]{36,400}$/i.test(s.orders) ? { orders: s.orders } : {},
  head: () => ({
    meta: [
      { title: "Order confirmed — FISH-X.COM Marketplace" },
      { name: "description", content: "Thanks for your Fish-X order. Track it any time from My Orders." },
      { property: "og:title", content: "Order confirmed — FISH-X.COM Marketplace" },
      { property: "og:description", content: "Your Fish-X marketplace order is confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
});

type Summary = { totalCents: number; address: Record<string, string | undefined> };

function SuccessPage() {
  const { orders } = Route.useSearch();
  const cart = useCart();
  const [summary, setSummary] = useState<Summary | null>(null);
  const ids = (orders ?? "").split(",").filter(Boolean);

  useEffect(() => {
    try {
      setSummary(JSON.parse(window.sessionStorage.getItem("fx-checkout-summary") || "null"));
      window.sessionStorage.removeItem("fx-checkout-draft");
    } catch {
      /* ignore */
    }
  }, []);
  // Clear the basket once it has loaded.
  useEffect(() => {
    if (cart.ready && cart.lines.length) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);

  const a = summary?.address;
  return (
    <PageShell title="Thank you — order placed" step={3}>
      <div style={{ ...card, maxWidth: 620 }}>
        <p style={{ marginTop: 0 }}>
          Your payment is being confirmed. You'll get a notification as soon as the shop starts packing.
        </p>
        {ids.length > 0 && (
          <p>
            Order{ids.length > 1 ? "s" : ""}:{" "}
            <strong>{ids.map((i) => i.slice(0, 8).toUpperCase()).join(", ")}</strong>
          </p>
        )}
        {summary && <p>Total paid: <strong>{usd(summary.totalCents)}</strong></p>}
        {a && (
          <p style={{ color: C.mut }}>
            Shipping to {a.name}, {[a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ")}
          </p>
        )}
        <Link to="/dashboard" search={{ tab: "orders" } as never} style={{ ...primaryBtn(), marginTop: 16 }}>
          View my orders
        </Link>
        <Link to="/marketplace" style={{ display: "block", textAlign: "center", marginTop: 12, color: C.accent }}>
          Keep shopping
        </Link>
      </div>
    </PageShell>
  );
}
