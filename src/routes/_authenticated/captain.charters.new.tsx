import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertCaptainCharter } from "@/lib/captain-charters.functions";
import { upsertCaptainService } from "@/lib/captain-management.functions";
import { listCaptainBoats } from "@/lib/captain-fleet.functions";
import { getCaptainDashboard } from "@/lib/captain-dashboard.functions";
import { CaptainPageShell } from "@/components/captain/CaptainPageShell";
import { CharterForm, emptyCharterDraft, type CharterDraft } from "@/components/captain/ChartersPanel";

export const Route = createFileRoute("/_authenticated/captain/charters/new")({
  head: () => ({
    meta: [
      { title: "New charter trip — Fish-X Charters" },
      { name: "description", content: "Create a new bookable charter trip for anglers." },
      { property: "og:title", content: "New charter trip — Fish-X Charters" },
      { property: "og:description", content: "Create a new bookable charter trip for anglers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewCharterPage,
});

function NewCharterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listBoats = useServerFn(listCaptainBoats);
  const dashboard = useServerFn(getCaptainDashboard);
  const { data: boatsData } = useQuery({ queryKey: ["captain-boats"], queryFn: () => listBoats() });
  const { data: dash } = useQuery({ queryKey: ["captain-dashboard"], queryFn: () => dashboard() });

  const [draft, setDraft] = useState<CharterDraft>({ ...emptyCharterDraft });
  const [error, setError] = useState<string | null>(null);

  return (
    <CaptainPageShell title="New charter trip" subtitle="Create the trip anglers can book">
      <CharterForm
        businessId={dash?.business?.id ?? null}
        draft={draft}
        boats={(boatsData?.rows ?? []) as any}
        error={error}
        onChange={setDraft}
        onCancel={() => navigate({ to: "/dashboard" })}
        onSave={async () => {
          setError(null);
          try {
            const charter: any = await upsertCaptainCharter({
              data: {
                ...draft,
                target_species: draft.target_species
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                image_urls: draft.image_urls,
                slug: draft.slug || null,
              },
            });
            if (charter?.id) {
              await upsertCaptainService({
                data: {
                  title: "Half Day",
                  charter_id: charter.id,
                  base_price_cents: draft.base_price_cents,
                  capacity: draft.capacity,
                  duration_minutes: 240,
                  water_type: draft.water_type || null,
                  boat_id: draft.boat_id || null,
                  is_published: false,
                },
              });
            }
            await qc.invalidateQueries({ queryKey: ["captain-charters"] });
            qc.invalidateQueries({ queryKey: ["captain-dashboard"] });
            navigate({ to: "/dashboard" });
          } catch (err: any) {
            setError(err?.message || "We couldn't save that charter. Check the details and try again.");
          }
        }}
      />
    </CaptainPageShell>
  );
}
