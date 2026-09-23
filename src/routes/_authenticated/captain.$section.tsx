import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CaptainDashboard = lazy(() =>
  import("@/components/captain/CaptainDashboard").then((m) => ({ default: m.CaptainDashboard })),
);

export const CAPTAIN_SECTIONS = [
  "overview",
  "bookings",
  "calendar",
  "services",
  "blockouts",
  "fleet",
  "messages",
  "earnings",
  "settings",
] as const;

export const Route = createFileRoute("/_authenticated/captain/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.setting === "string" ? { setting: search.setting } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Captain console — Fish-X" },
      {
        name: "description",
        content: "Run your charter business: bookings, calendar, fleet, earnings and settings.",
      },
      { property: "og:title", content: "Captain console — Fish-X" },
      {
        property: "og:description",
        content: "Run your charter business: bookings, calendar, fleet, earnings and settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptainSectionPage,
});

function CaptainSectionPage() {
  const { section } = Route.useParams();
  const { setting } = Route.useSearch();
  const tab = (CAPTAIN_SECTIONS as readonly string[]).includes(section) ? section : "overview";
  return (
    <Suspense fallback={<div style={{ background: "#0D161F", minHeight: "100vh" }} />}>
      <CaptainDashboard initialTab={tab} initialSetting={setting} />
    </Suspense>
  );
}
