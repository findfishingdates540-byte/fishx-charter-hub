import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { marinaOverviewQO, ReservationForm } from "@/components/marina/MarinaDashboard";
import { upsertReservation } from "@/lib/marina.functions";

export const Route = createFileRoute("/_authenticated/marina/reservations/$reservationId")({
  validateSearch: (search: Record<string, unknown>) => ({
    biz: typeof search.biz === "string" ? search.biz : "",
  }),
  head: () => ({
    meta: [
      { title: "Reservation details — Fish-X marina" },
      { name: "description", content: "Review and update a single vessel reservation." },
      { property: "og:title", content: "Reservation details — Fish-X marina" },
      { property: "og:description", content: "Review and update a single vessel reservation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationDetailPage,
});

function ReservationDetailPage() {
  const { reservationId } = Route.useParams();
  const { biz } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(marinaOverviewQO(biz));
  const upsertFn = useServerFn(upsertReservation);

  const back = () => navigate({ to: "/dashboard", search: { tab: "reservations", biz } });

  const upsertM = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marina-overview", biz] });
      back();
    },
  });

  const reservation = (data.reservations as any[]).find((r) => r.id === reservationId);

  return (
    <div style={{ background: "#0D161F", minHeight: "100vh", padding: "28px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
        <Link
          to="/dashboard"
          search={{ tab: "reservations", biz }}
          style={{ color: "#2DE2F2", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
        >
          ← Back to reservations
        </Link>
        {!reservation ? (
          <p style={{ color: "#8AA2B0" }}>That reservation is no longer available.</p>
        ) : (
          <ReservationForm
            slips={data.slips as any[]}
            initial={reservation}
            saving={upsertM.isPending}
            onCancel={back}
            onSave={(v) =>
              upsertM.mutate({ data: { ...v, businessId: biz, id: reservation.id } })
            }
          />
        )}
      </div>
    </div>
  );
}
