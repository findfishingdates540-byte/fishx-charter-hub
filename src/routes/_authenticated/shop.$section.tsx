import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { getMyBootstrap } from "@/lib/auth.functions";

const ShopDashboard = lazy(() =>
  import("@/components/tackle/ShopDashboard").then((m) => ({ default: m.ShopDashboard })),
);

const bootstrapQO = queryOptions({
  queryKey: ["my-bootstrap"],
  queryFn: () => getMyBootstrap(),
  staleTime: 5 * 60_000,
});

const SHOP_KINDS = ["tackle_shop", "bait_shop", "gear_mfg", "apparel"];

export const SHOP_SECTIONS = [
  "overview",
  "orders",
  "products",
  "customers",
  "analytics",
  "discounts",
  "online-store",
  "bookings",
  "wholesale",
  "messages",
  "payments",
  "settings",
] as const;

export const Route = createFileRoute("/_authenticated/shop/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    biz: typeof search.biz === "string" ? search.biz : "",
    setting: typeof search.setting === "string" ? search.setting : "",
  }),
  head: () => ({
    meta: [
      { title: "Store console — Fish-X" },
      {
        name: "description",
        content: "Run your store: orders, products, customers, discounts and payouts.",
      },
      { property: "og:title", content: "Store console — Fish-X" },
      {
        property: "og:description",
        content: "Run your store: orders, products, customers, discounts and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopSectionPage,
});

function ShopSectionPage() {
  const { section } = Route.useParams();
  const { biz, setting } = Route.useSearch();
  const { data: boot } = useSuspenseQuery(bootstrapQO);

  const memberships: any[] = Array.isArray(boot?.businesses) ? boot.businesses : [];
  const owned = memberships.map((m) => m?.business).filter(Boolean);
  const shops = owned.filter((b: any) => SHOP_KINDS.includes(b.category_key));
  const business = shops.find((b: any) => b.id === biz) ?? shops[0];

  const profile = boot?.profile ?? null;
  const operatorName = profile?.display_name || profile?.full_name || "Operator";

  if (!business) {
    return (
      <div style={{ background: "#0D161F", minHeight: "100vh", padding: "48px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", color: "#E8F2F6" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>No store workspace yet</h1>
          <p style={{ color: "#8AA2B0", fontSize: 14, margin: "10px 0 18px" }}>
            Finish setting up your store to list products and take orders.
          </p>
          <Link to="/onboarding" style={{ color: "#2DE2F2", fontWeight: 700 }}>
            Set up my store
          </Link>
        </div>
      </div>
    );
  }

  const tab = (SHOP_SECTIONS as readonly string[]).includes(section) ? section : "overview";

  return (
    <Suspense fallback={<div style={{ background: "#0D161F", minHeight: "100vh" }} />}>
      <ShopDashboard
        businessId={business.id}
        businessSlug={business.slug ?? null}
        workspaceName={business.name}
        operatorName={operatorName}
        categoryKey={business.category_key ?? "tackle_shop"}
        initialTab={tab}
        initialSetting={setting}
        workspaces={shops}
      />
    </Suspense>
  );
}
