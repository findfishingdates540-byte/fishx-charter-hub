import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCaptainCharters, upsertCaptainCharter } from "@/lib/captain-charters.functions";
import { upsertCaptainService } from "@/lib/captain-management.functions";
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
      <CaptainPageShell
        title="Edit charter trip"
        backLabel="← Back to charter trips"
        backSearch={{ tab: "services" }}
      >
        <div style={{ color: "var(--tmut)", fontSize: 13 }}>
          {isLoading ? "Loading charter…" : "We couldn't find that charter trip."}
        </div>
      </CaptainPageShell>
    );
  }

  if (!draft) return null;

  const backToCharters = () =>
    navigate({ to: "/dashboard", search: { tab: "services" } });

  const saveCharter = async () => {
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
  };

  // Adding a package must never silently discard the charter edits on screen:
  // save them first, then create the package and open its own editor.
  const addPackage = async () => {
    setError(null);
    try {
      await saveCharter();
      const pkg: any = await upsertCaptainService({
        data: {
          title: "New package",
          charter_id: charterId,
          base_price_cents: draft.base_price_cents,
          capacity: draft.capacity,
          duration_minutes: draft.duration_minutes ?? 240,
          water_type: draft.water_type || null,
          boat_id: draft.boat_id || null,
          is_published: false,
        },
      });
      await qc.invalidateQueries({ queryKey: ["captain-charters"] });
      if (pkg?.id) {
        navigate({ to: "/captain/packages/$packageId", params: { packageId: pkg.id } });
      }
    } catch (err: any) {
      setError(err?.message || "We couldn't add a package. Please try again.");
    }
  };

  return (
    <CaptainPageShell
      title="Edit charter trip"
      subtitle={draft.name}
      backLabel="← Back to charter trips"
      backSearch={{ tab: "services" }}
    >
      <CharterForm
        businessId={dash?.business?.id ?? null}
        draft={draft}
        boats={(boatsData?.rows ?? []) as any}
        error={error}
        onChange={setDraft}
        onCancel={backToCharters}
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
            backToCharters();
          } catch (err: any) {
            setError(err?.message || "We couldn't save that charter. Check the details and try again.");
          }
        }}
      />

      <section
        style={{
          marginTop: 24,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "16px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 16 }}>
            Packages ({charter?.packages?.length ?? 0})
          </div>
          <button
            onClick={addPackage}
            style={{
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--cyan)",
              borderRadius: 10,
              padding: "7px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add package
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--tmut)", marginTop: 4 }}>
          The bookable time/duration options anglers see for this trip.
        </div>

        {(charter?.packages ?? []).length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--tmut)", marginTop: 12 }}>
            No packages yet. Add a time/duration variant from the Charter trips tab.
          </div>
        )}

        <div style={{ display: "grid", marginTop: 8 }}>
          {(charter?.packages ?? []).map((p: any) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 0",
                borderTop: "1px solid rgba(255,255,255,.06)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--tmut)" }}>
                  ${(p.base_price_cents / 100).toFixed(2)}
                  {p.duration_minutes ? ` · ${Math.round(p.duration_minutes / 60)}h` : ""}
                  {p.capacity ? ` · up to ${p.capacity}` : ""}
                  {!p.is_published ? " · Draft" : ""}
                </div>
              </div>
              <button
                onClick={() =>
                  navigate({ to: "/captain/packages/$packageId", params: { packageId: p.id } })
                }
                style={{
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--ink)",
                  borderRadius: 10,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Edit package
              </button>
            </div>
          ))}
        </div>
      </section>
    </CaptainPageShell>
  );
}
