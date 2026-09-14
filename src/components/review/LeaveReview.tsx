/**
 * Angler "Leave a Review" screen. Ported layout/sections/copy from
 * /tmp/stitch/zone2/review-{leave,success}.html but re-skinned into the light
 * Fish-X `V` palette so it belongs with ResolutionCenter.tsx. Reads/writes real
 * reviews via src/lib/review.functions.ts. One review per booking.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReviewContext, submitReview } from "@/lib/review.functions";
import { DEFAULT_HERO } from "@/lib/platform-photos";

const V = {
  serif: "'Outfit',Georgia,serif",
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  navy: "#072057",
  paper: "#ffffff",
  card: "#ffffff",
  sand: "#2DE2F2",
  sand2: "#27C0E2",
  sandsoft: "#E2F6FA",
  goldtext: "#1F9FBE",
  cyan: "#1f9fbe",
  cyansoft: "#e2eef2",
  green: "#1f8a5b",
  greensoft: "#e2f2ea",
  red: "#d8514a",
  redsoft: "#fbe9e8",
  ond: "#eaf1f6",
  ondmut: "#93a7b7",
  tmut: "#5c6b78",
  line: "rgba(13,34,54,.10)",
  lined: "rgba(255,255,255,.12)",
};

const money = (cents: number | null | undefined) =>
  `$${Math.round((cents ?? 0) / 100).toLocaleString()}`;

const captainName = (
  c: { full_name?: string | null; display_name?: string | null } | null | undefined,
) => c?.display_name || c?.full_name || "the captain";

const dateLine = (d: string, t: string | null, party: number) => {
  const date = new Date(d + "T00:00:00");
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = t
    ? new Date(`1970-01-01T${t}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  return `${day}${time ? " · " + time : ""} · ${party} ${party === 1 ? "angler" : "anglers"}`;
};

function useToast() {
  const [toast, setToast] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => setToast(""), 2400));
  };
  return { toast, showToast };
}

function Toast({ toast }: { toast: string }) {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 11,
        background: V.navy,
        color: "#fff",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 30,
        padding: "13px 22px",
        boxShadow: "0 20px 44px -20px rgba(0,0,0,.6)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: V.sand,
          color: "#04121B",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
        }}
      >
        ✓
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{toast}</span>
    </div>
  );
}

function Shell({ children, backTo }: { children: React.ReactNode; backTo?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: V.paper,
        color: V.ink,
        fontFamily: V.sans,
      }}
    >
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: V.navy, color: V.ond }}>
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "0 28px",
            height: 62,
            display: "flex",
            alignItems: "center",
            gap: 22,
          }}
        >
          <Link
            to={backTo ?? "/dashboard"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: V.ondmut,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>←</span> Back to trip details
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto" }}>
            <span
              style={{
                width: 10,
                height: 10,
                background: V.sand,
                transform: "rotate(45deg)",
                display: "inline-block",
                borderRadius: 1,
              }}
            />
            <span style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 19, letterSpacing: ".02em", whiteSpace: "nowrap" }}>
              FISH-X.COM
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: V.sand,
                marginLeft: 4,
              }}
            >
              Leave a Review
            </span>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: `1px solid ${V.lined}`,
              borderRadius: 30,
              padding: "8px 14px",
              fontSize: 11.5,
              fontWeight: 600,
              color: V.ond,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.cyan }} /> Verified
            booking
          </span>
        </div>
      </header>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 28px 64px" }}>{children}</main>
    </div>
  );
}

/* ------------------------------------------------------------------ Stars -- */

function StarRow({
  rating,
  size,
  onSet,
}: {
  rating: number;
  size: number;
  onSet?: (n: number) => void;
}) {
  const interactive = !!onSet;
  return (
    <div style={{ display: "flex", gap: interactive ? 8 : 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= rating;
        const star = (
          <span
            style={{
              fontSize: size,
              lineHeight: 1,
              color: on ? V.sand2 : "rgba(13,34,54,.18)",
              userSelect: "none",
            }}
          >
            ★
          </span>
        );
        if (!interactive) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onSet(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- Context card -- */

type ReviewContext = Awaited<ReturnType<typeof getReviewContext>>;

function ContextCard({ data }: { data: ReviewContext }) {
  const b = data.booking;
  const capName = captainName(data.captain);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: V.card,
        border: `1px solid ${V.line}`,
        borderRadius: 16,
        padding: "16px 20px",
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <MediaImg
        src={data.service?.hero_url ?? DEFAULT_HERO}
        alt=""
        style={{ width: 64, height: 52, borderRadius: 10, objectFit: "cover", flex: "none" }}
      />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: V.goldtext,
          }}
        >
          Trip completed
        </div>
        <div
          style={{
            fontFamily: V.serif,
            fontSize: 19,
            fontWeight: 600,
            color: V.ink,
            marginTop: 2,
          }}
        >
          {data.service?.title ?? "Charter trip"} · {capName}
        </div>
        <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>
          {dateLine(b.trip_date, b.start_time, b.party_size)}
          {data.business?.name ? ` · ${data.business.name}` : ""}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Success -- */

function SuccessState({
  data,
  rating,
  body,
}: {
  data: ReviewContext;
  rating: number;
  body: string | null;
}) {
  const capName = captainName(data.captain);
  return (
    <Shell backTo="/dashboard">
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: V.sandsoft,
            border: `1px solid ${V.sand}`,
            display: "grid",
            placeItems: "center",
            margin: "8px auto 22px",
          }}
        >
          <span style={{ color: V.goldtext, fontSize: 46 }}>✓</span>
        </div>
        <h1
          style={{
            fontFamily: V.serif,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: "-.01em",
            margin: "0 0 12px",
            color: V.ink,
          }}
        >
          Thanks — your review is live
        </h1>
        <p
          style={{
            fontSize: 15,
            color: V.tmut,
            lineHeight: 1.6,
            margin: "0 auto 24px",
            maxWidth: 480,
          }}
        >
          Your feedback helps the community and supports {capName}. It helps future anglers find the
          most authentic charters on Fish-X.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <StarRow rating={rating} size={26} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            background: V.card,
            border: `1px solid ${V.line}`,
            borderRadius: 18,
            padding: 16,
            textAlign: "left",
            maxWidth: 460,
            marginBottom: 28,
          }}
        >
          <MediaImg
            src={data.service?.hero_url ?? DEFAULT_HERO}
            alt=""
            style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flex: "none" }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: V.goldtext,
                marginBottom: 3,
              }}
            >
              Trip completed
            </div>
            <div style={{ fontFamily: V.serif, fontSize: 18, fontWeight: 600, color: V.ink }}>
              {data.service?.title ?? "Charter trip"}
            </div>
            <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>
              with {capName} ·{" "}
              {dateLine(data.booking.trip_date, data.booking.start_time, data.booking.party_size)}
            </div>
          </div>
        </div>

        {body ? (
          <div
            style={{
              background: V.card,
              border: `1px solid ${V.line}`,
              borderRadius: 16,
              padding: "18px 22px",
              textAlign: "left",
              maxWidth: 560,
              margin: "0 auto 28px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: V.goldtext,
                marginBottom: 8,
              }}
            >
              Your review
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: V.tmut, fontStyle: "italic" }}>
              “{body}”
            </div>
          </div>
        ) : null}

        {data.review?.response_body ? (
          <div
            style={{
              background: V.cyansoft,
              border: `1px solid ${V.line}`,
              borderRadius: 16,
              padding: "18px 22px",
              textAlign: "left",
              maxWidth: 560,
              margin: "0 auto 28px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: V.cyan,
                marginBottom: 8,
              }}
            >
              {capName}'s reply
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: V.ink }}>
              {data.review.response_body}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link
            to="/dashboard"
            style={{
              background: V.sand,
              color: "#04121B",
              textDecoration: "none",
              borderRadius: 12,
              padding: "14px 30px",
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Back to trips
          </Link>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ Form -- */

export function LeaveReview({ bookingId }: { bookingId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["review", bookingId],
    queryFn: () => getReviewContext({ data: { bookingId } }),
  });
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();
  const submitFn = useServerFn(submitReview);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);

  const capName = captainName(data.captain);

  const submitMut = useMutation({
    mutationFn: () => submitFn({ data: { bookingId, rating, body: body.trim() || undefined } }),
    onSuccess: () => {
      setDone(true);
      showToast("Review published — thank you");
      queryClient.invalidateQueries({ queryKey: ["review", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["trip-detail", bookingId] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Couldn't submit your review"),
  });

  // Already reviewed (persisted) or just submitted → success state.
  if (data.review) {
    return <SuccessState data={data} rating={data.review.rating} body={data.review.body} />;
  }
  if (done) {
    return <SuccessState data={data} rating={rating} body={body.trim() || null} />;
  }

  const canSubmit = rating >= 1 && rating <= 5 && !submitMut.isPending;

  return (
    <Shell backTo="/dashboard">
      <ContextCard data={data} />

      <div
        style={{
          background: V.card,
          border: `1px solid ${V.line}`,
          borderRadius: 20,
          padding: 30,
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: V.cyansoft,
            border: `1px solid ${V.line}`,
            borderRadius: 30,
            padding: "6px 12px",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: V.cyan,
            marginBottom: 14,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.cyan }} /> Verified
          booking
        </span>

        <h1
          style={{
            fontFamily: V.serif,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: "-.01em",
            margin: "0 0 6px",
            color: V.ink,
          }}
        >
          How was your trip with{" "}
          <span style={{ fontStyle: "italic", color: V.goldtext }}>{capName}?</span>
        </h1>
        <p style={{ fontSize: 14, color: V.tmut, margin: "0 0 26px" }}>
          {data.service?.title ?? "Your charter"}
          {data.business?.name ? ` · ${data.business.name}` : ""} ·{" "}
          {dateLine(data.booking.trip_date, data.booking.start_time, data.booking.party_size)}
        </p>

        {/* Overall rating */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: "26px 20px",
            borderRadius: 16,
            background: V.paper,
            border: `1px solid ${V.line}`,
            marginBottom: 26,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: V.goldtext,
            }}
          >
            Overall experience
          </span>
          <StarRow rating={rating} size={38} onSet={setRating} />
          <span style={{ fontSize: 12.5, color: V.tmut }}>
            {rating === 0 ? "Tap to rate" : `${rating} of 5 stars`}
          </span>
        </div>

        {/* Written review */}
        <div style={{ marginBottom: 26 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: V.goldtext,
              marginBottom: 10,
            }}
          >
            Share your story · optional
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder={`Describe the day on the water, the catch, and ${capName}'s expertise…`}
            style={{
              width: "100%",
              resize: "vertical",
              background: V.paper,
              border: `1px solid ${V.line}`,
              borderRadius: 13,
              padding: "14px 16px",
              fontFamily: V.sans,
              fontSize: 14,
              lineHeight: 1.55,
              color: V.ink,
              outline: "none",
            }}
          />
        </div>

        {/* Footer CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            paddingTop: 20,
            borderTop: `1px solid ${V.line}`,
            flexWrap: "wrap",
          }}
        >
          <p style={{ fontSize: 12.5, color: V.tmut, maxWidth: 340, margin: 0, lineHeight: 1.5 }}>
            By submitting, you confirm this was a genuine experience. Your booking details are never
            shared publicly.
          </p>
          <button
            onClick={() => canSubmit && submitMut.mutate()}
            disabled={!canSubmit}
            style={{
              background: V.sand,
              color: "#04121B",
              border: 0,
              borderRadius: 12,
              padding: "15px 34px",
              fontFamily: V.sans,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {submitMut.isPending ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>

      {/* Guidelines */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 16,
          maxWidth: 720,
          margin: "26px auto 0",
        }}
      >
        {[
          {
            icon: "🔒",
            title: "Private details",
            body: "Your personal info and booking ID are never shared publicly.",
          },
          {
            icon: "✓",
            title: "Authenticity",
            body: "Only anglers with a completed trip can leave a Fish-X review.",
          },
          {
            icon: "⚓",
            title: "Charter credits",
            body: "Earn Charter Points for every verified review you post.",
          },
        ].map((g) => (
          <div
            key={g.title}
            style={{
              background: V.card,
              border: `1px solid ${V.line}`,
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: V.cyansoft,
                display: "grid",
                placeItems: "center",
                color: V.cyan,
                fontSize: 15,
                marginBottom: 10,
              }}
            >
              {g.icon}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: V.ink,
                marginBottom: 6,
              }}
            >
              {g.title}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: V.tmut }}>{g.body}</div>
          </div>
        ))}
      </div>

      <Toast toast={toast} />
    </Shell>
  );
}
