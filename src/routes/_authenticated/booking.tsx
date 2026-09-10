import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BookingFlow, checkoutQuery } from "@/components/booking/BookingFlow";

const search = z.object({
  service_id: z.string().uuid(),
  /** The listing the angler originally opened — keeps page identity stable
   *  when they switch between trip packages of the same operator. */
  base: z.string().uuid().optional(),
  /** Departure + party carried over from a storefront booking form. */
  slot: z.string().uuid().optional(),
  party: z.coerce.number().int().min(1).max(60).optional(),
  /** Storefront handoff opens directly on the dedicated availability step. */
  start: z.string().optional(),
  /** Safe route parameter used by the booking flow's back link. */
  storefront: z.string().optional(),
  paid: z.string().optional(),
  canceled: z.string().optional(),
  booking_id: z.string().optional(),
});



export const Route = createFileRoute("/_authenticated/booking")({
  head: () => ({
    meta: [
      { title: "Book your trip — FISH-X.COM Bookings & Marketplace" },
      { name: "description", content: "Secure your fishing charter with Fish-X — every booking escrow-protected." },
      { property: "og:title", content: "Book your trip — FISH-X.COM Bookings & Marketplace" },
      { property: "og:description", content: "Escrow-protected charter booking on Fish-X." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: search,
  loaderDeps: ({ search }) => ({ serviceId: search.service_id }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(checkoutQuery(deps.serviceId)),
  errorComponent: BookingError,
  component: RouteComponent,
});

function BookingError({ error }: { error: Error }) {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 460 }}>
        <h1 style={{ fontFamily: "'Outfit',Georgia,serif", fontSize: 32, margin: "0 0 10px" }}>
          We couldn’t load this trip
        </h1>
        <p style={{ color: "#5c6b78", fontSize: 14, margin: "0 0 18px" }}>
          {error?.message || "Something went wrong. Nothing was charged."}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "#2DE2F2", border: 0, borderRadius: 10, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function RouteComponent() {
  const { service_id, base, slot, party, start, storefront } = Route.useSearch();
  return (
    <BookingFlow
      serviceId={service_id}
      baseId={base ?? service_id}
      initialSlotId={slot}
      initialParty={party}
      initialStep={start === "dates" ? "dates" : undefined}
      storefrontSlug={storefront}
    />
  );
}


