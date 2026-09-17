import { createFileRoute } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — FISH-X.COM Bookings & Marketplace" },
      {
        name: "description",
        content:
          "Every Fish-X booking, payment, payout and message alert in one place, with email preferences.",
      },
      { property: "og:title", content: "Notifications — FISH-X.COM" },
      {
        property: "og:description",
        content: "Your Fish-X notification center: bookings, payments, payouts and messages.",
      },
    ],
  }),
  component: NotificationCenter,
  errorComponent: ({ error }) => (
    <div style={{ padding: 40, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <h1>Couldn't load your notifications</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  ),
  notFoundComponent: () => <div style={{ padding: 40 }}>Not found.</div>,
});
