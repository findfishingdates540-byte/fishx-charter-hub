import { createFileRoute, redirect } from "@tanstack/react-router";
import { AnglerAccount } from "@/components/profile/AnglerAccount";
import { getMyProfile } from "@/lib/angler-profile.functions";
import { getMyBootstrap } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/account")({
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
    return context.queryClient.ensureQueryData({
      queryKey: ["my-profile"],
      queryFn: () => getMyProfile(),
    });
  },
  head: () => ({
    meta: [
      { title: "Account — FISH-X.COM Bookings & Marketplace" },
      {
        name: "description",
        content: "Manage your Fish-X angler account — your name, contact details and avatar.",
      },
      { property: "og:title", content: "Account — FISH-X.COM Bookings & Marketplace" },
      { property: "og:description", content: "Manage your Fish-X angler account details." },
    ],
  }),
  component: AccountPage,
  errorComponent: ({ error }) => (
    <div style={{ padding: 40, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <h1>Couldn't load your account</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  ),
  notFoundComponent: () => <div style={{ padding: 40 }}>Account not found.</div>,
});

function AccountPage() {
  return <AnglerAccount />;
}
