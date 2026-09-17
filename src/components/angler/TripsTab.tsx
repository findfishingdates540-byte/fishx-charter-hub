/**
 * Angler → My Trips tab. Full-bleed cinematic layout ported from the Stitch
 * "My Trips" screen, re-skinned to the Fish-X palette (Deep Hull navy + Sandy
 * Gold) and wired to live Supabase bookings.
 */
import { useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listAnglerTrips } from "@/lib/angler-trips.functions";
import { DEFAULT_HERO } from "@/lib/platform-photos";

export const anglerTripsQO = queryOptions({
  queryKey: ["angler-trips"],
  queryFn: () => listAnglerTrips(),
});

type TripsData = Awaited<ReturnType<typeof listAnglerTrips>>;
type Trip = TripsData["upcoming"][number];
type Bucket = "upcoming" | "past" | "cancelled";

const FALLBACK = DEFAULT_HERO;

const money = (cents: number | null | undefined) =>
  `$${Math.round((cents ?? 0) / 100).toLocaleString()}`;

const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

const timeLabel = (t: string | null) =>
  t
    ? new Date(`1970-01-01T${t}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "Time TBC";

const daysLeft = (d: string) => {
  const diff = Math.ceil(
    (new Date(`${d}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (diff < 0) return null;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days left`;
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "AWAITING PAYMENT",
  pending_confirmation: "AWAITING CAPTAIN",
  confirmed: "CONFIRMED",
  in_progress: "UNDER WAY",
  completed: "COMPLETED",
  reviewed: "REVIEWED",
  cancelled_by_angler: "CANCELLED",
  cancelled_by_captain: "CANCELLED",
  declined: "DECLINED",
  refunded: "REFUNDED",
  expired: "EXPIRED",
};

const shell: React.CSSProperties = {
  width: "100%",
  minHeight: "calc(100vh - 66px)",
  background: "#ffffff",
  color: "#031029",
  padding: "clamp(24px,4vw,56px) clamp(16px,5vw,80px) clamp(56px,8vw,96px)",
};

const glass: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(13,34,54,.10)",
  backdropFilter: "blur(20px)",
  borderRadius: 18,
  overflow: "hidden",
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".18em",
  textTransform: "uppercase",
};

export function TripsTab() {
  const { data } = useSuspenseQuery(anglerTripsQO);
  const [bucket, setBucket] = useState<Bucket>("upcoming");
  const trips = data[bucket];

  return (
    <div style={shell}>
      <header style={{ marginBottom: 34 }}>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 600,
            fontSize: "clamp(38px,6vw,64px)",
            lineHeight: 1.05,
            letterSpacing: "-.02em",
            color: "#031029",
            margin: "0 0 22px",
          }}
        >
          My Trips
        </h1>
        <div
          style={{
            display: "flex",
            gap: 28,
            borderBottom: "1px solid rgba(13,34,54,.10)",
            paddingBottom: 2,
            overflowX: "auto",
          }}
        >
          {(["upcoming", "past", "cancelled"] as Bucket[]).map((b) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              style={{
                ...eyebrow,
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${bucket === b ? "#1F9FBE" : "transparent"}`,
                color: bucket === b ? "#1F9FBE" : "#5c6b78",
                padding: "0 0 14px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {b} · {data[b].length}
            </button>
          ))}
        </div>
      </header>

      {trips.length === 0 ? (
        <div style={{ ...glass, padding: "clamp(32px,6vw,64px)", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 26, color: "#031029", marginBottom: 8 }}>
            Nothing {bucket === "upcoming" ? "on the calendar" : `in ${bucket}`} yet
          </div>
          <p style={{ color: "#5c6b78", margin: "0 0 20px", fontSize: 15 }}>
            Charters you book will appear here with escrow status and captain contact.
          </p>
          <Link
            to="/dashboard"
            search={{ tab: "explore" }}
            style={{
              ...eyebrow,
              display: "inline-block",
              padding: "13px 26px",
              borderRadius: 10,
              background: "var(--sand)",
              color: "#072057",
              textDecoration: "none",
            }}
          >
            Explore charters
          </Link>
        </div>
      ) : (
        <section style={{ display: "grid", gap: 26 }}>
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} bucket={bucket} />
          ))}
        </section>
      )}

      <section
        style={{
          marginTop: 72,
          borderTop: "1px solid rgba(13,34,54,.10)",
          paddingTop: 44,
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        }}
      >
        <HelpCard
          title="Concierge support"
          body="Our crew is on hand to help with logistics, weather calls, and captain contact."
          link={{ to: "/messages", label: "Open messages" }}
        />
        <HelpCard
          title="Cancellation policy"
          body="Weather and schedule protection — see how refunds and escrow releases work."
          link={{ to: "/trust", label: "Read the policy" }}
        />
        <HelpCard
          title="Plan your next trip"
          body="Seasonal spots curated by top-rated captains across the fleet."
          link={{ to: "/dashboard", search: { tab: "explore" }, label: "Explore destinations" }}
        />
      </section>
    </div>
  );
}

function TripCard({ trip, bucket }: { trip: Trip; bucket: Bucket }) {
  const left = bucket === "upcoming" ? daysLeft(trip.trip_date) : null;
  const place =
    trip.service?.departure_location ||
    [trip.business?.city, trip.business?.region].filter(Boolean).join(", ");

  return (
    <article
      style={{
        ...glass,
        display: "grid",
        gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)",
        alignItems: "stretch",
      }}
      className="fx-trip-card"
    >
      <div style={{ position: "relative", minHeight: 240 }}>
        <MediaImg
          src={trip.service?.hero_url || trip.business?.hero_url || FALLBACK}
          alt={trip.service?.title ?? "Charter"}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg,rgba(7,26,42,0) 40%,rgba(7,26,42,.55) 100%)",
          }}
        />
        <span
          style={{
            ...eyebrow,
            position: "absolute",
            top: 16,
            left: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 13px",
            borderRadius: 999,
            background: "rgba(7,26,42,.65)",
            border: "1px solid rgba(13,34,54,.10)",
            color: "var(--sand)",
            fontSize: 10,
            backdropFilter: "blur(10px)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sand)" }} />
          {STATUS_LABEL[trip.status] ?? trip.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>

      <div style={{ padding: "clamp(20px,3vw,32px)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 600,
              fontSize: "clamp(21px,2.4vw,30px)",
              lineHeight: 1.15,
              color: "#031029",
              margin: 0,
            }}
          >
            {trip.service?.title ?? "Charter trip"}
          </h2>
          {left && (
            <span
              style={{
                ...eyebrow,
                flexShrink: 0,
                fontSize: 11,
                padding: "9px 14px",
                borderRadius: 10,
                background: "rgba(45,226,242,.12)",
                color: "#1F9FBE",
              }}
            >
              {left}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 26px", color: "#5c6b78", fontSize: 14.5 }}>
          <span>{dateLabel(trip.trip_date)}</span>
          <span>{timeLabel(trip.start_time)}</span>
          <span>
            {trip.party_size} {trip.party_size === 1 ? "angler" : "anglers"}
          </span>
          {place && <span>{place}</span>}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {trip.business?.name && <Chip label={trip.business.name} />}
          {trip.escrow_state && <Chip label={`Escrow · ${trip.escrow_state.replace(/_/g, " ")}`} />}
        </div>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 18,
            borderTop: "1px solid rgba(13,34,54,.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ ...eyebrow, fontSize: 10, color: "#5c6b78" }}>Trip total</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "#1F9FBE", fontWeight: 600 }}>
              {money(trip.total_cents)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(trip.status === "completed" || trip.status === "reviewed") && (
              <Link
                to="/review"
                search={{ booking: trip.id }}
                style={{
                  ...eyebrow,
                  fontSize: 11,
                  padding: "13px 20px",
                  borderRadius: 10,
                  background: "var(--sand)",
                  color: "#072057",
                  textDecoration: "none",
                }}
              >
                {trip.status === "reviewed" ? "View your review" : "Leave a review"}
              </Link>
            )}

            <Link
              to="/messages"
              search={{ booking: trip.id }}
              style={{
                ...eyebrow,
                fontSize: 11,
                padding: "13px 20px",
                borderRadius: 10,
                border: "1px solid rgba(13,34,54,.16)",
                color: "#031029",
                textDecoration: "none",
              }}
            >
              Message captain
            </Link>
            <Link
              to="/trips/detail"
              search={{ id: trip.id }}
              style={{
                ...eyebrow,
                fontSize: 11,
                padding: "13px 22px",
                borderRadius: 10,
                background: "var(--sand)",
                color: "#072057",
                textDecoration: "none",
              }}
            >
              View trip details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span
      style={{
        ...eyebrow,
        fontSize: 10,
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid rgba(45,226,242,.25)",
        background: "#ffffff",
        color: "#1F9FBE",
      }}
    >
      {label}
    </span>
  );
}

function HelpCard({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link: { to: string; label: string; search?: Record<string, string> };
}) {
  return (
    <div style={{ ...glass, padding: 28 }}>
      <h3 style={{ fontFamily: "var(--serif)", fontSize: 22, color: "#031029", margin: "0 0 8px" }}>{title}</h3>
      <p style={{ color: "#5c6b78", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 16px" }}>{body}</p>
      <Link
        to={link.to}
        search={link.search as never}
        style={{ ...eyebrow, fontSize: 11, color: "#1F9FBE", textDecoration: "none" }}
      >
        {link.label} →
      </Link>
    </div>
  );
}
