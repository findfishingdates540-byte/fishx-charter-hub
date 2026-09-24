import { createFileRoute, redirect } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { getMyBootstrap } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.section === "string" ? { section: search.section } : {}),
    ...(typeof search.biz === "string" ? { biz: search.biz } : {}),
    ...(typeof search.setting === "string" ? { setting: search.setting } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Settings — FISH-X.COM Bookings & Marketplace" },
      {
        name: "description",
        content:
          "Manage your Fish-X account: personal details, password and security, plus settings for every business you operate.",
      },
      { property: "og:title", content: "Settings — FISH-X.COM Bookings & Marketplace" },
      {
        property: "og:description",
        content: "Personal details, security and business settings in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const bootstrap = await context.queryClient.ensureQueryData({
      queryKey: ["my-bootstrap"],
      queryFn: () => getMyBootstrap(),
      staleTime: 5 * 60_000,
    });
    const memberships = Array.isArray(bootstrap?.businesses) ? bootstrap.businesses : [];
    const business = memberships.map((membership: any) => membership?.business).find(Boolean);
    if (business) {
      throw redirect({ to: "/dashboard", search: { tab: "settings", biz: business.id } });
    }
    return bootstrap;
  },
  component: SettingsRoute,
  errorComponent: ({ error }) => (
    <div style={{ padding: 40, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <h1>Couldn't load settings</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  ),
});

function SettingsRoute() {
  const search = Route.useSearch();
  return <SettingsPage search={search} />;
}
