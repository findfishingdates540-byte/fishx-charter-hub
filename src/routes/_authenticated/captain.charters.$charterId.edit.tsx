import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCaptainCharters, upsertCaptainCharter } from "@/lib/captain-charters.functions";
import { listCaptainBoats } from "@/lib/captain-fleet.functions";
import { getCaptainDashboard } from "@/lib/captain-dashboard.functions";
import { CaptainPageShell } from "@/components/captain/CaptainPageShell";
import { CharterForm, type CharterDraft } from "@/components/captain/ChartersPanel";

export const Route = createFileRoute("/_authenticated/captain/charters/$charterId/edit")({
  head: () => ({
    meta: [
      { title: "Edit charter trip — Fish-X Charters" },
      { name: "description", content: "Update your charter trip details, photos, boat and pricing." },
      { property: "og:title", content: "Edit charter trip — Fish-X Charters" },
      { property: "og:description", content: "Update your charter trip details, photos, boat and pricing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditCharterPage,
});

function EditCharterPage() {
  const { charterId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listCharters = useServerFn(listCaptainCharters);
  const listBoats = useServerFn(listCaptainBoats);
  const dashboard = useServerFn(getCaptainDashboard);

  const { data: charters, isLoading } = useQuery({
    queryKey: ["captain-charters"],
    queryFn: () => listCharters(),
  });
  const { data: boatsData } = useQuery({ queryKey: ["captain-boats"], queryFn: () => listBoats() });
  const { data: dash } = useQuery({ queryKey: ["captain-dashboard"], queryFn: () => dashboard() });

  const charter: any = (charters ?? []).find((c: any) => c.id === charterId);
  const [draft, setDraft] = useState<CharterDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (charter && !draft) {
      setDraft({
        id: charter.id,
        name: charter.name,
        description: charter.description ?? "",
        slug: charter.slug ?? "",
        hero_url: charter.hero_url ?? "",
        image_urls: charter.image_urls ?? [],
        boat_id: charter.boat_id ?? "",
        water_type: charter.water_type ?? "",
        target_species: Array.isArray(charter.target_species) ? charter.target_species.join(", ") : "",
        base_price_cents: charter.base_price_cents,
        capacity: charter.capacity,
        duration_minutes: charter.duration_minutes ?? null,
        departure_location: "",
        is_published: charter.is_published,
      });
    }
  }, [charter, draft]);

  if (isLoading || (!charter && !draft)) {
    return (
      <CaptainPageShell title="Edit charter trip">
        <div style={{ color: "var(--tmut)", fontSize: 13 }}>
          {isLoading ? "Loading charter…" : "We couldn't find that charter trip."}
        </div>
      </CaptainPageShell>
    );
  }

  if (!draft) return null;

  return (
    <CaptainPageShell title="Edit charter trip" subtitle={draft.name}>
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
            await upsertCaptainCharter({
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
