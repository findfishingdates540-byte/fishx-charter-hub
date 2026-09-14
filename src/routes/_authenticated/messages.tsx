import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Messages } from "@/components/messages/Messages";
import { BusinessInbox } from "@/components/messages/BusinessInbox";
import { startBusinessConversation } from "@/lib/business-messages.functions";
import { getThread, listMessageThreads } from "@/lib/messages.functions";

const searchSchema = z.object({
  booking: z.string().uuid().optional(),
  business: z.string().uuid().optional(),
  tab: z.enum(["trips", "shops"]).optional(),
});

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ booking: search.booking }),
  loader: async ({ context, deps }) => {
    // Threads and the open conversation load side by side instead of one
    // after the other.
    const threads = context.queryClient.ensureQueryData({
      queryKey: ["message-threads"],
      queryFn: () => listMessageThreads(),
    });
    if (deps.booking) {
      void context.queryClient.prefetchQuery({
        queryKey: ["thread", deps.booking],
        queryFn: () => getThread({ data: { bookingId: deps.booking! } }),
      });
    }
    await threads;
  },
  head: () => ({
    meta: [
      { title: "Messages — FISH-X.COM Bookings & Marketplace" },
      {
        name: "description",
        content:
          "Message captains about each booking, and talk directly with tackle shops, marinas, guides and brands.",
      },
      { property: "og:title", content: "Messages — FISH-X.COM Bookings & Marketplace" },
      {
        property: "og:description",
        content: "Your conversations with captains, shops, marinas and guide services.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
  errorComponent: ({ error }) => (
    <div style={{ padding: 40, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <h1>Couldn't load Messages</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  ),
  notFoundComponent: () => <div style={{ padding: 40 }}>Conversation not found.</div>,
});

function MessagesPage() {
  const { booking, business, tab } = useSearch({ from: "/_authenticated/messages" });
  const active: "trips" | "shops" = tab ?? (business ? "shops" : "trips");

  const startFn = useServerFn(startBusinessConversation);
  const convo = useQuery({
    queryKey: ["start-business-convo", business],
    queryFn: () => startFn({ data: { businessId: business! } }),
    enabled: !!business,
  });

  return (
    <div
      style={{
        fontFamily: "'Outfit',system-ui,sans-serif",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* One header, always the same — never swaps between tabs or threads. */}
      <header style={{ flex: "none", background: "#072057", color: "#eaf1f6" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
          }}
        >
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            style={{ color: "#93a7b7", textDecoration: "none", fontSize: 18, lineHeight: 1 }}
          >
            ←
          </Link>
          <span
            style={{
              fontFamily: "'Outfit',Georgia,serif",
              fontSize: 21,
              fontWeight: 600,
            }}
          >
            Messages
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
          {(
            [
              { key: "trips", label: "Trips" },
              { key: "shops", label: "Shops & operators" },
            ] as const
          ).map((t) => (
            <Link
              key={t.key}
              to="/messages"
              search={{ tab: t.key }}
              style={{
                textDecoration: "none",
                borderRadius: 30,
                padding: "8px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,.14)",
                background: active === t.key ? "#2DE2F2" : "transparent",
                color: active === t.key ? "#04121B" : "#93a7b7",
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="fx-messages-main" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {active === "trips" ? (
          <Messages bookingId={booking ?? null} />
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, background: "#fff" }}>
            <BusinessInbox
              theme="light"
              fullHeight
              initialConversationId={(convo.data as any)?.conversationId ?? null}
            />
          </div>
        )}
      </main>
    </div>
  );
}
