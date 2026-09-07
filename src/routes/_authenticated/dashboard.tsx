import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { getMyRoles, hasPrimaryRole, getMyProfile, getMyBootstrap, roleCategoryKey, isOperatorRole } from "@/lib/auth.functions";
import { getMyBusinesses } from "@/lib/my-businesses.functions";
import { DashboardFrame } from "@/components/DashboardFrame";
// Each persona dashboard is a large surface; loading only the one the signed-in
// user actually needs keeps the initial dashboard bundle small and fast.
const AnglerDashboard = lazy(() =>
  import("@/components/angler/AnglerDashboard").then((m) => ({ default: m.AnglerDashboard })),
);
const CaptainDashboard = lazy(() =>
  import("@/components/captain/CaptainDashboard").then((m) => ({ default: m.CaptainDashboard })),
);
const MarinaDashboard = lazy(() =>
  import("@/components/marina/MarinaDashboard").then((m) => ({ default: m.MarinaDashboard })),
);
const ShopDashboard = lazy(() =>
  import("@/components/tackle/ShopDashboard").then((m) => ({ default: m.ShopDashboard })),
);
const GuideDashboard = lazy(() =>
  import("@/components/guide/GuideDashboard").then((m) => ({ default: m.GuideDashboard })),
);
import {
  getAnglerDashboard,
  listRecommendedCharters,
} from "@/lib/angler-dashboard.functions";
import { getCaptainDashboard } from "@/lib/captain-dashboard.functions";
import { getMarinaOverview } from "@/lib/marina.functions";
import { getShopOverview } from "@/lib/tackle.functions";
import { getGuideOverview } from "@/lib/guide.functions";

const bootstrapQO = queryOptions({
  queryKey: ["my-bootstrap"],
  queryFn: () => getMyBootstrap(),
  staleTime: 5 * 60_000,
});

const myRolesQO = queryOptions({
  queryKey: ["my-roles"],
  queryFn: () => getMyRoles(),
  staleTime: 5 * 60_000,
});

const myBusinessesQO = queryOptions({
  queryKey: ["my-businesses"],
  queryFn: () => getMyBusinesses(),
  staleTime: 5 * 60_000,
});

const myProfileQO = queryOptions({
  queryKey: ["my-profile"],
  queryFn: () => getMyProfile(),
  staleTime: 5 * 60_000,
});


/**
 * Pick the workspace that matches the signed-in operator.
 * Captains always land on their charter business, never on another
 * vertical (tackle shop, marina…) they happen to be a member of.
 */
function pickPrimaryBusiness(
  businesses: any[],
  primaryRole: string | null,
): any | undefined {
  const owned = businesses.filter((m) => m?.business);
  // The role chosen at signup decides the workspace, so an account that also
  // belongs to another vertical never gets swapped into it.
  const wantedCategory = roleCategoryKey(primaryRole);
  if (wantedCategory) {
    const match = owned.find(
      (m) => (m.business.category_key ?? "charter") === wantedCategory,
    );
    if (match) return match.business;
  }
  const asOwner = owned.find((m) => m.role === "owner");
  return (asOwner ?? owned[0])?.business;
}


export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; as?: string } => ({
    ...(typeof search.tab === "string" ? { tab: search.tab } : {}),
    ...(search.as === "angler" ? { as: "angler" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Dashboard — FISH-X.COM Bookings & Marketplace" }] }),
  loader: async ({ context }) => {
    try {
      // One request returns roles, businesses and profile together, then the
      // persona data is warmed in the background so the shell paints straight
      // away instead of waiting on a chain of server round trips.
      const boot = await context.queryClient.ensureQueryData(bootstrapQO);
      const roles = Array.isArray(boot?.roles) ? boot.roles : [];
      const businesses = Array.isArray(boot?.businesses) ? boot.businesses : [];
      context.queryClient.setQueryData(myRolesQO.queryKey, roles);
      context.queryClient.setQueryData(myBusinessesQO.queryKey, businesses);
      context.queryClient.setQueryData(myProfileQO.queryKey, boot?.profile ?? null);
      const primary = hasPrimaryRole(roles);


      if (businesses.length === 0) {
        void context.queryClient.prefetchQuery({
          queryKey: ["angler-dashboard"],
          queryFn: () => getAnglerDashboard(),
          staleTime: 60_000,
        });
        void context.queryClient.prefetchQuery({
          queryKey: ["angler-recos"],
          queryFn: () => listRecommendedCharters(),
          staleTime: 5 * 60_000,
        });
        void import("@/components/angler/AnglerDashboard");
        return;
      }

      const biz = pickPrimaryBusiness(businesses, primary) as { id: string; category_key: string } | undefined;
      const key = biz?.category_key ?? roleCategoryKey(primary);
      if (!biz || !key || key === "charter") {
        void import("@/components/captain/CaptainDashboard");
        void context.queryClient.prefetchQuery({
          queryKey: ["captain-dashboard"],
          queryFn: () => getCaptainDashboard(),
          staleTime: 60_000,
        });
      } else if (key === "marina" || key === "lodge") {
        void import("@/components/marina/MarinaDashboard");
        void context.queryClient.prefetchQuery({
          queryKey: ["marina-overview", biz.id],
          queryFn: () => getMarinaOverview({ data: { businessId: biz.id } }),
          staleTime: 60_000,
        });
      } else if (
        key === "tackle_shop" ||
        key === "bait_shop" ||
        key === "gear_mfg" ||
        key === "apparel"
      ) {
        void import("@/components/tackle/ShopDashboard");
        void context.queryClient.prefetchQuery({
          queryKey: ["shop-overview", biz.id],
          queryFn: () => getShopOverview({ data: { businessId: biz.id } }),
          staleTime: 60_000,
        });
      } else if (key === "guide_service") {
        void import("@/components/guide/GuideDashboard");
        void context.queryClient.prefetchQuery({
          queryKey: ["guide-overview", biz.id],
          queryFn: () => getGuideOverview({ data: { businessId: biz.id } }),
          staleTime: 60_000,
        });
      }
    } catch (e) {
      // Surface real failure reasons instead of crashing on raw Response
      // objects thrown by server functions (they have no .message).
      if (e instanceof Response) {
        const body = await e.text().catch(() => "");
        throw new Error(
          `Dashboard data failed to load (${e.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }
      throw e;
    }
  },

  component: Dashboard,
  errorComponent: ({ error }) => {
    const e = error as unknown;
    const message =
      e instanceof Error
        ? e.message
        : e instanceof Response
          ? `Request failed (${e.status})`
          : "Something went wrong loading your dashboard. Please try again.";
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Dashboard error</h1>
        <p>{message}</p>
      </div>
    );
  },
});

// (categoryTemplate removed — verticals now use React components below.)

function Dashboard() {
  const { data: boot } = useSuspenseQuery(bootstrapQO);
  const roles = Array.isArray(boot?.roles) ? boot.roles : [];
  const businesses = Array.isArray(boot?.businesses) ? boot.businesses : [];
  const profile = boot?.profile ?? null;
  const primaryRole = hasPrimaryRole(roles);
  const { as } = Route.useSearch();
  // Nobody is ever auto-pushed into operator setup. Setting up a business is
  // an explicit action from the dashboard, so anglers land straight on their
  // own dashboard.
  const anglerMode = as === "angler" || roles.includes("angler");

  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, fontFamily: "Outfit, system-ui", opacity: 0.6 }}>
          Loading your dashboard…
        </div>
      }
    >
      {renderDashboard()}
    </Suspense>
  );

  function renderDashboard() {
    if (anglerMode && businesses.length === 0) return <AnglerDashboard />;
    if (primaryRole === "angler" && businesses.length === 0) return <AnglerDashboard />;
    if (businesses.length === 0) return <AnglerDashboard />;

    {
      const biz = pickPrimaryBusiness(businesses, primaryRole) as
        | { id: string; name: string; category_key: string }
        | undefined;
      if (!biz) return <AnglerDashboard />;

      const operatorName =
        profile?.display_name || profile?.full_name || "Operator";
      const key = biz.category_key ?? roleCategoryKey(primaryRole);


      if (!key || key === "charter") return <CaptainDashboard />;
      if (key === "marina" || key === "lodge")
        return (
          <MarinaDashboard
            businessId={biz.id}
            workspaceName={biz.name}
            operatorName={operatorName}
          />
        );
      if (
        key === "tackle_shop" ||
        key === "bait_shop" ||
        key === "gear_mfg" ||
        key === "apparel"
      )
        return (
          <ShopDashboard
            businessId={biz.id}
            workspaceName={biz.name}
            operatorName={operatorName}
            categoryKey={key}
          />
        );
      if (key === "guide_service")
        return (
          <GuideDashboard
            businessId={biz.id}
            workspaceName={biz.name}
            operatorName={operatorName}
          />
        );
      return <DashboardFrame src="/dashboards/captain.html" title="Operator dashboard" />;
    }

    if (primaryRole === "angler") return <AnglerDashboard />;
    return <DashboardFrame src="/dashboards/angler.html" title="Dashboard" />;
  }

}

