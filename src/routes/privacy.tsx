import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Fish-X" },
      { name: "description", content: "How Fish-X collects, uses and protects your information." },
      { property: "og:title", content: "Privacy Policy — Fish-X" },
      { property: "og:description", content: "How Fish-X collects, uses and protects your information." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Privacy Policy">
      <h2>What we collect</h2>
      <p>Your name, email, profile photo, bookings, orders and messages, so we can run your account and your trips.</p>
      <h2>Who we share it with</h2>
      <p>The operator you book or buy from, Stripe for payments, and our email provider for receipts. We never sell your data.</p>
      <h2>Your choices</h2>
      <p>You can edit your details or permanently delete your account from My Account.</p>
      <h2>Contact</h2>
      <p>hello@bookfishingtrips.com</p>
    </LegalPage>
  ),
});
