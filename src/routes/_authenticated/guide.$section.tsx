import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { getMyBootstrap } from "@/lib/auth.functions";

const GuideDashboard = lazy(() =>
  import("@/components/guide/GuideDashboard").then((m) => ({ default: m.GuideDashboard })),
);

const bootstrapQO = queryOptions({
  queryKey: ["my-bootstrap"],
  queryFn: () => getMyBootstrap(),
  staleTime: 5 * 60_000,
});

export const GUIDE_SECTIONS = [
  "overview",
  "trips",
  "calendar",
  "guides",
  "slots",
  "guests",
  "requests",
  "listings",
  "messages",
  "payouts",
  "settings",
] as const;

export const Route = createFileRoute("/_authenticated/guide/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    biz: typeof search.biz === "string" ? search.biz : "",
    setting: typeof search.setting === "string" ? search.setting : "",
  }),
  head: () => ({
    meta: [
      { title: "Guide console — Fish-X" },
      {
        name: "description",
        content: "Run your guide service: trips, availability, guests, payouts and listings.",
      },
      { property: "og:title", content: "Guide console — Fish-X" },
      {
        property: "og:description",
        content: "Run your guide service: trips, availability, guests, payouts and listings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuideSectionPage,
});

function GuideSectionPage() {
  const { section } = Route.useParams();
  const { biz, setting } = Route.useSearch();
  const { data: boot } = useSuspenseQuery(bootstrapQO);

  const memberships: any[] = Array.isArray(boot?.businesses) ? boot.businesses : [];
  const owned = memberships.map((m) => m?.business).filter(Boolean);
  const business =
    owned.find((b: any) => b.id === biz) ??
    owned.find((b: any) => b.category_key === "guide_service") ??
    owned[0];

  const profile = boot?.profile ?? null;
  const operatorName = profile?.display_name || profile?.full_name || "Operator";

  if (!business) {
    return (
      <div style={{ background: "#0D161F", minHeight: "100vh", padding: "48px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", color: "#E8F2F6" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>No guide workspace yet</h1>
          <p style={{ color: "#8AA2B0", fontSize: 14, margin: "10px 0 18px" }}>
            Finish setting up your guide service to manage trips and bookings.
          </p>
          <Link to="/onboarding" style={{ color: "#2DE2F2", fontWeight: 700 }}>
            Set up my guide service
          </Link>
        </div>
      </div>
    );
  }

  const tab = (GUIDE_SECTIONS as readonly string[]).includes(section) ? section : "overview";

  return (
    <Suspense fallback={<div style={{ background: "#0D161F", minHeight: "100vh" }} />}>
      <GuideDashboard
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
