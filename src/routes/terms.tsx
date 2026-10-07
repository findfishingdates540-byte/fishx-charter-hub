import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Fish-X" },
      { name: "description", content: "The terms for booking trips and buying gear on Fish-X." },
      { property: "og:title", content: "Terms of Service — Fish-X" },
      { property: "og:description", content: "The terms for booking trips and buying gear on Fish-X." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of Service">
      <h2>Using Fish-X</h2>
      <p>Fish-X connects anglers with independent charter captains, guides, marinas and shops. Each operator is responsible for the trips, services and products they list.</p>
      <h2>Bookings and payments</h2>
      <p>Payments are processed securely by Stripe and held until the trip or order is completed. Cancellation and refund rules shown on each listing apply.</p>
      <h2>Your account</h2>
      <p>Keep your sign-in details private. You can delete your account at any time from My Account.</p>
      <h2>Contact</h2>
      <p>Questions: hello@bookfishingtrips.com</p>
    </LegalPage>
  ),
});
