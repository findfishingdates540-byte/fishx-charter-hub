/**
 * Resolution Center for anglers. Pixel-matched to
 * public/dashboards/resolution-center.html — a 3-step "open a case" wizard plus
 * a live case view. Reads/writes real disputes + booking_messages via
 * src/lib/resolution.functions.ts. All booking state changes go through the
 * transition_booking RPC.
 */
import { useRef, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addCaseMessage,
  getResolutionContext,
  listDisputableBookings,
  openDispute,
  withdrawDispute,
} from "@/lib/resolution.functions";
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

const ISSUES = [
  { label: "Trip was cut significantly short", hint: "Back at the dock well before the booked hours" },
  { label: "Captain no-show or couldn’t depart", hint: "Trip never left the dock" },
  { label: "Boat or gear not as listed", hint: "Materially different from the listing" },
  { label: "Safety concern", hint: "Unsafe conditions, equipment or conduct" },
  { label: "Something else", hint: "Tell us in the next step" },
];

const EVIDENCE_LABELS = [
  { icon: "📷", label: "Add photos" },
  { icon: "🧾", label: "Add receipt" },
  { icon: "📍", label: "GPS track" },
];

function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2400);
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
            <span>←</span> Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 auto" }}>
            <BrandLogo size="sm" accent={V.sand} />
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
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.cyan }} /> Escrow
            frozen while open
          </span>
        </div>
      </header>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 28px 64px" }}>{children}</main>
    </div>
  );
}

/* ---------------------------------------------------------------- Picker -- */

function BookingPicker() {
  const { data } = useSuspenseQuery({
    queryKey: ["disputable-bookings"],
    queryFn: () => listDisputableBookings(),
  });

  return (
    <Shell>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: V.serif,
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: "-.01em",
            margin: "0 0 6px",
            color: V.ink,
          }}
        >
          Which booking is this about?
        </h1>
        <p style={{ fontSize: 14, color: V.tmut, margin: "0 0 20px" }}>
          Choose a recent trip to open or view a case. Your money stays safe in escrow throughout.
        </p>

        {data.bookings.length === 0 ? (
          <div
            style={{
              background: V.card,
              border: `1px solid ${V.line}`,
              borderRadius: 16,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 10 }}>⚑</div>
            <div style={{ fontFamily: V.serif, fontSize: 19, color: V.ink, marginBottom: 6 }}>
              No eligible trips
            </div>
            <div style={{ fontSize: 13.5, color: V.tmut, lineHeight: 1.6 }}>
              You can open a case once a trip is underway or completed. Head to your{" "}
              <Link to="/dashboard" style={{ color: V.goldtext, fontWeight: 600 }}>
                dashboard
              </Link>{" "}
              to see your bookings.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.bookings.map((b) => (
              <Link
                key={b.id}
                to="/resolution-center"
                search={{ booking: b.id }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: V.card,
                  border: `1px solid ${V.line}`,
                  borderRadius: 16,
                  padding: "16px 20px",
                  textDecoration: "none",
                  color: V.ink,
                }}
              >
                <MediaImg
                  src={b.service?.hero_url ?? DEFAULT_HERO}
                  alt=""
                  style={{ width: 64, height: 52, borderRadius: 10, objectFit: "cover", flex: "none" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: V.serif,
                      fontSize: 18,
                      fontWeight: 600,
                      color: V.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.service?.title ?? "Charter trip"} · {captainName(b.captain)}
                  </div>
                  <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>
                    {dateLine(b.trip_date, b.start_time, b.party_size)}
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div style={{ fontFamily: V.serif, fontSize: 20, fontWeight: 600, color: V.cyan }}>
                    {money(b.total_cents)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: b.status === "disputed" ? V.red : V.tmut,
                    }}
                  >
                    {b.status === "disputed" ? "Case open" : "Report"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------- Case view -- */

const OUTCOMES = [
  { label: "Full refund", hint: "The whole booking back from escrow", frac: 1 },
  { label: "Partial refund · half", hint: "Fair if roughly half the trip was delivered", frac: 0.5 },
  { label: "Rebook with the captain", hint: "Escrow moves to a new date instead", frac: 0 },
  { label: "Just flag it", hint: "No money moves — note goes on record", frac: -1 },
] as const;

function outcomeAmount(frac: number, totalCents: number) {
  if (frac < 0) return "—";
  return money(Math.round(totalCents * frac));
}

/* ------------------------------------------------------------- Wizard/case -- */

function ResolutionForBooking({ bookingId }: { bookingId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["resolution", bookingId],
    queryFn: () => getResolutionContext({ data: { bookingId } }),
  });
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();

  const openFn = useServerFn(openDispute);
  const msgFn = useServerFn(addCaseMessage);
  const withdrawFn = useServerFn(withdrawDispute);

  const b = data.booking;
  const total = b.total_cents;
  const capName = captainName(data.captain);
  const inCase = !!data.dispute;

  const [step, setStep] = useState(1);
  const [issue, setIssue] = useState(0);
  const [outcome, setOutcome] = useState(1);
  const [evidence, setEvidence] = useState<boolean[]>([false, false, false]);
  const [statement, setStatement] = useState("");
  const [detailsDraft, setDetailsDraft] = useState("");
  const [caseMsg, setCaseMsg] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["resolution", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["disputable-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["trip-detail", bookingId] });
  };

  const openMut = useMutation({
    mutationFn: () =>
      openFn({
        data: {
          bookingId,
          kind: ISSUES[issue].label,
          description: statement || undefined,
          requestedOutcome: OUTCOMES[outcome].label,
          evidence: EVIDENCE_LABELS.filter((_, i) => evidence[i]).map((e) => e.label),
        },
      }),
    onSuccess: () => {
      showToast("Case opened — escrow frozen and captain notified");
      invalidate();
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Couldn't open the case"),
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => msgFn({ data: { bookingId, body } }),
    onSuccess: () => {
      setCaseMsg("");
      showToast("Added to the case thread");
      invalidate();
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Couldn't send"),
  });

  const withdrawMut = useMutation({
    mutationFn: () => withdrawFn({ data: { bookingId, disputeId: data.dispute!.id } }),
    onSuccess: () => {
      showToast("Case withdrawn — escrow back to normal hold");
      invalidate();
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Couldn't withdraw"),
  });

  const contextCard = (
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
          Booking {b.id.slice(0, 8).toUpperCase()}
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
        </div>
      </div>
      <div style={{ textAlign: "right", flex: "none" }}>
        <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600, color: V.cyan }}>
          {money(total)}
        </div>
        <div style={{ fontSize: 11.5, color: V.tmut }}>
          {inCase ? "frozen · case open" : "held in escrow"}
        </div>
      </div>
    </div>
  );

  // -------- Case view (an open dispute exists) --------
  if (inCase) {
    const dispute = data.dispute!;
    const requested =
      (dispute.metadata as { requested_outcome?: string } | null)?.requested_outcome ??
      "a fair resolution";
    const caseSteps = [
      { title: "Case opened", desc: "Escrow frozen · captain notified", state: "done" as const },
      { title: "Captain responds", desc: `${capName} has 48 hours to reply`, state: "current" as const },
      {
        title: "Mediation · if needed",
        desc: "A Fish-X mediator reviews evidence within 5 days",
        state: "todo" as const,
      },
      {
        title: "Resolution & release",
        desc: "Escrow splits per the outcome — instantly",
        state: "todo" as const,
      },
    ];

    return (
      <Shell backTo="/dashboard">
        {contextCard}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div
              style={{
                background: V.card,
                border: `1px solid ${V.line}`,
                borderRadius: 20,
                padding: 26,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: V.sandsoft,
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 14px",
                }}
              >
                <span style={{ color: V.goldtext, fontSize: 26 }}>⚑</span>
              </div>
              <h1
                style={{
                  fontFamily: V.serif,
                  fontWeight: 600,
                  fontSize: 27,
                  letterSpacing: "-.01em",
                  margin: "0 0 6px",
                  color: V.ink,
                }}
              >
                Case {dispute.id.slice(0, 8).toUpperCase()} is open
              </h1>
              <p style={{ fontSize: 14, color: V.tmut, margin: 0 }}>
                “{dispute.kind}” · requesting {requested.toLowerCase()}
              </p>
            </div>

            <div
              style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24 }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: V.goldtext,
                  marginBottom: 16,
                }}
              >
                Case timeline
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {caseSteps.map((e, i) => {
                  const done = e.state === "done";
                  const cur = e.state === "current";
                  return (
                    <div key={e.title} style={{ display: "flex", gap: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          flex: "none",
                          width: 22,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: done ? V.green : cur ? V.cyan : "#ffffff",
                            border: done || cur ? "0" : "2px solid rgba(13,34,54,.18)",
                            display: "grid",
                            placeItems: "center",
                            color: "#fff",
                            fontSize: 9,
                            flex: "none",
                          }}
                        >
                          {done ? "✓" : ""}
                        </span>
                        {i < caseSteps.length - 1 && (
                          <span
                            style={{
                              width: 2,
                              flex: 1,
                              minHeight: 24,
                              background: done ? V.green : "rgba(13,34,54,.12)",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ paddingBottom: 16, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: done || cur ? V.ink : V.tmut,
                          }}
                        >
                          {e.title}
                        </div>
                        <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>{e.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Case thread */}
            <div
              style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24 }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: V.goldtext,
                  marginBottom: 14,
                }}
              >
                Case thread
              </div>
              <div style={{ display: "flex", gap: 11, padding: "12px 0", borderTop: `1px solid ${V.line}` }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: V.navy,
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      background: V.sand,
                      transform: "rotate(45deg)",
                      display: "inline-block",
                      borderRadius: 1,
                    }}
                  />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: V.ink }}>
                    Fish-X Resolutions{" "}
                    <span style={{ fontWeight: 500, color: V.tmut }}>· just now</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: V.tmut, marginTop: 3 }}>
                    Case opened. {capName} has been notified and the {money(total)} in escrow is frozen
                    while this is reviewed.
                  </div>
                </div>
              </div>
              {data.messages.map((m) => {
                const mine = m.sender_id === data.viewerId;
                return (
                  <div
                    key={m.id}
                    style={{ display: "flex", gap: 11, padding: "12px 0", borderTop: `1px solid ${V.line}` }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: V.paper,
                        border: `1px solid ${V.line}`,
                        display: "grid",
                        placeItems: "center",
                        fontFamily: V.serif,
                        fontSize: 14,
                        fontWeight: 600,
                        color: V.goldtext,
                        flex: "none",
                      }}
                    >
                      {mine ? "A" : (capName[0] ?? "C").toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: V.ink }}>
                        {mine ? "You" : capName}{" "}
                        <span style={{ fontWeight: 500, color: V.tmut }}>
                          ·{" "}
                          {new Date(m.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.55, color: V.tmut, marginTop: 3 }}>
                        {m.body}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <input
                  value={caseMsg}
                  onChange={(e) => setCaseMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && caseMsg.trim()) sendMut.mutate(caseMsg.trim());
                  }}
                  placeholder="Add to the thread…"
                  style={{
                    flex: 1,
                    background: V.paper,
                    border: `1px solid ${V.line}`,
                    borderRadius: 11,
                    padding: "12px 14px",
                    fontFamily: V.sans,
                    fontSize: 13.5,
                    color: V.ink,
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => caseMsg.trim() && sendMut.mutate(caseMsg.trim())}
                  disabled={sendMut.isPending || !caseMsg.trim()}
                  style={{
                    background: V.sand,
                    color: "#04121B",
                    border: 0,
                    borderRadius: 11,
                    padding: "0 20px",
                    fontFamily: V.sans,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: sendMut.isPending || !caseMsg.trim() ? 0.6 : 1,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Case rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 86 }}>
            <div
              style={{
                background: "linear-gradient(160deg,#0c2a42,#072057)",
                borderRadius: 18,
                padding: 22,
                color: V.ond,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: V.sand,
                  marginBottom: 12,
                }}
              >
                Escrow status
              </div>
              <div style={{ fontFamily: V.serif, fontSize: 30, fontWeight: 600, color: "#fff" }}>
                {money(total)}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 8,
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 20,
                  padding: "6px 12px",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.cyan }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#fff" }}>Frozen · case open</span>
              </div>
              <div style={{ fontSize: 12, color: V.ondmut, marginTop: 12, lineHeight: 1.55 }}>
                Requested: <b style={{ color: "#fff" }}>{requested}</b>
              </div>
            </div>
            <div
              style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 20 }}
            >
              <div style={{ fontFamily: V.serif, fontSize: 16.5, color: V.ink, marginBottom: 8 }}>
                Change your mind?
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: V.tmut, marginBottom: 12 }}>
                If you and the captain work it out on your own, you can withdraw the case any time.
              </div>
              <button
                onClick={() => withdrawMut.mutate()}
                disabled={withdrawMut.isPending}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: `1px solid ${V.line}`,
                  borderRadius: 11,
                  padding: 12,
                  fontFamily: V.sans,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: V.ink,
                  cursor: "pointer",
                  opacity: withdrawMut.isPending ? 0.6 : 1,
                }}
              >
                Withdraw case
              </button>
            </div>
            <Link
              to="/dashboard"
              style={{
                display: "block",
                textAlign: "center",
                background: V.navy,
                color: "#fff",
                textDecoration: "none",
                borderRadius: 12,
                padding: 14,
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
        <Toast toast={toast} />
      </Shell>
    );
  }

  // -------- Wizard (no dispute yet) --------
  const pill = (on: boolean) => ({
    bg: on ? "rgba(45,226,242,.12)" : "transparent",
    border: on ? V.sand : "rgba(13,34,54,.12)",
    ring: on ? V.goldtext : "rgba(13,34,54,.25)",
    fill: on ? V.goldtext : "transparent",
  });

  const stepDot = (n: number) => ({
    bg: step >= n ? V.navy : "#e9edf1",
    color: step >= n ? "#fff" : V.tmut,
  });

  return (
    <Shell backTo="/dashboard">
      {contextCard}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, alignItems: "start" }}>
        <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 26 }}>
          {/* progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            {[1, 2, 3].map((n) => {
              const d = stepDot(n);
              return (
                <span key={n} style={{ display: "contents" }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: d.bg,
                      color: d.color,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flex: "none",
                    }}
                  >
                    {n}
                  </span>
                  {n < 3 && (
                    <span
                      style={{
                        flex: 1,
                        height: 2,
                        background: step >= n + 1 ? V.navy : "rgba(13,34,54,.12)",
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>

          {step === 1 && (
            <div>
              <h1
                style={{
                  fontFamily: V.serif,
                  fontWeight: 600,
                  fontSize: 28,
                  letterSpacing: "-.01em",
                  margin: "0 0 6px",
                  color: V.ink,
                }}
              >
                What went wrong?
              </h1>
              <p style={{ fontSize: 14, color: V.tmut, margin: "0 0 20px" }}>
                Your money is safe — it’s frozen in escrow while we sort this out.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {ISSUES.map((t, i) => {
                  const p = pill(issue === i);
                  return (
                    <button
                      key={t.label}
                      onClick={() => setIssue(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 13,
                        width: "100%",
                        textAlign: "left",
                        background: p.bg,
                        border: `1px solid ${p.border}`,
                        borderRadius: 13,
                        padding: "15px 16px",
                        cursor: "pointer",
                        fontFamily: V.sans,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${p.ring}`,
                          display: "grid",
                          placeItems: "center",
                          flex: "none",
                        }}
                      >
                        <span
                          style={{ width: 8, height: 8, borderRadius: "50%", background: p.fill }}
                        />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: V.ink }}>
                          {t.label}
                        </span>
                        <span style={{ display: "block", fontSize: 12.5, color: V.tmut, marginTop: 1 }}>
                          {t.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStep(2)}
                style={{
                  width: "100%",
                  marginTop: 20,
                  background: V.navy,
                  color: "#fff",
                  border: 0,
                  borderRadius: 12,
                  padding: 15,
                  fontFamily: V.sans,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1
                style={{
                  fontFamily: V.serif,
                  fontWeight: 600,
                  fontSize: 28,
                  letterSpacing: "-.01em",
                  margin: "0 0 6px",
                  color: V.ink,
                }}
              >
                Tell us what happened.
              </h1>
              <p style={{ fontSize: 14, color: V.tmut, margin: "0 0 18px" }}>
                {capName} sees exactly what you write. Specifics help everyone resolve faster.
              </p>
              <textarea
                value={detailsDraft}
                onChange={(e) => setDetailsDraft(e.target.value)}
                rows={5}
                placeholder="e.g. We were back at the dock by 9:40 AM — about half the booked 8 hours. No mechanical issue was mentioned…"
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
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: V.goldtext,
                  margin: "18px 0 10px",
                }}
              >
                Evidence · optional
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {EVIDENCE_LABELS.map((e, i) => {
                  const on = evidence[i];
                  return (
                    <button
                      key={e.label}
                      onClick={() => {
                        const next = evidence.slice();
                        next[i] = !next[i];
                        setEvidence(next);
                      }}
                      style={{
                        aspectRatio: "1.4",
                        border: `1.5px dashed ${on ? V.green : "rgba(13,34,54,.2)"}`,
                        background: on ? V.greensoft : "transparent",
                        borderRadius: 13,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: V.sans,
                      }}
                    >
                      <span style={{ textAlign: "center" }}>
                        <span style={{ display: "block", fontSize: 19, marginBottom: 4 }}>
                          {on ? "✓" : e.icon}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: on ? V.green : V.tmut,
                          }}
                        >
                          {on ? "Attached" : e.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: "none",
                    background: "transparent",
                    border: `1px solid ${V.line}`,
                    borderRadius: 12,
                    padding: "15px 22px",
                    fontFamily: V.sans,
                    fontSize: 13,
                    fontWeight: 600,
                    color: V.ink,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setStatement(detailsDraft.trim());
                    setStep(3);
                  }}
                  style={{
                    flex: 1,
                    background: V.navy,
                    color: "#fff",
                    border: 0,
                    borderRadius: 12,
                    padding: 15,
                    fontFamily: V.sans,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1
                style={{
                  fontFamily: V.serif,
                  fontWeight: 600,
                  fontSize: 28,
                  letterSpacing: "-.01em",
                  margin: "0 0 6px",
                  color: V.ink,
                }}
              >
                How should we make it right?
              </h1>
              <p style={{ fontSize: 14, color: V.tmut, margin: "0 0 20px" }}>
                Your preference frames the resolution — the captain can accept it instantly.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {OUTCOMES.map((o, i) => {
                  const p = pill(outcome === i);
                  return (
                    <button
                      key={o.label}
                      onClick={() => setOutcome(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 13,
                        width: "100%",
                        textAlign: "left",
                        background: p.bg,
                        border: `1px solid ${p.border}`,
                        borderRadius: 13,
                        padding: "15px 16px",
                        cursor: "pointer",
                        fontFamily: V.sans,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${p.ring}`,
                          display: "grid",
                          placeItems: "center",
                          flex: "none",
                        }}
                      >
                        <span
                          style={{ width: 8, height: 8, borderRadius: "50%", background: p.fill }}
                        />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: V.ink }}>
                          {o.label}
                        </span>
                        <span style={{ display: "block", fontSize: 12.5, color: V.tmut, marginTop: 1 }}>
                          {o.hint}
                        </span>
                      </span>
                      <span
                        style={{
                          fontFamily: V.serif,
                          fontSize: 17,
                          fontWeight: 600,
                          color: V.goldtext,
                          flex: "none",
                        }}
                      >
                        {outcomeAmount(o.frac, total)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: "none",
                    background: "transparent",
                    border: `1px solid ${V.line}`,
                    borderRadius: 12,
                    padding: "15px 22px",
                    fontFamily: V.sans,
                    fontSize: 13,
                    fontWeight: 600,
                    color: V.ink,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => openMut.mutate()}
                  disabled={openMut.isPending}
                  style={{
                    flex: 1,
                    background: V.sand,
                    color: "#04121B",
                    border: 0,
                    borderRadius: 12,
                    padding: 15,
                    fontFamily: V.sans,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    opacity: openMut.isPending ? 0.6 : 1,
                  }}
                >
                  {openMut.isPending ? "Opening…" : "Open case"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SIDE: how it works */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 86 }}>
          <div
            style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 20 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: V.cyansoft,
                  display: "grid",
                  placeItems: "center",
                  color: V.cyan,
                  fontSize: 15,
                }}
              >
                🔒
              </span>
              <div style={{ fontFamily: V.serif, fontSize: 16.5, color: V.ink }}>
                Why you’re protected
              </div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: V.tmut }}>
              The {money(total)} never reached the captain. It sits frozen in escrow until this case
              closes — no chargebacks, no chasing.
            </div>
          </div>
          <div
            style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 20 }}
          >
            <div style={{ fontFamily: V.serif, fontSize: 16.5, color: V.ink, marginBottom: 12 }}>
              What happens next
            </div>
            {[
              `${capName} gets your case and has 48 hours to respond`,
              "Most cases settle here — they can accept your resolution in one tap",
              "No agreement? A Fish-X mediator decides within 5 days and escrow releases accordingly",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0" }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `1.5px solid ${V.sand}`,
                    color: V.goldtext,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 10.5,
                    flex: "none",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: V.tmut }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </Shell>
  );
}

export function ResolutionCenter({ bookingId }: { bookingId: string | null }) {
  if (!bookingId) return <BookingPicker />;
  return <ResolutionForBooking bookingId={bookingId} />;
}
