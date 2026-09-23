import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { getMyBootstrap } from "@/lib/auth.functions";

const MarinaDashboard = lazy(() =>
  import("@/components/marina/MarinaDashboard").then((m) => ({ default: m.MarinaDashboard })),
);

const bootstrapQO = queryOptions({
  queryKey: ["my-bootstrap"],
  queryFn: () => getMyBootstrap(),
  staleTime: 5 * 60_000,
});

export const MARINA_SECTIONS = [
  "overview",
  "slips",
  "bookings",
  "calendar",
  "guests",
  "reservations",
  "services",
  "listings",
  "messages",
  "payouts",
  "settings",
] as const;

export const Route = createFileRoute("/_authenticated/marina/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    biz: typeof search.biz === "string" ? search.biz : "",
    setting: typeof search.setting === "string" ? search.setting : "",
  }),
  head: () => ({
    meta: [
      { title: "Marina console — Fish-X" },
      {
        name: "description",
        content: "Run your marina: berths, reservations, guests, payouts and listings.",
      },
      { property: "og:title", content: "Marina console — Fish-X" },
      {
        property: "og:description",
        content: "Run your marina: berths, reservations, guests, payouts and listings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarinaSectionPage,
});

function MarinaSectionPage() {
  const { section } = Route.useParams();
  const { biz, setting } = Route.useSearch();
  const { data: boot } = useSuspenseQuery(bootstrapQO);

  const memberships: any[] = Array.isArray(boot?.businesses) ? boot.businesses : [];
  const owned = memberships.map((m) => m?.business).filter(Boolean);
  const business =
    owned.find((b: any) => b.id === biz) ??
    owned.find((b: any) => ["marina", "lodge"].includes(b.category_key)) ??
    owned[0];

  const profile = boot?.profile ?? null;
  const operatorName = profile?.display_name || profile?.full_name || "Operator";

  if (!business) {
    return (
      <div style={{ background: "#0D161F", minHeight: "100vh", padding: "48px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", color: "#E8F2F6" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>No marina workspace yet</h1>
          <p style={{ color: "#8AA2B0", fontSize: 14, margin: "10px 0 18px" }}>
            Finish setting up your marina to manage berths and reservations.
          </p>
          <Link to="/onboarding" style={{ color: "#2DE2F2", fontWeight: 700 }}>
            Set up my marina
          </Link>
        </div>
      </div>
    );
  }

  const tab = (MARINA_SECTIONS as readonly string[]).includes(section) ? section : "overview";

  return (
    <Suspense fallback={<div style={{ background: "#0D161F", minHeight: "100vh" }} />}>
      <MarinaDashboard
        businessId={business.id}
        businessSlug={business.slug ?? null}
        workspaceName={business.name}
        operatorName={operatorName}
        initialTab={tab}
        initialSetting={setting}
      />
    </Suspense>
  );
}
