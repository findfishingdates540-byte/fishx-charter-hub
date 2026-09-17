/**
 * Angler console panels: full booking history and money tracking.
 * Every number is derived from the angler's own bookings, refunds and orders.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAnglerLedger } from "@/lib/angler-console.functions";

export const anglerLedgerQO = queryOptions({
  queryKey: ["angler-ledger"],
  queryFn: () => getAnglerLedger(),
});

const money = (cents: number | null | undefined) =>
  `$${(Math.max(0, cents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 20,
  padding: 24,
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px,1.4fr) 1fr auto auto",
  gap: 12,
  alignItems: "center",
  padding: "13px 0",
  borderTop: "1px solid var(--line)",
  fontSize: 13.5,
};

const label = (s: string) => s.replace(/_/g, " ");

function Metric({ value, caption }: { value: string; caption: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 18 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--tmut)", marginTop: 6 }}>{caption}</div>
    </div>
  );
}

/* ---------------------------- Booking history ---------------------------- */

export function AnglerBookingHistory() {
  const { data } = useSuspenseQuery(anglerLedgerQO);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "cancelled">("all");

  const today = new Date().toISOString().slice(0, 10);
  const dead = ["cancelled_angler", "cancelled_captain", "declined", "expired"];

  const rows = useMemo(
    () =>
      data.bookings.filter((b: any) => {
        if (filter === "cancelled") return dead.includes(b.status);
        if (dead.includes(b.status)) return filter === "all";
        if (filter === "upcoming") return b.trip_date >= today;
        if (filter === "past") return b.trip_date < today;
        return true;
      }),
    [data.bookings, filter, today],
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <Metric value={String(data.totals.tripsBooked)} caption="Trips booked" />
        <Metric value={String(data.totals.tripsCompleted)} caption="Trips completed" />
        <Metric value={String(data.unreadMessages)} caption="Unread messages" />
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600 }}>Booking history</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "upcoming", "past", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  border: "1px solid var(--line)",
                  background: filter === f ? "var(--navy)" : "transparent",
                  color: filter === f ? "#fff" : "var(--tmut)",
                  borderRadius: 999,
                  padding: "6px 13px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "22px 0", color: "var(--tmut)", fontSize: 13.5 }}>
            Nothing here yet.{" "}
            <Link to="/marketplace" style={{ color: "var(--goldtext)", fontWeight: 600 }}>
              Find a trip →
            </Link>
          </div>
        ) : (
          rows.map((b: any) => (
            <Link key={b.id} to="/trips/detail" search={{ id: b.id }} style={{ ...row, textDecoration: "none", color: "inherit" }}>
              <span>
                <strong style={{ display: "block" }}>{b.service?.title ?? "Booking"}</strong>
                <small style={{ color: "var(--tmut)" }}>
                  {[b.business?.name, b.business?.city].filter(Boolean).join(" · ")}
                </small>
              </span>
              <span style={{ color: "var(--tmut)" }}>
                {b.trip_date} · {b.party_size ?? 1} angler(s)
              </span>
              <span style={{ color: "var(--cyan)", fontWeight: 600, textTransform: "capitalize" }}>
                {label(b.status)}
              </span>
              <strong>{money(b.total_cents)}</strong>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Payments -------------------------------- */

export function AnglerPayments() {
  const { data } = useSuspenseQuery(anglerLedgerQO);
  const { totals, refunds, orders } = data;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <Metric value={money(totals.escrowCents)} caption="Held in escrow" />
        <Metric value={money(totals.paidCents)} caption="Deposits paid" />
        <Metric value={money(totals.balanceDueCents)} caption="Balance due on the day" />
        <Metric value={money(totals.refundedCents)} caption="Refunded to you" />
      </div>

      <div style={card}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, marginBottom: 4 }}>
          Payment tracking
        </div>
        <div style={{ fontSize: 13, color: "var(--tmut)", marginBottom: 10 }}>
          Your money stays in escrow until each trip is finished, then it is released to the operator
          ({money(totals.releasedCents)} released so far).
        </div>
        {data.bookings.length === 0 ? (
          <div style={{ padding: "18px 0", color: "var(--tmut)", fontSize: 13.5 }}>No payments yet.</div>
        ) : (
          data.bookings.map((b: any) => (
            <div key={b.id} style={row}>
              <span>
                <strong style={{ display: "block" }}>{b.service?.title ?? "Booking"}</strong>
                <small style={{ color: "var(--tmut)" }}>{b.trip_date}</small>
              </span>
              <span style={{ color: "var(--tmut)" }}>
                Deposit {money(b.deposit_cents)} · Balance {money(b.balance_due_cents)}
              </span>
              <span style={{ color: "var(--tmut)", textTransform: "capitalize" }}>
                {label(b.escrow_state ?? "not paid")}
              </span>
              <strong>{money(b.total_cents)}</strong>
            </div>
          ))
        )}
      </div>

      {refunds.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Refunds</div>
          {refunds.map((r: any) => (
            <div key={r.id} style={{ ...row, gridTemplateColumns: "1fr auto auto" }}>
              <span style={{ color: "var(--tmut)" }}>
                {new Date(r.created_at).toLocaleDateString()}
              </span>
              <span style={{ color: "var(--tmut)", textTransform: "capitalize" }}>{label(r.status)}</span>
              <strong>{money(r.amount_cents)}</strong>
            </div>
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Gear orders</div>
          {orders.map((o: any) => (
            <div key={o.id} style={{ ...row, gridTemplateColumns: "1fr auto auto" }}>
              <span>
                <strong>{o.business?.name ?? "Shop"}</strong>
                <small style={{ display: "block", color: "var(--tmut)" }}>
                  {new Date(o.created_at).toLocaleDateString()}
                </small>
              </span>
              <span style={{ color: "var(--tmut)", textTransform: "capitalize" }}>{label(o.status)}</span>
              <strong>{money(o.total_cents)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
