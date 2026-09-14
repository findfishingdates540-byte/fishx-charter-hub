/**
 * Outbox dispatcher — invoked every minute by pg_cron.
 *
 * Pops a batch of pending domain_events, hands them to registered consumers,
 * and marks each row dispatched / failed. Consumers are HTTP webhooks defined
 * via the `DOMAIN_EVENT_WEBHOOK_URL` env var (optional). When no consumer is
 * configured the pipeline still drains events (marks them dispatched) so the
 * outbox does not grow unbounded during development.
 */
import { createFileRoute } from "@tanstack/react-router";
import { assertCronCaller } from "@/lib/cron-auth.server";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 8;

export const Route = createFileRoute("/api/public/hooks/dispatch-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronCaller(request);
        if (denied) return denied;

        try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: pending, error: fetchErr } = await supabaseAdmin
          .from("domain_events")
          .select("id, topic, aggregate_type, aggregate_id, payload, attempts")
          .eq("status", "pending")
          .lte("available_at", new Date().toISOString())
          .order("created_at", { ascending: true })
          .limit(BATCH_SIZE);

        if (fetchErr) {
          return Response.json({ ok: false, error: fetchErr.message }, { status: 500 });
        }

        const events = pending ?? [];
        if (events.length === 0) {
          return Response.json({ ok: true, dispatched: 0, failed: 0 });
        }

        const webhookUrl = process.env.DOMAIN_EVENT_WEBHOOK_URL;
        let dispatched = 0;
        let failed = 0;

        const { handleDomainEvent } = await import("@/lib/notifications.server");

        for (const evt of events) {
          try {
            // Consumer 1 — notifications (in-app + email). Never inline in the
            // booking service, so a failing email can't fail a booking.
            await handleDomainEvent(supabaseAdmin as never, {
              id: evt.id,
              topic: evt.topic,
              aggregate_type: evt.aggregate_type,
              aggregate_id: evt.aggregate_id,
              payload: (evt.payload ?? {}) as Record<string, unknown>,
            });

            // Consumer 2 — optional external webhook.
            if (webhookUrl) {
              const res = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-domain-event-id": evt.id,
                  "x-domain-event-topic": evt.topic,
                },
                body: JSON.stringify({
                  id: evt.id,
                  topic: evt.topic,
                  aggregate_type: evt.aggregate_type,
                  aggregate_id: evt.aggregate_id,
                  payload: evt.payload,
                }),
              });
              if (!res.ok) throw new Error(`Consumer ${res.status}: ${await res.text()}`);
            }


            await supabaseAdmin
              .from("domain_events")
              .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
              .eq("id", evt.id);
            dispatched += 1;
          } catch (e) {
            const attempts = (evt.attempts ?? 0) + 1;
            const message = e instanceof Error ? e.message : String(e);
            const nextStatus = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
            const backoffMs = Math.min(60_000 * 2 ** attempts, 60 * 60_000);
            await supabaseAdmin
              .from("domain_events")
              .update({
                status: nextStatus,
                attempts,
                last_error: message,
                available_at: new Date(Date.now() + backoffMs).toISOString(),
              })
              .eq("id", evt.id);
            failed += 1;
          }
        }

        return Response.json({ ok: true, dispatched, failed });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[dispatch-events] failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }

      },
    },
  },
});
