/**
 * Operator readiness gate: shows what still blocks this business from taking
 * real, payable bookings (Stripe Connect, published listing, availability),
 * and lets the operator flip the storefront live once everything is green.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOperatorReadiness,
  setStorefrontLive,
} from "@/lib/operator-readiness.functions";

const INK = "#F0F2F5";
const MUT = "#92A0AB";
const LINE = "rgba(255,255,255,.10)";

export function useReadiness(businessId?: string) {
  const fn = useServerFn(getOperatorReadiness);
  return useQuery({
    queryKey: ["operator-readiness", businessId ?? "me"],
    queryFn: () => fn({ data: businessId ? { businessId } : {} }),
    refetchOnWindowFocus: true,
  });
}

export function ReadinessGate({
  businessId,
  onNav,
  compact = false,
}: {
  businessId?: string;
  onNav?: (navKey: string) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const q = useReadiness(businessId);
  const goLiveFn = useServerFn(setStorefrontLive);

  const goLive = useMutation({
    mutationFn: (live: boolean) =>
      goLiveFn({ data: { ...(businessId ? { businessId } : {}), live } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-readiness"] }),
  });

  if (q.isLoading || !q.data) return null;
  const r = q.data;
  const grace = Boolean((r as any).grace);

  if (compact && r.ready && r.isPublished) return null;

  const tone = r.ready ? "#22C55E" : grace ? "#F5A524" : "#2DE2F2";


  return (
    <div
      style={{
        background: "#14202B",
        border: `1px solid ${r.ready ? "rgba(31,138,91,.28)" : "rgba(169,126,60,.32)"}`,
        borderRadius: 18,
        padding: 20,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: tone,
            }}
          >
            {r.ready ? "Ready to take bookings" : grace ? "Action needed to stay listed" : "Not bookable yet"}
          </div>
          <div
            style={{
              fontFamily: "'Outfit', Georgia, serif",
              fontSize: 21,
              fontWeight: 600,
              color: INK,
              marginTop: 3,
            }}
          >
            {r.ready
              ? r.isPublished
                ? "Your storefront is live."
                : "Everything checks out — go live when you're ready."
              : `${r.blockerCount} step${r.blockerCount === 1 ? "" : "s"} left before guests can book you`}
          </div>
          {!r.ready && (
            <div style={{ fontSize: 12.5, color: MUT, marginTop: 6, maxWidth: 560 }}>
              {grace
                ? "Your page is still showing to anglers for now, but it will be hidden from search and Explore until these steps are done — so nobody books a trip you can't get paid for."
                : "Your page stays private to anglers until these steps are done, so nobody books a trip you can't get paid for."}
            </div>
          )}
        </div>


        {r.ready && (
          <button
            onClick={() => goLive.mutate(!r.isPublished)}
            disabled={goLive.isPending}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "11px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: r.isPublished ? "#1C2936" : INK,
              color: r.isPublished ? MUT : "#F0F2F5",
            }}
          >
            {goLive.isPending
              ? "Saving…"
              : r.isPublished
                ? "Pause storefront"
                : "Go live"}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {r.items.map((it) => (
          <div
            key={it.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              padding: "11px 14px",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                flex: "none",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#F0F2F5",
                background: it.done ? "#22C55E" : it.blocking ? "#2DE2F2" : "#3A4A57",
              }}
            >
              {it.done ? "✓" : "!"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>
                {it.label}
                {!it.blocking && !it.done && (
                  <span style={{ color: MUT, fontWeight: 500 }}> · optional</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: MUT, marginTop: 1 }}>{it.detail}</div>
            </div>
            {!it.done && onNav && (
              <button
                onClick={() => onNav(it.navKey)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#2DE2F2",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  flex: "none",
                }}
              >
                Fix →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
