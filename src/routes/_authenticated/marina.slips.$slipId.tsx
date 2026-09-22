import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { marinaOverviewQO, SlipForm } from "@/components/marina/MarinaDashboard";
import { upsertSlip, deleteSlip } from "@/lib/marina.functions";

export const Route = createFileRoute("/_authenticated/marina/slips/$slipId")({
  validateSearch: (search: Record<string, unknown>) => ({
    biz: typeof search.biz === "string" ? search.biz : "",
  }),
  head: () => ({
    meta: [
      { title: "Slip details — Fish-X marina" },
      { name: "description", content: "Edit a single berth: size, power, rates and status." },
      { property: "og:title", content: "Slip details — Fish-X marina" },
      { property: "og:description", content: "Edit a single berth: size, power, rates and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SlipDetailPage,
});

function SlipDetailPage() {
  const { slipId } = Route.useParams();
  const { biz } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(marinaOverviewQO(biz));
  const upsertFn = useServerFn(upsertSlip);
  const deleteFn = useServerFn(deleteSlip);

  const back = () => navigate({ to: "/marina/$section", params: { section: "slips" }, search: { biz } });

  const upsertM = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marina-overview", biz] });
      back();
    },
  });
  const deleteM = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marina-overview", biz] });
      back();
    },
  });

  const slip = (data.slips as any[]).find((s) => s.id === slipId);

  return (
    <div style={{ background: "#0D161F", minHeight: "100vh", padding: "28px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
        <Link
          to="/marina/$section"
          params={{ section: "slips" }}
          search={{ biz }}
          style={{ color: "#2DE2F2", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
        >
          ← Back to slips
        </Link>
        {!slip ? (
          <p style={{ color: "#8AA2B0" }}>That slip is no longer available.</p>
        ) : (
          <SlipForm
            initial={slip}
            saving={upsertM.isPending || deleteM.isPending}
            onCancel={back}
            onSave={(v) => upsertM.mutate({ data: { ...v, businessId: biz, id: slip.id } })}
            onDelete={() => deleteM.mutate({ data: { id: slip.id, businessId: biz } })}
          />
        )}
      </div>
    </div>
  );
}
