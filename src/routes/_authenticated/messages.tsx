import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Messages } from "@/components/messages/Messages";
import { startBusinessConversation } from "@/lib/business-messages.functions";
import { getThread, listMessageThreads } from "@/lib/messages.functions";
import { useCompactMessages } from "@/hooks/use-compact-messages";
import { AuthenticatedHeader } from "@/components/auth/AuthenticatedHeader";

const searchSchema = z.object({
  booking: z.string().uuid().optional(),
  business: z.string().uuid().optional(),
  convo: z.string().uuid().optional(),
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
  const { booking, business, convo } = useSearch({ from: "/_authenticated/messages" });
  const compact = useCompactMessages();
  const navigate = useNavigate();

  // "Message this shop" links pass the business; open (or create) that DM in the shared inbox.
  const startFn = useServerFn(startBusinessConversation);
  const started = useQuery({
    queryKey: ["start-business-convo", business],
    queryFn: () => startFn({ data: { businessId: business! } }),
    enabled: !!business && !convo,
  });
  const startedId = (started.data as any)?.conversationId as string | undefined;
  useEffect(() => {
    if (startedId) navigate({ to: "/messages", search: { convo: startedId }, replace: true });
  }, [startedId, navigate]);

  const openConvo = convo ?? null;

  return (
    <div
      className="fx-messages-page"
      style={{
        fontFamily: "'Outfit',system-ui,sans-serif",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* The open thread owns the compact phone/tablet header. */}
      {!(compact && (booking || openConvo || business)) && <AuthenticatedHeader />}

      <main className="fx-messages-main" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {business && !convo ? (
          <div style={{ padding: 28, color: "#5b6b78", fontSize: 13 }}>
            {started.isError ? "Couldn't open this conversation. Please try again." : "Opening conversation…"}
          </div>
        ) : (
          <Messages bookingId={booking ?? null} conversationId={openConvo} />
        )}
      </main>
    </div>
  );
}
