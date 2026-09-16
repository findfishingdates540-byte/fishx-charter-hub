/**
 * Angler booking flow, pixel-ported from public/dashboards/booking.html.
 * Real DB write: `Place booking` calls createBookingFromService which inserts a
 * booking row (status=confirmed, escrow_state=held) tied to the signed-in
 * angler. Stripe wiring is TODO — for now escrow is simulated in the DB.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { createBookingFromService, getAddonAvailability, getCheckoutContext } from "@/lib/booking-checkout.functions";
import { PublicAvailabilityCalendar, timeBlock, type PublicSlot } from "@/components/booking/PublicAvailabilityCalendar";
import { DEFAULT_HERO, galleryFor } from "@/lib/platform-photos";

const V = {
  serif: "'Outfit',Georgia,serif",
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029", navy: "#072057", paper: "#ffffff", card: "#fff",
  sand: "#2DE2F2", sandsoft: "#E2F6FA", goldtext: "#1F9FBE",
  cyan: "#1f9fbe", cyansoft: "#e2eef2", green: "#1f8a5b", greensoft: "#e2f2ea",
  ond: "#eaf1f6", ondmut: "#93a7b7", tmut: "#5c6b78",
  line: "rgba(13,34,54,.10)", lined: "rgba(255,255,255,.12)",
};

const money = (n: number) => `$${Math.round(n / 100).toLocaleString()}`;

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

const dayPart = (d: Date) => {
  const h = d.getHours();
  if (h < 11) return "Morning";
  if (h < 16) return "Afternoon";
  return "Evening";
};
const timeLabel = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

const cardLight: CSSProperties = {
  background: V.card,
  border: `1px solid ${V.line}`,
  borderRadius: 16,
  padding: 28,
};
const h2Light: CSSProperties = {
  fontFamily: V.serif,
  fontWeight: 700,
  fontSize: 28,
  color: V.ink,
  margin: "0 0 18px",
};
const railLabel: CSSProperties = {
  display: "block",
  fontFamily: MONO,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: V.cyan,
  marginBottom: 8,
};
const railField: CSSProperties = {
  width: "100%",
  background: V.paper,
  border: `1px solid ${V.line}`,
  borderRadius: 10,
  padding: "13px 14px",
  fontFamily: MONO,
  fontSize: 15,
  fontWeight: 600,
  color: V.ink,
  outline: "none",
  colorScheme: "light",
};

/** Normalise transport failures so route and query error boundaries always
 * receive a useful Error with a user-facing message. */
async function toError<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e: unknown) {
    if (e instanceof Error) throw e;
    if (typeof Response !== "undefined" && e instanceof Response) {
      throw new Error((await e.text().catch(() => "")) || `Request failed (${e.status})`);
    }
    throw new Error(typeof e === "string" ? e : "Something went wrong loading this trip.");
  }
}

export const checkoutQuery = (serviceId: string) =>
  queryOptions({
    queryKey: ["checkout", serviceId],
    queryFn: () => toError(getCheckoutContext({ data: { serviceId } })),
  });


type Step = "detail" | "dates" | "extras" | "checkout" | "confirmed" | "slot_taken";

/** Postgres/RPC errors that mean "someone else got this departure". */
const SLOT_CONFLICT = /seat|slot|full|hold|reserved|no longer|overlap|conflict|blackout|taken|capacity/i;

const CRUMBS: Array<{ k: Step | "results"; label: string }> = [
  { k: "detail", label: "Trip" },
  { k: "dates", label: "Date & time" },
  { k: "extras", label: "Add-ons" },
  { k: "checkout", label: "Deposit" },
  { k: "confirmed", label: "Confirmed" },
];

const STEP_ORDER: Array<Step | "results"> = ["results", "detail", "dates", "extras", "checkout", "confirmed"];


const CANCELLATION_RULES: Array<[string, string]> = [
  [
    "7+ days out — full deposit refund",
    "Cancel a week or more before departure and your deposit is returned in full, no questions asked.",
  ],
  [
    "Captain-declared weather call — full refund or free reschedule",
    "If the captain cancels for weather or unsafe conditions, choose a full refund or move to any open date at no cost.",
  ],
  [
    "Inside 48 hours or no-show — deposit forfeited",
    "Late cancellations keep the boat off the water, so the deposit stays with the captain.",
  ],
];


export function BookingFlow({
  serviceId,
  baseId,
  initialSlotId,
  initialParty,
  initialStep,
  storefrontSlug,
}: {
  serviceId: string;
  baseId?: string;
  initialSlotId?: string;
  initialParty?: number;
  initialStep?: "dates";
  storefrontSlug?: string;
}) {
  const navigate = useNavigate();
  const { data: svc } = useSuspenseQuery(checkoutQuery(serviceId));
  const business = svc.business as { id: string; slug: string; name: string; city: string | null; region: string | null; logo_url: string | null; hero_url: string | null; deposit_rate?: number | null; commission_rate?: number | null } | null;
  const boat = (svc.boat ?? (svc as any).charter?.boat ?? null) as {
    name: string | null; make: string | null; model: string | null; length_ft: number | null;
    capacity: number | null; home_port: string | null; description: string | null;
    hero_image_url: string | null; image_urls: string[] | null;
  } | null;

  const qc = useQueryClient();
  const openSlots = svc.openSlots ?? [];
  /** A departure carried over from a storefront booking form skips straight to extras. */
  const preSlot = initialSlotId && openSlots.some((s: any) => s.id === initialSlotId) ? initialSlotId : "";
  const [step, setStep] = useState<Step>(preSlot ? "extras" : initialStep === "dates" ? "dates" : "detail");
  const [takenSlot, setTakenSlot] = useState<{ label: string } | null>(null);
  const [payBlocked, setPayBlocked] = useState<string | null>(null);

  // Nothing is pre-picked unless the angler already chose a departure elsewhere.
  const [slotId, setSlotId] = useState(preSlot);
  const slot = openSlots.find((s) => s.id === slotId) ?? null;
  const [party, setParty] = useState(Math.max(1, initialParty ?? 2));


  const addons = (svc as any).addons as Array<{
    id: string; title: string; description: string | null; price_cents: number; unit: "per_trip" | "per_person";
  }> ?? [];
  const packages = ((svc as any).packages ?? []) as Array<{
    id: string; title: string; duration_minutes: number | null; base_price_cents: number; capacity: number | null;
  }>;
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const toggleAddon = (id: string) =>
    setSelectedAddons((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Per-departure add-on availability (capacity, per-booking caps, lead time).
  const fetchAddonAvail = useServerFn(getAddonAvailability);
  const { data: addonAvail } = useQuery({
    queryKey: ["addon-availability", serviceId, slotId, party],
    enabled: Boolean(slotId) && addons.length > 0,
    queryFn: () =>
      toError(fetchAddonAvail({ data: { serviceId, slotId, partySize: party } })),
    staleTime: 15_000,
  });
  const addonRule = (id: string) =>
    (addonAvail ?? []).find((r) => r.id === id) ?? { available: true, reason: null as string | null, remaining: null as number | null };

  const [processing, setProcessing] = useState(false);
  /** Seats are held the moment the deposit page opens; the hold is what the
   *  countdown ticks down. When it lapses the departure reopens to everyone. */
  const [reservation, setReservation] = useState<{
    bookingId: string;
    checkoutUrl: string | null;
    holdExpiresAt: string | null;
  } | null>(null);
  const [holdLeft, setHoldLeft] = useState<number | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [checkoutStartedAt, setCheckoutStartedAt] = useState<number | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [released, setReleased] = useState(false);
  const [stars, setStars] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [toast, setToast] = useState("");

  const instantBook = svc.instant_book !== false;
  const seatsLeft = slot?.seatsLeft ?? 0;
  const cap = Math.max(1, Math.min(svc.capacity ?? 8, seatsLeft || svc.capacity || 8));
  /** Marina slips are priced per night and can flip to a monthly rate. */
  const isSlip = (svc as any).kind === "slip_rental";
  const slipInfo = ((svc as any).slip ?? null) as {
    slip_number?: string | null;
    nightly_rate_cents?: number | null;
    monthly_rate_cents?: number | null;
  } | null;
  const [nights, setNights] = useState(1);
  /** The listed fee is the price of the whole trip — it is NOT multiplied by party size. */
  const nightlyPrice = slot?.priceCents ?? svc.base_price_cents ?? 0;
  const monthlyRate = slipInfo?.monthly_rate_cents ?? 0;
  /** 28+ nights get the monthly rate pro-rated when it beats paying nightly. */
  const monthlyPrice =
    isSlip && nights >= 28 && monthlyRate > 0 ? Math.round((monthlyRate / 30) * nights) : null;
  const nightlyTotal = nightlyPrice * (isSlip ? nights : 1);
  const monthlyApplies = monthlyPrice != null && monthlyPrice < nightlyTotal;
  const price = isSlip ? (monthlyApplies ? monthlyPrice! : nightlyTotal) : nightlyPrice;
  const addonLines = addons
    .filter((a) => selectedAddons.includes(a.id))
    .map((a) => {
      const quantity = a.unit === "per_person" ? party : 1;
      return { ...a, quantity, lineCents: a.price_cents * quantity };
    });
  const addonCents = addonLines.reduce((s, l) => s + l.lineCents, 0);
  const fee = 0;
  const total = price + addonCents + fee;

  /** Deposit rate = min(max(business.deposit_rate, business.commission_rate), 1.0) — matches reserve_slot. */
  const depositRate = (() => {
    const b = svc.business as { deposit_rate?: number | null; commission_rate?: number | null } | null;
    const dr = Number(b?.deposit_rate ?? 0.25);
    const cr = Number(b?.commission_rate ?? 0);
    return Math.min(Math.max(dr, cr), 1.0);
  })();
  const deposit = Math.round(total * depositRate);
  const balanceDue = total - deposit;


  const durLabel = svc.duration_minutes ? `${Math.round(svc.duration_minutes / 60)} hrs` : "half day";
  const date = slot ? slot.startsAt.slice(0, 10) : "";
  const time = slot ? new Date(slot.startsAt).toISOString().slice(11, 16) : "";
  const dateLabel = useMemo(() => {
    if (!slot) return "No dates released";
    return new Date(slot.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }, [slot]);


  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  const createBookingRPC = useServerFn(createBookingFromService);
  // The key is derived from exactly what's being bought, so re-entering the
  // deposit step with an unchanged selection returns the SAME booking instead
  // of stacking a second hold on the departure. A genuinely new attempt (a
  // fresh seed after a conflict) rolls the key over, and the server releases
  // this angler's previous unpaid hold before creating the new one.
  const [attemptSeed, setAttemptSeed] = useState(() => crypto.randomUUID());
  const attemptKey = useMemo(() => {
    const sig = [slotId, party, nights, [...selectedAddons].sort().join("|"), notes.trim()].join("~");
    let h = 5381;
    for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) >>> 0;
    return `${attemptSeed}-${h.toString(36)}`;
  }, [attemptSeed, slotId, party, nights, selectedAddons, notes]);

  const placeMut = useMutation({
    mutationFn: () => {
      if (!slot) throw new Error("Pick an available departure first.");
      return toError(createBookingRPC({
        data: {
          slotId: slot.id,
          partySize: party,
          ...(isSlip && nights > 1 ? { nights } : {}),
          idempotencyKey: attemptKey,
          addonIds: selectedAddons,
          notes: notes.trim() || undefined,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      }));
    },

    onMutate: () => { setProcessing(true); setPayBlocked(null); setHoldError(null); },
    onSuccess: (res) => {
      // Seats are now locked to this angler until the hold lapses.
      setReservation({
        bookingId: res.bookingId,
        checkoutUrl: res.checkoutUrl ?? null,
        holdExpiresAt: res.holdExpiresAt ?? null,
      });
      setProcessing(false);
      setHoldError(null);
    },
    onError: (e: unknown) => {
      setProcessing(false);
      const msg = e instanceof Error ? e.message : String(e ?? "Booking failed");
      if (/payment setup|accepting payments|payment verification/i.test(msg)) {
        setPayBlocked(msg);
        setStep("checkout");
        window.scrollTo(0, 0);
        showToast(msg);
        return;
      }
      if (SLOT_CONFLICT.test(msg)) {

        // Someone locked this exact departure first — refresh availability and
        // show the recovery screen instead of a raw error toast.
        setTakenSlot({ label: `${dateLabel}${time ? ` · ${time}` : ""}` });
        setAttemptSeed(crypto.randomUUID());
        void qc.invalidateQueries({ queryKey: ["checkout", serviceId] });
        setStep("slot_taken");
        window.scrollTo(0, 0);
        return;
      }
      if (/ADDON_UNAVAILABLE/i.test(msg)) {
        void qc.invalidateQueries({ queryKey: ["addon-availability", serviceId] });
        setStep("extras");
        showToast(msg.replace(/^.*ADDON_UNAVAILABLE:\s*/i, ""));
        window.scrollTo(0, 0);
        return;
      }
      setHoldError(msg);
      showToast(msg);
    },
  });

  // Returning from Stripe Checkout.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid") === "1" && q.get("booking_id")) {
      setConfirmedId(q.get("booking_id"));
      setStep("confirmed");
      window.scrollTo(0, 0);
    } else if (q.get("canceled") === "1") {
      showToast("Payment canceled — your trip wasn't booked.");
    }
  }, []);


  useEffect(() => { if (party > cap) setParty(cap); }, [party, cap]);
  // Drop any extra that the captain can no longer fulfil on this departure.
  useEffect(() => {
    if (!addonAvail?.length) return;
    const blocked = new Set(addonAvail.filter((r) => !r.available).map((r) => r.id));
    setSelectedAddons((cur) => (cur.some((id) => blocked.has(id)) ? cur.filter((id) => !blocked.has(id)) : cur));
  }, [addonAvail]);
  // Changing what you're buying starts a fresh reservation attempt.
  useEffect(() => {
    // Any change to what's being bought invalidates the existing hold; the key
    // is derived from the selection, so no new seed is needed here.
    setReservation(null);
    setHoldLeft(null);
    setHoldError(null);
    setCheckoutStartedAt(null);
  }, [slotId, party, selectedAddons, notes]);

  // Track when checkout step is entered to start the countdown immediately
  useEffect(() => {
    if (step === "checkout") {
      setCheckoutStartedAt((cur) => cur ?? Date.now());
    } else {
      setCheckoutStartedAt(null);
      setHoldError(null);
    }
  }, [step]);

  // Opening the deposit page locks the departure for 15 minutes.
  useEffect(() => {
    if (step !== "checkout") return;
    if (reservation || placeMut.isPending || holdError) return;
    if (!slot) return;
    placeMut.mutate();
  }, [step, reservation, slot?.id, holdError]);

  // Live countdown on the hold. Synchronizes with server holdExpiresAt or counts down from entering checkout.
  useEffect(() => {
    if (step !== "checkout") {
      setHoldLeft(null);
      return;
    }

    const calculateRemaining = () => {
      if (reservation?.holdExpiresAt) {
        const end = new Date(reservation.holdExpiresAt).getTime();
        if (!isNaN(end)) {
          return Math.max(0, Math.round((end - Date.now()) / 1000));
        }
      }
      const startTime = checkoutStartedAt ?? Date.now();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      return Math.max(0, 15 * 60 - elapsed);
    };

    setHoldLeft(calculateRemaining());
    const t = setInterval(() => {
      setHoldLeft(calculateRemaining());
    }, 1000);

    return () => clearInterval(t);
  }, [step, reservation?.holdExpiresAt, checkoutStartedAt]);

  const holdExpired = holdLeft === 0;
  const holdClock =
    holdLeft == null ? "15:00" : `${Math.floor(holdLeft / 60)}:${String(holdLeft % 60).padStart(2, "0")}`;




  const crumbStyle = (k: Step | "results"): CSSProperties => {
    const order = STEP_ORDER;
    const i = order.indexOf(k);
    const cur = order.indexOf(step);
    const done = i < cur, active = i === cur;
    return { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: done ? V.sand : active ? "#fff" : V.ondmut };
  };
  const crumbNumStyle = (k: Step | "results", n: number): { style: CSSProperties; label: string } => {
    const order = STEP_ORDER;
    const i = order.indexOf(k);
    const cur = order.indexOf(step);
    const done = i < cur, active = i === cur;
    return {
      style: {
        width: 20, height: 20, borderRadius: "50%",
        background: done || active ? V.sand : "rgba(255,255,255,.1)",
        color: done || active ? "#04121B" : V.ondmut,
        display: "grid", placeItems: "center", fontSize: 11,
      },
      label: done ? "✓" : String(n),
    };
  };

  // The angler stays on the listing they opened; switching trip packages only
  // swaps price/duration/departures, never the listing identity or photos.
  const listingId = baseId ?? serviceId;
  const entry = (packages.find((p) => p.id === listingId) ?? null) as
    | { id: string; title: string; hero_url?: string | null }
    | null;
  const listingTitle = entry?.title ?? svc.title;
  const heroUrl = entry?.hero_url || svc.hero_url || business?.hero_url || DEFAULT_HERO;
  const businessLine = `${business?.name ?? "Captain"} · ${[business?.city, business?.region].filter(Boolean).join(", ") || "Coastal"}`;

  const isDetail = step === "detail";
  // Surface the captain's real boat photos when available, then fall back to the
  // platform's stock gallery so every listing still shows a rich hero.
  const boatImgs = [
    ...(boat?.hero_image_url ? [boat.hero_image_url] : []),
    ...(boat?.image_urls ?? []),
  ].filter((u, idx, a) => u && a.indexOf(u) === idx);
  const galleryUrls = [
    heroUrl,
    ...(boatImgs.length
      ? boatImgs.filter((u) => u !== heroUrl)
      : galleryFor(listingId, 7).filter((u) => u !== heroUrl)),
  ].slice(0, 8);
  // Only three tiles are shown; the third carries a "+N photos" overlay.
  const visibleTiles = galleryUrls.slice(0, 3);
  const hiddenCount = Math.max(galleryUrls.length - visibleTiles.length, 0);

  const alternativeSlots = openSlots
    .filter((s) => s.id !== slotId && s.seatsLeft > 0)
    .slice(0, 4);

  const locationLine =
    svc.departure_location || [business?.city, business?.region].filter(Boolean).join(" · ") || "Coastal marina";
  const capacity = svc.capacity ?? cap;
  const targetSpecies = (svc as any).target_species as string[] | null;
  const waterType = (svc as any).water_type as string | null;
  const specs = [
    { k: "Duration", v: svc.duration_minutes ? `${Math.round(svc.duration_minutes / 60)} Hours` : "Full day" },
    { k: "Max capacity", v: `${capacity} Anglers` },
    { k: "Tackle included", v: (svc.includes && svc.includes[0]) || "Rods & live bait" },
    ...(waterType ? [{ k: "Water type", v: waterType }] : []),
    ...(targetSpecies && targetSpecies.length ? [{ k: "Target species", v: targetSpecies.join(", ") }] : []),
  ];
  const amenities =
    svc.includes && svc.includes.length > 1
      ? svc.includes
      : ["Garmin Radar/Sonar", "Live Bait Well", "Shade Top", "Trophy Tackle Provided", "Ice Box", "Safety Gear"];

  return (
    <div style={{ minHeight: "100vh", background: V.paper, color: V.ink, fontFamily: V.sans }}>

      {/* TOP BAR */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: V.navy, color: V.ond }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px", height: 64, display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: V.ond }}>
            <span style={{ width: 11, height: 11, background: V.sand, transform: "rotate(45deg)", display: "inline-block", borderRadius: 1 }} />
            <span style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 20, letterSpacing: ".02em", whiteSpace: "nowrap" }}>FISH-X.COM</span>
          </Link>
          <div style={{ margin: "0 auto", display: "flex", alignItems: "center", gap: 8 }}>
            {CRUMBS.map((c, i) => (
              <span key={c.k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={crumbStyle(c.k)}>
                  <span style={crumbNumStyle(c.k, i + 1).style}>{crumbNumStyle(c.k, i + 1).label}</span> {c.label}
                </span>
                {i < CRUMBS.length - 1 && <span style={{ width: 22, height: 1, background: V.lined }} />}
              </span>
            ))}
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${V.lined}`, borderRadius: 30, padding: "8px 13px", fontSize: 11.5, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.cyan, boxShadow: `0 0 8px ${V.cyan}` }} /> Secured by escrow
          </span>
        </div>
      </header>

      <main
        className="fx-booking-main"
        style={
          isDetail
            ? { width: "100%", margin: 0, padding: "26px 40px 80px" }
            : { maxWidth: 1180, margin: "0 auto", padding: "28px 28px 60px" }
        }
      >
        {/* ==== DETAIL ==== */}
        {step === "detail" && (
          <div>
            <Link
              to="/dashboard"
              search={{ tab: "explore" }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, color: V.tmut, fontSize: 13.5, fontWeight: 600, textDecoration: "none", marginBottom: 18 }}
            >
              ← Back to charters
            </Link>

            {/* TITLE BLOCK */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: V.cyan, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", marginBottom: 10 }}>
              <span>◉</span> {locationLine}
            </div>
            <h1 style={{ fontFamily: V.serif, fontWeight: 700, fontSize: "clamp(34px,5vw,58px)", lineHeight: 1.02, margin: "0 0 14px", color: V.ink }}>
              {listingTitle}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13.5, marginBottom: 26 }}>
              <span style={{ color: V.sand }}>★ 4.98 <span style={{ opacity: 0.8 }}>(42 reviews)</span></span>
              <span style={{ color: V.tmut }}>·</span>
              <span style={{ color: V.cyan }}>Captain: {business?.name ?? "Fish-X operator"}</span>
              <span style={{ color: V.tmut }}>·</span>
              <span style={{ color: V.green }}>⛊ USCG Verified Charter</span>
            </div>

            {/* GALLERY */}
            <div className="fx-booking-gallery" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginBottom: 34 }}>
              <MediaImg
                src={visibleTiles[0]}
                alt={listingTitle ?? "Charter"}
                style={{ width: "100%", height: 520, objectFit: "cover", borderRadius: 14, border: `1px solid ${V.line}` }}
              />
              <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 18 }}>
                {visibleTiles.slice(1).map((u, i) => {
                  const isLast = i === visibleTiles.length - 2;
                  return (
                    <div key={i} style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: `1px solid ${V.line}` }}>
                      <MediaImg src={u} alt="" style={{ width: "100%", height: 251, objectFit: "cover", display: "block" }} />
                      {isLast && hiddenCount > 0 && (
                        <div
                          style={{
                            position: "absolute", inset: 0, background: "rgba(8,20,32,.62)",
                            display: "grid", placeItems: "center", gap: 4, color: "#fff",
                            backdropFilter: "blur(1.5px)",
                          }}
                        >
                          <span style={{ fontFamily: V.serif, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>+{hiddenCount}</span>
                          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: V.sand }}>
                            More photos
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BODY + RAIL */}
            <div className="fx-booking-grid" style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 30, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {/* Trip packages offered by this operator */}
                {packages.length > 1 && (
                  <section style={cardLight}>
                    <h2 style={h2Light}>Choose your trip package</h2>
                    <div style={{ display: "grid", gap: 12 }}>
                      {packages.map((p) => {
                        const active = p.id === svc.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              if (!active)
                                navigate({
                                  to: "/booking",
                                  search: { service_id: p.id, base: listingId },
                                  replace: true,
                                  resetScroll: false,
                                });
                            }}
                            style={{
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: 16,
                              background: active ? "rgba(45,226,242,.16)" : V.paper,
                              border: `1px solid ${active ? "rgba(45,226,242,.55)" : V.line}`,
                              borderRadius: 14,
                              padding: "16px 18px",
                              cursor: active ? "default" : "pointer",
                              color: V.ink,
                            }}
                          >
                            <span
                              style={{
                                width: 18, height: 18, borderRadius: "50%", flex: "none",
                                border: `2px solid ${active ? V.sand : V.line}`,
                                background: active ? V.sand : "transparent",
                              }}
                            />
                            <span style={{ flex: 1 }}>
                              <span style={{ display: "block", fontFamily: V.serif, fontSize: 20, fontWeight: 700, color: V.ink }}>{p.title}</span>
                              <span style={{ display: "block", fontFamily: MONO, fontSize: 12.5, color: V.cyan, marginTop: 4 }}>
                                {p.duration_minutes ? `${Math.round(p.duration_minutes / 60)} hrs` : "Full day"} · up to {p.capacity ?? svc.capacity ?? 6} anglers
                              </span>
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: V.ink, whiteSpace: "nowrap" }}>
                              {money(p.base_price_cents)}<span style={{ fontSize: 11.5, color: V.tmut }}> / trip</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Charter overview */}

                <section style={cardLight}>
                  <h2 style={h2Light}>Charter Overview</h2>
                  <p style={{ fontSize: 15.5, lineHeight: 1.7, color: V.tmut, margin: "0 0 22px", maxWidth: 760 }}>
                    {(svc as any).description
                      ? (svc as any).description
                      : `Experience a world-class day on the water with ${business?.name ?? "this operator"} out of ${locationLine}. Every booking is protected by Fish-X escrow — your payment is only released to the captain after the trip is complete.`}
                  </p>
                  <div className="fx-spec-strip" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, border: `1px solid ${V.line}`, borderRadius: 12, padding: "18px 22px" }}>
                    {specs.map((s) => (
                      <div key={s.k}>
                        <div style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: V.tmut, marginBottom: 6 }}>{s.k}</div>
                        <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 15, fontWeight: 600, color: V.cyan }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Vessel specifications */}
                <section style={cardLight}>
                  <h2 style={h2Light}>Vessel Specifications</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
                    <span style={{ width: 54, height: 54, borderRadius: 12, background: "rgba(45,226,242,.14)", color: V.sand, display: "grid", placeItems: "center", fontSize: 24, flex: "none" }}>⚓</span>
                    <div>
                      {boat?.name && (
                        <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 700, color: V.ink }}>{boat.name}</div>
                      )}
                      {boat?.make && boat?.model && (
                        <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13.5, color: V.cyan, marginTop: 3 }}>{boat.make} {boat.model}</div>
                      )}
                      {boat?.capacity !== undefined && (
                        <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13.5, color: V.cyan, marginTop: 3 }}>Capacity: {boat.capacity ?? capacity} anglers</div>
                      )}
                    </div>
                  </div>
                  <div className="fx-amenities" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "13px 26px" }}>
                    {boat?.description ? (
                      <div key="desc" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, color: V.ink }}>
                        <span style={{ color: V.green, flex: "none" }}>⊘</span>
                        {boat.description}
                      </div>
                    ) : (
                      amenities.slice(0, 8).map((a) => (
                        <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, color: V.ink }}>
                          <span style={{ color: V.green, flex: "none" }}>⊘</span>
                          {a}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Captain */}
                <section style={cardLight}>
                  <h2 style={h2Light}>Your Captain</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    {business?.logo_url ? (
                      <MediaImg src={business.logo_url} alt="" style={{ width: 66, height: 66, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                    ) : (
                      <div style={{ width: 66, height: 66, borderRadius: "50%", background: V.ond, color: V.sand, display: "grid", placeItems: "center", fontFamily: V.serif, fontSize: 26, flex: "none" }}>
                        {(business?.name ?? "F").slice(0, 1)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: V.serif, fontSize: 21, fontWeight: 700, color: V.ink }}>{business?.name ?? "Fish-X operator"}</div>
                      <div style={{ fontSize: 13.5, color: V.tmut, marginTop: 3 }}>Verified operator · Escrow protected · Responds within an hour</div>
                    </div>
                    {business?.slug && (
                      <Link to="/b/$slug" params={{ slug: business.slug }} style={{ border: `1px solid ${V.line}`, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, color: V.ink, textDecoration: "none", whiteSpace: "nowrap" }}>
                        View profile
                      </Link>
                    )}
                  </div>
                </section>

                {/* Escrow explainer */}
                <section style={cardLight}>
                  <h2 style={h2Light}>How Payment Works</h2>
                  <div className="fx-escrow-steps" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
                    {[
                      ["1", "You pay", "Funds are captured and held by Fish-X — never sent straight to the captain."],
                      ["2", "You fish", "The captain runs the trip. Anything goes wrong, open a resolution case."],
                      ["3", "Captain paid", "Escrow releases 72 hours after the trip is marked complete."],
                    ].map(([n, t, d]) => (
                      <div key={n} style={{ border: `1px solid ${V.line}`, borderRadius: 12, padding: 18 }}>
                        <span style={{ width: 26, height: 26, borderRadius: "50%", background: V.sand, color: "#04121B", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{n}</span>
                        <div style={{ fontSize: 15, fontWeight: 700, color: V.ink, margin: "12px 0 6px" }}>{t}</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: V.tmut }}>{d}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* BOOKING RAIL */}
              <div className="fx-booking-rail" style={{ position: "sticky", top: 84, background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24, boxShadow: "0 24px 50px -34px rgba(13,34,54,.4)" }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 32, fontWeight: 700, color: V.ink }}>{money(slot?.priceCents ?? svc.base_price_cents ?? 0)}</span>
                  <span style={{ fontSize: 13, color: V.tmut }}>/ trip · {durLabel}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: V.green, background: "rgba(78,201,142,.12)", border: "1px solid rgba(78,201,142,.35)", borderRadius: 6, padding: "6px 9px", whiteSpace: "nowrap" }}>
                    Escrow guaranteed
                  </span>
                </div>

                <div
                  style={{
                    marginBottom: 18,
                    border: `1px solid ${V.line}`,
                    borderRadius: 12,
                    padding: "13px 15px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.cyan }}>
                    Departure
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: V.ink }}>
                    {slot ? `${dateLabel}` : "Not selected yet"}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.tmut }}>
                    {slot ? timeBlock(slot) : `${openSlots.length} open departure${openSlots.length === 1 ? "" : "s"}`}
                  </span>
                </div>





                <label style={{ display: "block", marginBottom: 22 }}>
                  <span style={railLabel}>Number of anglers (max {cap})</span>
                  <select value={party} onChange={(e) => setParty(Number(e.target.value))} style={railField}>
                    {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} style={{ color: "#072057" }}>{n} {n === 1 ? "Angler" : "Anglers"}</option>
                    ))}
                  </select>
                </label>

                <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 16, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: V.tmut }}>
                    <span>Trip fee ({party} angler{party === 1 ? "" : "s"})</span><span style={{ color: V.ink }}>{money(price)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: V.tmut }}>
                    <span>Fish-X booking fee</span><span style={{ color: V.green }}>$0 (Waived)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px", borderTop: `1px solid ${V.line}`, marginTop: 10, fontSize: 15.5, fontWeight: 700, color: V.ink }}>
                    <span>Deposit due today (25%)</span><span>{money(deposit)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: V.tmut }}>
                    <span>Balance paid to captain on the day</span><span style={{ color: V.ink }}>{money(balanceDue)}</span>
                  </div>
                </div>


                <button
                  onClick={() => { setStep("dates"); window.scrollTo(0, 0); }}
                  disabled={openSlots.length === 0}
                  style={{ width: "100%", background: openSlots.length ? `linear-gradient(180deg, ${V.sandsoft}, ${V.sand})` : "#dfe6ec", color: openSlots.length ? "#04121B" : V.tmut, border: 0, borderRadius: 12, padding: 16, fontFamily: V.sans, fontSize: 15, fontWeight: 700, cursor: openSlots.length ? "pointer" : "not-allowed", margin: "20px 0 12px" }}
                >
                  {openSlots.length ? (slot ? "Change date & time →" : "Check availability →") : "No dates available"}
                </button>


                <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 11.5, color: V.tmut, textAlign: "center", lineHeight: 1.5 }}>
                  {instantBook
                    ? "Seats held for 15 minutes. Funds released after your trip."
                    : "Card authorised, not charged — the captain has 24 hours to accept."}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ==== DATE & TIME BLOCK ==== */}
        {step === "dates" && (
          <div>
            {storefrontSlug ? (
              <Link
                to="/b/$slug"
                params={{ slug: storefrontSlug }}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, color: V.tmut, fontSize: 13.5, fontWeight: 600, textDecoration: "none", marginBottom: 16 }}
              >
                ← Back to storefront
              </Link>
            ) : (
              <button onClick={() => { setStep("detail"); window.scrollTo(0, 0); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: 0, color: V.tmut, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>← Back to trip</button>
            )}
            <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 34, margin: "0 0 6px" }}>Select date &amp; time</h1>
            <p style={{ fontSize: 14.5, color: V.tmut, margin: "0 0 24px", maxWidth: 620 }}>
              Only dates with an open departure are selectable. Each departure is an exclusive time
              block — once you take it, the boat is yours for that window.
            </p>

            <div className="fx-booking-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 30, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {isSlip ? (
                  <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                      <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600 }}>Length of stay</div>
                      <select
                        value={nights}
                        onChange={(e) => setNights(Number(e.target.value))}
                        style={{ background: V.paper, border: `1px solid ${V.line}`, borderRadius: 10, padding: "11px 13px", fontFamily: MONO, fontSize: 14, fontWeight: 600, color: V.ink, outline: "none" }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 28, 30, 60, 90].map((n) => (
                          <option key={n} value={n}>{n} {n === 1 ? "night" : "nights"}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: 13, color: V.tmut }}>
                      Pick your arrival night below — we hold every night through to departure.
                      {monthlyRate > 0 && (
                        <>
                          {" "}Stays of 28 nights or more switch to the monthly rate of {money(monthlyRate)}.
                        </>
                      )}
                    </div>
                    {monthlyApplies && (
                      <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#0F7B5F" }}>
                        Monthly rate applied — you save {money(nightlyTotal - price)}.
                      </div>
                    )}
                  </section>
                ) : (
                <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600 }}>Party size</div>
                    <select
                      value={party}
                      onChange={(e) => setParty(Number(e.target.value))}
                      style={{ background: V.paper, border: `1px solid ${V.line}`, borderRadius: 10, padding: "11px 13px", fontFamily: MONO, fontSize: 14, fontWeight: 600, color: V.ink, outline: "none" }}
                    >
                      {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n} {n === 1 ? "Angler" : "Anglers"}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: 13, color: V.tmut }}>
                    Up to {capacity} aboard, including non-fishing guests. The trip fee is flat — it
                    doesn&rsquo;t change with party size.
                  </div>
                </section>
                )}


                <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 24 }}>
                  <PublicAvailabilityCalendar
                    serviceId={serviceId}
                    selectedSlotId={slot?.id ?? null}
                    partySize={party}
                    theme="light"
                    onSelectSlot={(s: PublicSlot) => setSlotId(s.id)}
                  />
                </section>
              </div>

              {/* Persistent trip card */}
              <div style={{ position: "sticky", top: 88, background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24, boxShadow: "0 24px 50px -34px rgba(13,34,54,.4)" }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.tmut, marginBottom: 8 }}>Your trip</div>
                <div style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 23, lineHeight: 1.15 }}>{listingTitle}</div>
                <div style={{ fontSize: 13, color: V.tmut, margin: "4px 0 16px" }}>{businessLine}</div>

                {[
                  ["Duration", durLabel],
                  ["Date", slot ? dateLabel : "Not selected"],
                  ["Departure", slot ? timeBlock(slot) : "Not selected"],
                  isSlip ? ["Nights", `${nights}`] : ["Party size", `${party}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, padding: "7px 0", color: V.tmut }}>
                    <span>{k}</span><span style={{ color: V.ink, fontWeight: 600, textAlign: "right" }}>{v}</span>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "12px 0", borderTop: `1px solid ${V.line}`, marginTop: 8 }}>
                  <span>Trip total</span><span style={{ fontFamily: V.serif, fontSize: 22 }}>{money(price)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: V.tmut, padding: "2px 0" }}>
                  <span>Deposit today (25%)</span><span style={{ fontWeight: 700, color: V.ink }}>{money(deposit)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: V.tmut, padding: "2px 0 16px" }}>
                  <span>Balance at the dock</span><span style={{ color: V.ink }}>{money(balanceDue)}</span>
                </div>

                <button
                  onClick={() => { setStep("extras"); window.scrollTo(0, 0); }}
                  disabled={!slot}
                  style={{ width: "100%", background: slot ? V.sand : "#dfe6ec", color: slot ? "#04121B" : V.tmut, border: 0, borderRadius: 12, padding: 15, fontFamily: V.sans, fontSize: 14, fontWeight: 700, cursor: slot ? "pointer" : "not-allowed" }}
                >
                  Continue to add-ons →
                </button>
                {!slot && (
                  <div style={{ fontSize: 12, color: V.tmut, textAlign: "center", marginTop: 9 }}>
                    Select a departure time to continue.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==== ADD-ONS & NOTES ==== */}

        {step === "extras" && (
          <div>
            <button onClick={() => { setStep("dates"); window.scrollTo(0, 0); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: 0, color: V.tmut, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>← Back to date &amp; time</button>
            <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 34, margin: "0 0 6px" }}>Add-ons &amp; notes</h1>
            <p style={{ fontSize: 14.5, color: V.tmut, margin: "0 0 24px" }}>
              {dateLabel}{time ? ` · ${time}` : ""} · {party} angler{party === 1 ? "" : "s"} · {svc.title}
            </p>

            <div className="fx-booking-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 30, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {addons.length > 0 && (
                  <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 24 }}>
                    <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Optional extras</div>
                    <div style={{ fontSize: 13, color: V.tmut, marginBottom: 16 }}>Added to your trip total — the deposit is recalculated automatically.</div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {addons.map((a) => {
                        const rule = addonRule(a.id);
                        const blocked = !rule.available;
                        const on = selectedAddons.includes(a.id) && !blocked;
                        const qty = a.unit === "per_person" ? party : 1;
                        return (
                          <label
                            key={a.id}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 13,
                              cursor: blocked ? "not-allowed" : "pointer",
                              opacity: blocked ? 0.55 : 1,
                              background: on ? "#f3f8fa" : V.paper,
                              border: `1px solid ${on ? "rgba(31,159,190,.5)" : V.line}`,
                              borderRadius: 13, padding: "14px 16px",
                            }}
                          >
                            <input type="checkbox" disabled={blocked} checked={on} onChange={() => toggleAddon(a.id)} style={{ marginTop: 3, accentColor: V.cyan, width: 17, height: 17 }} />
                            <span style={{ flex: 1 }}>
                              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{a.title}</span>
                              {a.description && <span style={{ display: "block", fontSize: 12.5, color: V.tmut, marginTop: 3, lineHeight: 1.5 }}>{a.description}</span>}
                              <span style={{ display: "block", fontSize: 11.5, color: V.tmut, marginTop: 4 }}>
                                {a.unit === "per_person" ? `Per angler · ×${qty}` : "Per trip"}
                                {!blocked && rule.remaining != null && rule.remaining <= 3
                                  ? ` · only ${rule.remaining} left on this departure`
                                  : ""}
                              </span>
                              {blocked && (
                                <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#b3261e", marginTop: 5 }}>
                                  {rule.reason ?? "Not available on this departure."}
                                </span>
                              )}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{money(a.price_cents * qty)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Note to captain */}
                <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 24 }}>
                  <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
                    Note to {business?.name ?? "your captain"}
                  </div>
                  <p style={{ fontSize: 13.5, color: V.tmut, lineHeight: 1.6, margin: "0 0 14px" }}>
                    What are you hoping to target? How much experience is in your group? Anyone prone to seasickness, kids aboard, or a milestone you're celebrating?
                  </p>
                  <textarea
                    value={notes}
                    maxLength={500}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Tell your captain anything that will make the day better…"
                    style={{ width: "100%", background: V.paper, border: `1px solid ${V.line}`, borderRadius: 12, padding: "13px 15px", fontFamily: V.sans, fontSize: 14, lineHeight: 1.6, color: V.ink, outline: "none", resize: "vertical" }}
                  />
                  <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 11.5, color: V.tmut, marginTop: 6 }}>{notes.length} / 500</div>
                </section>

                {/* Cancellation policy */}
                <section style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 24 }}>
                  <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Cancellation policy</div>
                  <div style={{ fontSize: 13, color: V.tmut, marginBottom: 16 }}>The same three rules apply to every FishX booking.</div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {CANCELLATION_RULES.map(([t, d], i) => (
                      <div key={t} style={{ display: "flex", gap: 13, alignItems: "flex-start", background: V.paper, borderRadius: 13, padding: "14px 16px" }}>
                        <span style={{ width: 24, height: 24, flex: "none", borderRadius: "50%", background: V.navy, color: "#fff", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 700 }}>{i + 1}</span>
                        <span>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t}</span>
                          <span style={{ display: "block", fontSize: 12.5, color: V.tmut, lineHeight: 1.55, marginTop: 3 }}>{d}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Running total */}
              <div style={{ position: "sticky", top: 88, background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24, boxShadow: "0 24px 50px -34px rgba(13,34,54,.4)" }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.tmut, marginBottom: 8 }}>Your trip</div>
                <div style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 23, lineHeight: 1.15 }}>{listingTitle}</div>
                <div style={{ fontSize: 13, color: V.tmut, margin: "4px 0 14px" }}>{businessLine}</div>
                <div style={{ fontSize: 13, color: V.tmut, paddingBottom: 12, borderBottom: `1px solid ${V.line}` }}>
                  {slot ? `${dateLabel} · ${timeBlock(slot)}` : "No departure selected"} · {party} aboard
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "10px 0 7px", color: V.tmut }}>
                  <span>Trip fee</span><span style={{ color: V.ink }}>{money(price)}</span>
                </div>
                {addonLines.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "7px 0", color: V.tmut }}>
                    <span>{l.title}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span><span style={{ color: V.ink }}>{money(l.lineCents)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "12px 0", borderTop: `1px solid ${V.line}`, marginTop: 5 }}>
                  <span>Trip total</span><span>{money(total)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: V.tmut, padding: "2px 0 14px" }}>
                  <span>Deposit due today (25%)</span><span style={{ fontWeight: 700, color: V.ink }}>{money(deposit)}</span>
                </div>
                <button
                  onClick={() => { setStep("checkout"); window.scrollTo(0, 0); }}
                  style={{ width: "100%", background: V.sand, color: "#04121B", border: 0, borderRadius: 12, padding: 15, fontFamily: V.sans, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Continue to deposit →
                </button>
                <button
                  onClick={() => { setStep("dates"); window.scrollTo(0, 0); }}
                  style={{ width: "100%", background: "transparent", color: V.tmut, border: `1px solid ${V.line}`, borderRadius: 12, padding: 13, fontFamily: V.sans, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginTop: 10 }}
                >
                  ← Back to date &amp; time
                </button>
              </div>
            </div>
          </div>
        )}




        {/* ==== CHECKOUT ==== */}
        {step === "checkout" && (
          <div>
            <button onClick={() => setStep("extras")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: 0, color: V.tmut, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>← Back to add-ons</button>
            <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 34, margin: "0 0 6px" }}>Pay your deposit</h1>
            <p style={{ fontSize: 14.5, color: V.tmut, margin: "0 0 18px" }}>
              You pay 25% now to lock the boat. The rest goes to your captain at the dock.
            </p>

            {payBlocked && (
              <div style={{ background: "#fff4f2", border: "1px solid rgba(190,60,40,.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>This operator can't take payments yet</div>
                <div style={{ fontSize: 13.5, color: V.tmut }}>{payBlocked} Try another trip, or message the operator to finish their payment setup.</div>
              </div>
            )}

            {holdError && (
              <div style={{ background: "#fff4f2", border: "1px solid rgba(190,60,40,.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4, color: "#be3c28" }}>Unable to hold departure</div>
                  <div style={{ fontSize: 13.5, color: V.tmut }}>{holdError}</div>
                </div>
                <button
                  onClick={() => { setHoldError(null); placeMut.mutate(); }}
                  style={{ background: V.navy, color: "#fff", border: 0, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Retry hold
                </button>
              </div>
            )}


            {/* Hold countdown — the departure is off the market while it runs. */}
            {!holdExpired && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  background: "#fdf5e6", border: "1px solid rgba(169,126,60,.35)",
                  borderRadius: 14, padding: "14px 18px", marginBottom: 20,
                }}
              >
                <span style={{ color: V.goldtext, fontSize: 16 }}>⏱</span>
                <span style={{ fontSize: 13.5, color: V.goldtext, fontWeight: 600, flex: 1, minWidth: 240 }}>
                  {placeMut.isPending || !reservation
                    ? "Holding this departure for you…"
                    : "This departure is held for you. No one else can book this boat for this window."}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: holdLeft != null && holdLeft < 120 ? "#c2603f" : V.goldtext, letterSpacing: ".04em" }}>
                  {holdClock}
                </span>
              </div>
            )}

            {holdExpired && (
              <div
                style={{
                  background: "#fff", border: "1px solid rgba(194,96,63,.4)", borderRadius: 16,
                  padding: "18px 20px", marginBottom: 20, display: "grid", gap: 6,
                }}
              >
                <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600 }}>Your 15-minute hold expired</div>
                <div style={{ fontSize: 13.5, color: V.tmut, lineHeight: 1.6 }}>
                  Nothing was charged and this departure is back on sale for other anglers. Pick your
                  date and time again to start a fresh hold.
                </div>
                <button
                  onClick={() => {
                    setReservation(null);
                    setHoldLeft(null);
                    setAttemptSeed(crypto.randomUUID());
                    void qc.invalidateQueries({ queryKey: ["checkout", serviceId] });
                    setStep("dates");
                    window.scrollTo(0, 0);
                  }}
                  style={{ justifySelf: "start", marginTop: 8, background: V.navy, color: "#fff", border: 0, borderRadius: 11, padding: "12px 18px", fontFamily: V.sans, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Pick another departure
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 30, alignItems: "start" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {[
                  { n: 1, title: "Trip summary" },
                  { n: 2, title: "Your details" },
                  { n: 3, title: "Payment" },
                ].map((sec) => (
                  <div key={sec.n} style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: V.navy, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{sec.n}</span>
                      <span style={{ fontFamily: V.serif, fontSize: 20, fontWeight: 600 }}>{sec.title}</span>
                    </div>
                    {sec.n === 1 && (
                      <div style={{ display: "flex", gap: 16 }}>
                        <MediaImg src={heroUrl} alt="" style={{ width: 96, height: 74, borderRadius: 12, objectFit: "cover", flex: "none" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{svc.title}</div>
                          <div style={{ fontSize: 13, color: V.tmut, marginTop: 3 }}>{businessLine}</div>
                          <div style={{ fontSize: 13, color: V.tmut, marginTop: 6 }}>{dateLabel} · {time} · {party} anglers</div>
                          {addonLines.length > 0 && (
                            <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 6 }}>
                              Add-ons: {addonLines.map((l) => l.title).join(", ")}
                            </div>
                          )}
                          {notes.trim() && (
                            <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 6, fontStyle: "italic" }}>
                              “{notes.trim()}”
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {sec.n === 2 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={{ display: "block" }}>
                          <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: V.tmut, marginBottom: 6 }}>Full name</span>
                          <input defaultValue="Angler" style={{ width: "100%", background: V.paper, border: `1px solid ${V.line}`, borderRadius: 10, padding: "12px 13px", fontFamily: V.sans, fontSize: 14, color: V.ink, outline: "none" }} />
                        </label>
                        <label style={{ display: "block" }}>
                          <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: V.tmut, marginBottom: 6 }}>Email</span>
                          <input defaultValue="you@email.com" style={{ width: "100%", background: V.paper, border: `1px solid ${V.line}`, borderRadius: 10, padding: "12px 13px", fontFamily: V.sans, fontSize: 14, color: V.ink, outline: "none" }} />
                        </label>
                      </div>
                    )}
                    {sec.n === 3 && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: V.paper, border: `1px solid ${V.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                          <span style={{ fontSize: 20 }}>💳</span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Secure card payment via Stripe</div>
                            <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>You'll be taken to Stripe's hosted checkout to enter your card, then returned here.</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: V.cyansoft, borderRadius: 11, padding: "13px 15px" }}>
                          <span style={{ color: V.cyan, flex: "none", marginTop: 1 }}>🔒</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Charged to escrow — not the captain</div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: V.tmut, marginTop: 2 }}>Held by Fish-X and released to your captain 72 hours after the trip is completed.</div>
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                ))}
              </div>
              <div style={{ position: "sticky", top: 88, background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24, boxShadow: "0 24px 50px -34px rgba(13,34,54,.4)" }}>
                <div style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 20, marginBottom: 16 }}>Order summary</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "7px 0", color: V.tmut }}><span>Trip total</span><span style={{ color: V.ink }}>{money(price)}</span></div>
                {addonLines.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "7px 0", color: V.tmut }}><span>{l.title}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span><span style={{ color: V.ink }}>{money(l.lineCents)}</span></div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "7px 0", color: V.tmut }}><span>Fish-X service fee</span><span style={{ color: V.ink }}>Included</span></div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, padding: "12px 0", borderTop: `1px solid ${V.line}`, marginTop: 5 }}>
                  <span>Deposit due today (25%)</span><span style={{ fontFamily: V.serif, fontSize: 22 }}>{money(deposit)}</span>
                </div>
                <div style={{ margin: "6px 0 14px", padding: "12px 14px", border: "1px dashed rgba(31,159,190,.5)", borderRadius: 12, background: "#eef7fa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: V.tmut }}>Deposit held in escrow</span><span style={{ fontWeight: 700, color: V.cyan }}>{money(deposit)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 5 }}><span style={{ color: V.tmut }}>Balance to captain on the day</span><span style={{ fontWeight: 700 }}>{money(balanceDue)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 5 }}><span style={{ color: V.tmut }}>Deposit released to captain</span><span>3 days after your trip</span></div>
                  <div style={{ fontSize: 11.5, color: V.tmut, marginTop: 8, lineHeight: 1.5 }}>
                    Pay the balance directly to your captain — cash or card, and tips are customary. Anglers are responsible for their own fishing licenses.
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (holdError) {
                      setHoldError(null);
                      placeMut.mutate();
                      return;
                    }
                    if (!reservation) return;
                    if (reservation.checkoutUrl) {
                      window.location.href = reservation.checkoutUrl;
                      return;
                    }
                    // No Stripe configured (preview): the booking already settled.
                    setConfirmedId(reservation.bookingId);
                    setStep("confirmed");
                    window.scrollTo(0, 0);
                  }}
                  disabled={Boolean((!reservation && !holdError) || placeMut.isPending || holdExpired)}
                  style={{ width: "100%", background: (!reservation && !holdError) || holdExpired ? "#dfe6ec" : V.sand, color: (!reservation && !holdError) || holdExpired ? V.tmut : "#04121B", border: 0, borderRadius: 12, padding: 15, fontFamily: V.sans, fontSize: 13.5, fontWeight: 700, letterSpacing: ".05em", cursor: (!reservation && !holdError) || holdExpired ? "not-allowed" : "pointer", opacity: placeMut.isPending ? 0.7 : 1 }}
                >
                  {holdExpired
                    ? "Hold expired"
                    : holdError
                      ? "Retry holding departure"
                      : placeMut.isPending || !reservation
                        ? "Holding your seats…"
                        : `Pay ${money(deposit)} deposit`}
                </button>
                <div style={{ fontFamily: MONO, fontSize: 11.5, color: V.tmut, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
                  {holdExpired
                    ? "The departure reopened to other anglers."
                    : "Seats stay yours until the countdown ends."}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ==== SLOT TAKEN — recovery ==== */}
        {step === "slot_taken" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 76, height: 76, borderRadius: "50%", margin: "6px auto 20px",
                  background: "linear-gradient(150deg,#fdf1e2,#f6e2c6)",
                  border: "1px solid rgba(169,126,60,.28)",
                  display: "grid", placeItems: "center", fontSize: 30, color: V.goldtext,
                }}
              >
                ⚓
              </div>
              <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 38, lineHeight: 1.05, margin: "0 0 10px" }}>
                That slot just went
              </h1>
              <p style={{ fontSize: 15.5, color: V.tmut, lineHeight: 1.65, margin: "0 auto", maxWidth: 520 }}>
                Another angler locked this exact boat and departure time moments before you did.
                <b style={{ color: V.ink }}> Nothing was charged.</b>
              </p>
              {takenSlot && (
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9, marginTop: 16,
                    background: "#fff", border: `1px solid ${V.line}`, borderRadius: 999,
                    padding: "8px 16px", fontFamily: MONO, fontSize: 12.5, color: V.tmut,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c2603f" }} />
                  <s>{takenSlot.label}</s>
                  <span style={{ color: "#c2603f", fontWeight: 700 }}>FULL</span>
                </div>
              )}
            </div>

            <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 26, boxShadow: "0 26px 54px -38px rgba(13,34,54,.45)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <div style={{ fontFamily: V.serif, fontSize: 23, fontWeight: 600 }}>
                  Next open departures with this captain
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: V.cyan }}>
                  Live
                </span>
              </div>
              <p style={{ fontSize: 13, color: V.tmut, margin: "0 0 18px" }}>
                {business?.name ?? "This operator"} · {locationLine}
              </p>

              {alternativeSlots.length === 0 ? (
                <div style={{ background: V.paper, borderRadius: 14, padding: "22px 18px", textAlign: "center", fontSize: 13.5, color: V.tmut }}>
                  No other departures are released right now — message the captain and they'll open a date for you.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {alternativeSlots.map((s) => {
                    const d = new Date(s.startsAt);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSlotId(s.id);
                          setTakenSlot(null);
                          setReservation(null);
                          setHoldLeft(null);
                          setStep("checkout");
                          window.scrollTo(0, 0);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
                          background: V.paper, border: `1px solid ${V.line}`, borderRadius: 14,
                          padding: "14px 16px", cursor: "pointer", fontFamily: V.sans, color: V.ink,
                        }}
                      >
                        <span
                          style={{
                            width: 52, flex: "none", textAlign: "center", background: "#fff",
                            border: `1px solid ${V.line}`, borderRadius: 11, padding: "7px 0",
                          }}
                        >
                          <span style={{ display: "block", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: V.tmut }}>
                            {d.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span style={{ display: "block", fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>
                            {d.toLocaleDateString("en-US", { day: "numeric" })}
                          </span>
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>
                            {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span style={{ display: "block", fontSize: 13, color: V.tmut, marginTop: 2 }}>
                            {dayPart(d)} · {timeLabel(d)}
                          </span>
                        </span>
                        <span style={{ textAlign: "right", flex: "none" }}>
                          <span style={{ display: "block", fontFamily: MONO, fontSize: 12.5, color: s.seatsLeft <= 2 ? "#c2603f" : V.green, fontWeight: 700 }}>
                            {s.seatsLeft} seat{s.seatsLeft === 1 ? "" : "s"} open
                          </span>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 3 }}>
                            {money(s.priceCents)}<span style={{ color: V.tmut, fontWeight: 500 }}> / trip</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                <button
                  onClick={() => { setTakenSlot(null); setReservation(null); setHoldLeft(null); setStep("dates"); window.scrollTo(0, 0); }}
                  style={{ flex: "1 1 200px", background: V.sand, color: "#04121B", border: 0, borderRadius: 12, padding: 14, fontFamily: V.sans, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Pick another date
                </button>
                {business?.slug ? (
                  <Link
                    to="/b/$slug"
                    params={{ slug: business.slug }}
                    style={{ flex: "1 1 200px", textAlign: "center", background: "transparent", color: V.ink, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
                  >
                    Back to the captain
                  </Link>
                ) : (
                  <button
                    onClick={() => navigate({ to: "/discover" })}
                    style={{ flex: "1 1 200px", background: "transparent", color: V.ink, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14, fontFamily: V.sans, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    Back to browsing
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==== CONFIRMED ==== */}
        {step === "confirmed" && confirmedId && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <div style={{ width: 74, height: 74, borderRadius: "50%", background: V.greensoft, display: "grid", placeItems: "center", color: V.green, margin: "8px auto 18px", fontSize: 32 }}>✓</div>
              <h1 style={{ fontFamily: V.serif, fontWeight: 600, fontSize: 36, lineHeight: 1.05, margin: "0 0 8px" }}>You're booked — and protected.</h1>
              <p style={{ fontSize: 15.5, color: V.tmut, margin: 0 }}>Confirmation <b style={{ color: V.ink }}>#{confirmedId.slice(0, 8).toUpperCase()}</b></p>
            </div>

            {/* Escrow timeline */}
            <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 26, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: V.cyansoft, display: "grid", placeItems: "center", color: V.cyan, fontSize: 18 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: V.cyan }}>Escrow status</div>
                  <div style={{ fontFamily: V.serif, fontSize: 20 }}>{released ? "Trip complete — captain paid" : `Your ${money(deposit)} deposit is held safely`}</div>
                </div>
              </div>
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ position: "absolute", left: 9, right: 9, top: 9, height: 2, background: V.line }} />
                <div style={{ position: "absolute", left: 9, top: 9, height: 2, width: released ? "calc(100% - 18px)" : "30%", background: `linear-gradient(90deg,${V.cyan},${V.sand})`, transition: "width 1.2s cubic-bezier(.4,0,.1,1)" }} />
                <span style={{ position: "relative", width: 20, height: 20, borderRadius: "50%", background: V.cyan, display: "grid", placeItems: "center", color: "#fff", fontSize: 10 }}>✓</span>
                <span style={{ position: "relative", width: 20, height: 20, borderRadius: "50%", background: V.cyan }} />
                <span style={{ position: "relative", width: 20, height: 20, borderRadius: "50%", background: released ? V.green : V.card, border: released ? "0" : `2px solid ${V.line}`, display: "grid", placeItems: "center", color: "#fff", fontSize: 10 }}>{released ? "✓" : ""}</span>
                <span style={{ position: "relative", width: 20, height: 20, borderRadius: "50%", background: released ? V.green : V.card, border: released ? "0" : `2px solid ${V.line}`, display: "grid", placeItems: "center", color: "#fff", fontSize: 10 }}>{released ? "✓" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: V.tmut }}>
                <span style={{ width: "25%" }}>Reserved</span>
                <span style={{ width: "25%", textAlign: "center", color: V.cyan, fontWeight: 700 }}>Held in escrow</span>
                <span style={{ width: "25%", textAlign: "center" }}>Trip complete</span>
                <span style={{ width: "25%", textAlign: "right", color: released ? V.green : V.tmut, fontWeight: released ? 700 : 400 }}>Captain paid</span>
              </div>
            </div>

            {/* Recap */}
            <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24, marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <MediaImg src={heroUrl} alt="" style={{ width: 104, height: 80, borderRadius: 13, objectFit: "cover", flex: "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: V.serif, fontSize: 21, fontWeight: 600 }}>{svc.title}</div>
                  <div style={{ fontSize: 13.5, color: V.tmut, marginTop: 4 }}>{dateLabel} · {time} · {party} anglers</div>
                  <div style={{ fontSize: 13, color: V.tmut, marginTop: 6 }}>{business?.name ?? "Captain"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                <button onClick={() => navigate({ to: "/trips/detail", search: { id: confirmedId } })} style={{ background: V.navy, color: "#fff", border: 0, borderRadius: 11, padding: "12px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>View in dashboard</button>
                <Link to="/dashboard" style={{ background: "transparent", border: `1px solid ${V.line}`, borderRadius: 11, padding: "12px 18px", fontSize: 13, fontWeight: 600, color: V.ink, textDecoration: "none" }}>Back to dashboard</Link>
              </div>
            </div>

            {/* Demo simulate */}
            {!released && (
              <div style={{ border: "1px dashed rgba(13,34,54,.24)", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,.5)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>Preview the payoff</div>
                  <div style={{ fontSize: 12.5, color: V.tmut, marginTop: 2 }}>Simulate your trip finishing to see escrow release to the captain.</div>
                </div>
                <button onClick={() => setReleased(true)} style={{ flex: "none", background: V.green, color: "#fff", border: 0, borderRadius: 11, padding: "12px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>▶ Mark trip completed</button>
              </div>
            )}

            {/* Review */}
            {released && (
              <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, padding: 24, marginTop: 18 }}>
                {!reviewed ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: V.greensoft, display: "grid", placeItems: "center", color: V.green, fontSize: 13 }}>✓</span>
                      <div style={{ fontFamily: V.serif, fontSize: 20, fontWeight: 600 }}>Trip complete — captain paid</div>
                    </div>
                    <p style={{ fontSize: 14, color: V.tmut, margin: "0 0 16px 36px" }}>Deposit released to your captain. How was your day on the water?</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 14px 36px" }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setStars(n)} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 30, padding: 0, color: n <= stars ? V.sand : V.line }}>★</button>
                      ))}
                    </div>
                    <textarea placeholder="Share a few words about your trip…" style={{ width: "100%", minHeight: 78, background: V.paper, border: `1px solid ${V.line}`, borderRadius: 12, padding: 13, fontFamily: V.sans, fontSize: 14, color: V.ink, outline: "none", resize: "vertical", marginBottom: 14 }} />
                    <button
                      onClick={() => { if (stars === 0) { showToast("Tap the stars first"); return; } setReviewed(true); showToast("Review posted — thank you!"); }}
                      style={{ background: V.sand, color: "#04121B", border: 0, borderRadius: 11, padding: "13px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      Post review
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "14px 10px" }}>
                    <div style={{ color: V.sand, fontSize: 22, letterSpacing: 3, marginBottom: 10 }}>★★★★★</div>
                    <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 600 }}>Thank you for the review!</div>
                    <Link to="/marketplace" style={{ display: "inline-flex", background: V.navy, color: "#fff", textDecoration: "none", borderRadius: 11, padding: "13px 24px", fontSize: 13, fontWeight: 700, marginTop: 18 }}>Book another trip</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Processing overlay */}
      {processing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(238,242,245,.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 76, height: 76, margin: "0 auto 22px", border: `2px solid ${V.line}`, borderTopColor: V.cyan, borderRadius: "50%", animation: "fx-spin 1s linear infinite" }} />
            <div style={{ fontFamily: V.serif, fontSize: 25, fontWeight: 600, marginBottom: 6 }}>Securing your payment in escrow…</div>
            <div style={{ fontSize: 14, color: V.tmut }}>Encrypting and notifying the captain.</div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 80, background: V.navy, color: "#fff", borderRadius: 30, padding: "13px 22px", fontSize: 13.5, fontWeight: 600, boxShadow: "0 20px 44px -20px rgba(0,0,0,.6)" }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes fx-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
