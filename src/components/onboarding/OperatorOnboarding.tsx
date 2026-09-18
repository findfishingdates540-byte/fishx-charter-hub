import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createConnectOnboardingLink, getConnectStatus } from "@/lib/stripe-connect.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  createVerificationUploadUrl,
  getOnboardingState,
  publishListing,
  savePayoutPreference,
  submitVerification,
  upsertBusinessProfile,
} from "@/lib/onboarding.functions";

type DocKey = string;
type DocSpec = { key: string; title: string; desc: string };

const VERIFICATION_BY_CATEGORY: Record<string, { headline: string; docs: DocSpec[] }> = {
  charter: {
    headline: "Charter captains need proof of licensure, vessel coverage, and identity.",
    docs: [
      { key: "captain_license", title: "Captain's license", desc: "USCG OUPV / Master or national equivalent" },
      { key: "vessel_insurance", title: "Vessel insurance", desc: "Current liability & hull coverage" },
      { key: "gov_id", title: "Government ID", desc: "Passport or driver's license" },
    ],
  },
  guide_service: {
    headline: "Guides need a state guide license and general liability coverage.",
    docs: [
      { key: "guide_license", title: "Fishing guide license", desc: "State parks & wildlife guide permit" },
      { key: "liability_insurance", title: "General liability insurance", desc: "Minimum $1M recommended" },
      { key: "gov_id", title: "Government ID", desc: "Passport or driver's license" },
    ],
  },
  tackle_shop: {
    headline: "Retailers verify business registration and tax standing.",
    docs: [
      { key: "business_license", title: "Business license", desc: "State or municipal registration" },
      { key: "resale_cert", title: "Resale / sales tax certificate", desc: "For inventory sold on Fish-X" },
      { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
    ],
  },
  bait_shop: {
    headline: "Live-bait dealers need a wildlife or health permit alongside your business license.",
    docs: [
      { key: "business_license", title: "Business license", desc: "State or municipal registration" },
      { key: "bait_permit", title: "Live bait dealer permit", desc: "State wildlife / health department" },
      { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
    ],
  },
  marina: {
    headline: "Marinas verify operating permits and dockage liability coverage.",
    docs: [
      { key: "business_license", title: "Business license", desc: "State or municipal registration" },
      { key: "marina_permit", title: "Marina operating permit", desc: "Harbor / environmental compliance permit" },
      { key: "liability_insurance", title: "Marina liability insurance", desc: "Dockage & pollution coverage" },
    ],
  },
  lodge: {
    headline: "Lodges verify hospitality permitting and guest liability coverage.",
    docs: [
      { key: "business_license", title: "Business license", desc: "State or municipal registration" },
      { key: "lodging_permit", title: "Lodging / hospitality permit", desc: "Occupancy or short-term rental permit" },
      { key: "liability_insurance", title: "Property & liability insurance", desc: "Guest & property coverage" },
    ],
  },
  apparel: {
    headline: "Apparel brands verify business identity and, when applicable, brand ownership.",
    docs: [
      { key: "business_license", title: "Business license", desc: "State or municipal registration" },
      { key: "trademark_doc", title: "Trademark or brand doc", desc: "USPTO cert or brand registration (optional)" },
      { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
    ],
  },
  gear_mfg: {
    headline: "Manufacturers verify business identity and product liability coverage.",
    docs: [
      { key: "business_license", title: "Business license", desc: "State or municipal registration" },
      { key: "product_liability", title: "Product liability insurance", desc: "Coverage for manufactured goods" },
      { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
    ],
  },
};

type PayoutFlowStep = { n: number; t: string; d: string; c: string; ic: string };
export type PayoutScheduleKey = "weekly" | "each" | "monthly";
type PayoutScheduleOpt = { key: PayoutScheduleKey; title: string; desc: string };
type PayoutConfig = {
  eyebrow: string;
  headline: string;
  flow: PayoutFlowStep[];
  schedules: PayoutScheduleOpt[];
  connectLabel: string;
  connectDesc: string;
  fineprint: string;
};

const DEFAULT_ESCROW_FLOW: PayoutFlowStep[] = [
  { n: 1, t: "Angler pays", d: "Funds captured at booking.", c: "rgba(45,226,242,.18)", ic: "#2DE2F2" },
  { n: 2, t: "Held in escrow", d: "Safe — not your balance yet.", c: "rgba(45,226,242,.12)", ic: "#2DE2F2" },
  { n: 3, t: "You're paid", d: "Released after the trip.", c: "rgba(34,197,94,.14)", ic: "#22C55E" },
];

const RETAIL_FLOW: PayoutFlowStep[] = [
  { n: 1, t: "Customer checks out", d: "Card charged at purchase.", c: "rgba(45,226,242,.18)", ic: "#2DE2F2" },
  { n: 2, t: "Order settles", d: "Funds clear after fulfillment.", c: "rgba(45,226,242,.12)", ic: "#2DE2F2" },
  { n: 3, t: "Payout to you", d: "Net proceeds sent on schedule.", c: "rgba(34,197,94,.14)", ic: "#22C55E" },
];

const STAY_FLOW: PayoutFlowStep[] = [
  { n: 1, t: "Guest reserves", d: "Deposit taken at booking.", c: "rgba(45,226,242,.18)", ic: "#2DE2F2" },
  { n: 2, t: "Balance on arrival", d: "Remaining balance clears at check-in.", c: "rgba(45,226,242,.12)", ic: "#2DE2F2" },
  { n: 3, t: "Payout to you", d: "Released after checkout.", c: "rgba(34,197,94,.14)", ic: "#22C55E" },
];

const PAYOUT_BY_CATEGORY: Record<string, PayoutConfig> = {
  charter: {
    eyebrow: "Charter escrow",
    headline: "Anglers pay upfront into escrow — you're paid after every trip runs.",
    flow: DEFAULT_ESCROW_FLOW,
    schedules: [
      { key: "each", title: "After each trip", desc: "Released as soon as escrow clears." },
      { key: "weekly", title: "Weekly", desc: "Auto-batched every Monday." },
    ],
    connectLabel: "Connect bank for captain payouts",
    connectDesc: "Verified bank account required before your first release.",
    fineprint: "Stripe Connect linking is enabled after your first booking. Adjustable in Settings.",
  },
  guide_service: {
    eyebrow: "Guide escrow",
    headline: "Trip fees sit in escrow until your guided day is complete.",
    flow: DEFAULT_ESCROW_FLOW,
    schedules: [
      { key: "each", title: "After each trip", desc: "Released the day your guided trip wraps." },
      { key: "weekly", title: "Weekly", desc: "Auto-batched every Monday." },
    ],
    connectLabel: "Connect bank for guide payouts",
    connectDesc: "We'll verify your bank account before your first release.",
    fineprint: "Stripe Connect linking is enabled after your first booking. Adjustable in Settings.",
  },
  tackle_shop: {
    eyebrow: "Retail settlement",
    headline: "Orders settle after fulfillment — payouts land on your chosen schedule.",
    flow: RETAIL_FLOW,
    schedules: [
      { key: "weekly", title: "Weekly", desc: "Batched net proceeds every Monday." },
      { key: "each", title: "Rolling (2-day)", desc: "Standard Stripe rolling payout." },
    ],
    connectLabel: "Connect bank for storefront payouts",
    connectDesc: "Needed to receive proceeds from Fish-X orders.",
    fineprint: "Refunds & chargebacks are reconciled automatically against your next payout.",
  },
  bait_shop: {
    eyebrow: "Retail settlement",
    headline: "Live-bait and small-goods orders settle daily — payouts on your schedule.",
    flow: RETAIL_FLOW,
    schedules: [
      { key: "weekly", title: "Weekly", desc: "Batched net proceeds every Monday." },
      { key: "each", title: "Rolling (2-day)", desc: "Standard Stripe rolling payout." },
    ],
    connectLabel: "Connect bank for bait shop payouts",
    connectDesc: "Verified bank account required for storefront proceeds.",
    fineprint: "Perishable-item refunds are handled per your shop policy.",
  },
  marina: {
    eyebrow: "Slip & service settlement",
    headline: "Slip reservations and service invoices settle after check-out or job completion.",
    flow: STAY_FLOW,
    schedules: [
      { key: "weekly", title: "Weekly", desc: "Batched slip & service proceeds every Monday." },
      { key: "monthly", title: "Monthly", desc: "Consolidated payout on the 1st." },
    ],
    connectLabel: "Connect bank for marina payouts",
    connectDesc: "Used for slip reservations, fuel, and service invoices.",
    fineprint: "Recurring monthly slip holders can be invoiced separately in Settings.",
  },
  lodge: {
    eyebrow: "Lodging escrow",
    headline: "Guests pay a deposit upfront; balance clears at check-in. Payout after checkout.",
    flow: STAY_FLOW,
    schedules: [
      { key: "each", title: "After each stay", desc: "Payout the day after guest checkout." },
      { key: "weekly", title: "Weekly", desc: "Batched every Monday." },
    ],
    connectLabel: "Connect bank for lodge payouts",
    connectDesc: "Verified bank account required before your first release.",
    fineprint: "Damage holds and incidentals can be captured separately at checkout.",
  },
  apparel: {
    eyebrow: "Brand settlement",
    headline: "Apparel orders settle after fulfillment — payouts on your chosen schedule.",
    flow: RETAIL_FLOW,
    schedules: [
      { key: "weekly", title: "Weekly", desc: "Net proceeds every Monday." },
      { key: "each", title: "Rolling (2-day)", desc: "Standard Stripe rolling payout." },
    ],
    connectLabel: "Connect bank for brand payouts",
    connectDesc: "Required to receive proceeds from apparel orders.",
    fineprint: "Returns are auto-reconciled against your next payout.",
  },
  gear_mfg: {
    eyebrow: "Manufacturer settlement",
    headline: "Wholesale and DTC orders settle after fulfillment — payouts on your schedule.",
    flow: RETAIL_FLOW,
    schedules: [
      { key: "weekly", title: "Weekly", desc: "Net proceeds every Monday." },
      { key: "monthly", title: "Monthly (NET-30)", desc: "Consolidated wholesale settlement." },
    ],
    connectLabel: "Connect bank for manufacturer payouts",
    connectDesc: "Used for DTC and wholesale order proceeds.",
    fineprint: "Wholesale terms & POs can be configured separately in Settings.",
  },
};

function getVerificationConfig(categoryKey: string) {
  return (
    VERIFICATION_BY_CATEGORY[categoryKey] ?? {
      headline: "Verify your business identity so anglers can book with confidence.",
      docs: [
        { key: "business_license", title: "Business license", desc: "State or municipal registration" },
        { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
      ],
    }
  );
}

function getPayoutConfig(categoryKey: string): PayoutConfig {
  return PAYOUT_BY_CATEGORY[categoryKey] ?? PAYOUT_BY_CATEGORY.charter;
}

type ListingKind =
  | "charter_trip"
  | "guided_trip"
  | "slip_rental"
  | "lodging"
  | "workshop"
  | "rental"
  | "other";

type ListingChip = { key: string; label: string };
type ListingConfig = {
  eyebrow: string;
  headline: string;
  kind: ListingKind;
  titleLabel: string;
  titlePlaceholder: string;
  titleDefault: string;
  showDuration: boolean;
  durationLabel: string;
  durationDefault: number; // minutes; 0 when hidden
  capacityLabel: string;
  capacityDefault: number;
  priceLabel: string;
  priceDefault: number;
  includesLabel: string;
  chips: ListingChip[];
  reviewLine: (l: { title: string; capacity: number; price: number; durationMinutes: number }) => string;
};

const LISTING_BY_CATEGORY: Record<string, ListingConfig> = {
  charter: {
    eyebrow: "Charter trip",
    headline: "Publish one signature charter to open your calendar.",
    kind: "charter_trip",
    titleLabel: "Trip title",
    titlePlaceholder: "e.g. Full-day offshore charter",
    titleDefault: "Offshore charter",
    showDuration: true,
    durationLabel: "Duration (min)",
    durationDefault: 480,
    capacityLabel: "Max anglers",
    capacityDefault: 6,
    priceLabel: "Price per trip (USD)",
    priceDefault: 850,
    includesLabel: "What's included",
    chips: [
      { key: "tackle", label: "Tackle" },
      { key: "bait", label: "Bait" },
      { key: "license", label: "License" },
      { key: "drinks", label: "Drinks" },
      { key: "photos", label: "Photos" },
      { key: "cleaning", label: "Fish cleaning" },
    ],
    reviewLine: (l) => `${l.title} · ${l.capacity} anglers · $${l.price}/trip`,
  },
  guide_service: {
    eyebrow: "Guided trip",
    headline: "Publish your signature guided experience.",
    kind: "guided_trip",
    titleLabel: "Trip title",
    titlePlaceholder: "e.g. Half-day wade trip for redfish",
    titleDefault: "Guided wade trip",
    showDuration: true,
    durationLabel: "Duration (min)",
    durationDefault: 300,
    capacityLabel: "Max guests",
    capacityDefault: 3,
    priceLabel: "Price per trip (USD)",
    priceDefault: 550,
    includesLabel: "What's included",
    chips: [
      { key: "tackle", label: "Tackle" },
      { key: "flies", label: "Flies" },
      { key: "license", label: "License" },
      { key: "lunch", label: "Lunch" },
      { key: "photos", label: "Photos" },
      { key: "transport", label: "Transport" },
    ],
    reviewLine: (l) => `${l.title} · ${l.capacity} guests · $${l.price}/trip`,
  },
  marina: {
    eyebrow: "Transient slip",
    headline: "List a slip anglers and cruisers can reserve by the night.",
    kind: "slip_rental",
    titleLabel: "Slip listing title",
    titlePlaceholder: "e.g. 40-ft transient slip on A-dock",
    titleDefault: "Transient slip · A-dock",
    showDuration: false,
    durationLabel: "",
    durationDefault: 0,
    capacityLabel: "Max vessel length (ft)",
    capacityDefault: 40,
    priceLabel: "Nightly rate (USD)",
    priceDefault: 95,
    includesLabel: "Slip amenities",
    chips: [
      { key: "power_30a", label: "30A power" },
      { key: "power_50a", label: "50A power" },
      { key: "water", label: "Fresh water" },
      { key: "wifi", label: "Wi-Fi" },
      { key: "pumpout", label: "Pump-out" },
      { key: "showers", label: "Showers" },
      { key: "laundry", label: "Laundry" },
      { key: "fuel", label: "Fuel dock" },
    ],
    reviewLine: (l) => `${l.title} · up to ${l.capacity} ft · $${l.price}/night`,
  },
  lodge: {
    eyebrow: "Lodging",
    headline: "Publish a room, cabin, or full-service package.",
    kind: "lodging",
    titleLabel: "Lodging title",
    titlePlaceholder: "e.g. Lakeside cabin — sleeps 4",
    titleDefault: "Lakeside cabin",
    showDuration: false,
    durationLabel: "",
    durationDefault: 0,
    capacityLabel: "Sleeps",
    capacityDefault: 4,
    priceLabel: "Nightly rate (USD)",
    priceDefault: 260,
    includesLabel: "What's included",
    chips: [
      { key: "breakfast", label: "Breakfast" },
      { key: "wifi", label: "Wi-Fi" },
      { key: "dock", label: "Dock access" },
      { key: "boat_rental", label: "Boat rental" },
      { key: "guide", label: "Guide included" },
      { key: "meals", label: "All meals" },
      { key: "gear", label: "Gear provided" },
    ],
    reviewLine: (l) => `${l.title} · sleeps ${l.capacity} · $${l.price}/night`,
  },
  tackle_shop: {
    eyebrow: "Storefront product",
    headline: "Add your first product to open your Fish-X storefront.",
    kind: "other",
    titleLabel: "Product title",
    titlePlaceholder: "e.g. Shimano Stradic FL 4000",
    titleDefault: "Signature product",
    showDuration: false,
    durationLabel: "",
    durationDefault: 0,
    capacityLabel: "Stock on hand",
    capacityDefault: 24,
    priceLabel: "Unit price (USD)",
    priceDefault: 199,
    includesLabel: "Product tags",
    chips: [
      { key: "rods", label: "Rods" },
      { key: "reels", label: "Reels" },
      { key: "lures", label: "Lures" },
      { key: "line", label: "Line" },
      { key: "terminal", label: "Terminal tackle" },
      { key: "electronics", label: "Electronics" },
      { key: "apparel", label: "Apparel" },
    ],
    reviewLine: (l) => `${l.title} · $${l.price} · ${l.capacity} in stock`,
  },
  bait_shop: {
    eyebrow: "Storefront product",
    headline: "Add your first item — live, frozen, or dry goods.",
    kind: "other",
    titleLabel: "Product title",
    titlePlaceholder: "e.g. Live shrimp — dozen",
    titleDefault: "Live shrimp · dozen",
    showDuration: false,
    durationLabel: "",
    durationDefault: 0,
    capacityLabel: "Stock on hand",
    capacityDefault: 100,
    priceLabel: "Unit price (USD)",
    priceDefault: 12,
    includesLabel: "Product tags",
    chips: [
      { key: "live_bait", label: "Live bait" },
      { key: "frozen", label: "Frozen" },
      { key: "cut_bait", label: "Cut bait" },
      { key: "chum", label: "Chum" },
      { key: "ice", label: "Ice" },
      { key: "terminal", label: "Terminal tackle" },
    ],
    reviewLine: (l) => `${l.title} · $${l.price} · ${l.capacity} in stock`,
  },
  apparel: {
    eyebrow: "Product drop",
    headline: "Publish your first SKU to open the brand store.",
    kind: "other",
    titleLabel: "Product title",
    titlePlaceholder: "e.g. Deep Hull performance hoodie",
    titleDefault: "Signature hoodie",
    showDuration: false,
    durationLabel: "",
    durationDefault: 0,
    capacityLabel: "Units available",
    capacityDefault: 120,
    priceLabel: "Retail price (USD)",
    priceDefault: 78,
    includesLabel: "Size run",
    chips: [
      { key: "xs", label: "XS" },
      { key: "s", label: "S" },
      { key: "m", label: "M" },
      { key: "l", label: "L" },
      { key: "xl", label: "XL" },
      { key: "xxl", label: "XXL" },
    ],
    reviewLine: (l) => `${l.title} · $${l.price} · ${l.capacity} units`,
  },
  gear_mfg: {
    eyebrow: "Catalog product",
    headline: "Publish a hero SKU — DTC or wholesale.",
    kind: "other",
    titleLabel: "Product title",
    titlePlaceholder: "e.g. Tidewater 240 rod blank",
    titleDefault: "Signature SKU",
    showDuration: false,
    durationLabel: "",
    durationDefault: 0,
    capacityLabel: "Units in inventory",
    capacityDefault: 500,
    priceLabel: "MSRP (USD)",
    priceDefault: 249,
    includesLabel: "Catalog tags",
    chips: [
      { key: "rods", label: "Rods" },
      { key: "reels", label: "Reels" },
      { key: "lures", label: "Lures" },
      { key: "electronics", label: "Electronics" },
      { key: "wholesale", label: "Wholesale" },
      { key: "dtc", label: "DTC" },
      { key: "custom", label: "Custom order" },
    ],
    reviewLine: (l) => `${l.title} · $${l.price} MSRP · ${l.capacity} units`,
  },
};

function getListingConfig(categoryKey: string): ListingConfig {
  return LISTING_BY_CATEGORY[categoryKey] ?? LISTING_BY_CATEGORY.charter;
}


const STEPS = [
  { label: "Business profile", sub: "Who you are" },
  { label: "Verification", sub: "License & insurance" },
  { label: "Payouts", sub: "Get paid via escrow" },
  { label: "Your first listing", sub: "What you offer" },
  { label: "Review & publish", sub: "Go live" },
];

export function OperatorOnboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchState = useServerFn(getOnboardingState);
  const upsertProfile = useServerFn(upsertBusinessProfile);
  const createUpload = useServerFn(createVerificationUploadUrl);
  const submitVer = useServerFn(submitVerification);
  const savePayout = useServerFn(savePayoutPreference);
  const publish = useServerFn(publishListing);
  const startConnect = useServerFn(createConnectOnboardingLink);
  const connectStatus = useServerFn(getConnectStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: () => fetchState(),
  });

  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string | null>>({});
  const [payoutSchedule, setPayoutSchedule] = useState<PayoutScheduleKey>("weekly");
  const [stripeConnected, setStripeConnected] = useState(false);
  const [published, setPublished] = useState(false);

  // Reflect real Stripe Connect state (also after returning from Stripe).
  useEffect(() => {
    let cancelled = false;
    connectStatus({ data: {} })
      .then((s) => {
        if (!cancelled) setStripeConnected(Boolean(s.chargesEnabled && s.payoutsEnabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [connectStatus]);

  // Profile form
  const biz = data?.business;
  const [profile, setProfile] = useState({
    name: "",
    categoryKey: "charter",
    city: "",
    phone: "",
    description: "",
  });
  // Sync loaded business
  const loadedRef = useRef(false);
  if (biz && !loadedRef.current) {
    loadedRef.current = true;
    setProfile({
      name: biz.name ?? "",
      categoryKey: biz.category_key ?? "charter",
      city: biz.city ?? "",
      phone: biz.phone ?? "",
      description: biz.description ?? "",
    });
    if (biz.is_published) setPublished(true);
  }

  // Listing form — defaults come from the current category config
  const svc = data?.service;
  const listingConfig = getListingConfig(profile.categoryKey);
  const [listing, setListing] = useState(() => {
    const c = LISTING_BY_CATEGORY.charter;
    return {
      title: c.titleDefault,
      durationMinutes: c.durationDefault,
      capacity: c.capacityDefault,
      price: c.priceDefault,
      inc: Object.fromEntries(c.chips.map((ch, i) => [ch.key, i < 3])) as Record<string, boolean>,
    };
  });
  const svcLoadedRef = useRef(false);
  if (svc && !svcLoadedRef.current) {
    svcLoadedRef.current = true;
    setListing((p) => ({
      ...p,
      title: svc.title,
      durationMinutes: svc.duration_minutes ?? p.durationMinutes,
      capacity: svc.capacity,
      price: Math.round((svc.base_price_cents ?? 0) / 100),
      inc: Object.fromEntries(
        (svc.includes ?? []).map((k: string) => [k, true]),
      ) as Record<string, boolean>,
    }));
  }

  // When the user changes category (and hasn't already loaded a saved service),
  // re-seed the listing defaults so labels/chips match the new vertical.
  const lastCategoryRef = useRef(profile.categoryKey);
  useEffect(() => {
    if (svcLoadedRef.current) return;
    if (lastCategoryRef.current === profile.categoryKey) return;
    lastCategoryRef.current = profile.categoryKey;
    const c = getListingConfig(profile.categoryKey);
    setListing({
      title: c.titleDefault,
      durationMinutes: c.durationDefault,
      capacity: c.capacityDefault,
      price: c.priceDefault,
      inc: Object.fromEntries(c.chips.map((ch, i) => [ch.key, i < 3])) as Record<string, boolean>,
    });
  }, [profile.categoryKey]);


  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const profileM = useMutation({
    mutationFn: (v: typeof profile) => upsertProfile({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      showToast("Profile saved");
      setStep(1);
    },
    onError: (e: any) => showToast(e?.message ?? "Failed to save"),
  });

  const publishM = useMutation({
    mutationFn: async () => {
      const docPaths = Object.values(uploaded).filter(Boolean) as string[];
      if (docPaths.length > 0 && !data?.verification) {
        await submitVer({ data: { docPaths } });
      }
      await savePayout({ data: { schedule: payoutSchedule, stripeConnected } });
      return publish({
        data: {
          title: listing.title,
          kind: listingConfig.kind,
          durationMinutes: listing.durationMinutes,
          capacity: listing.capacity,
          basePriceCents: Math.round(listing.price * 100),
          includes: Object.entries(listing.inc)
            .filter(([, v]) => v)
            .map(([k]) => k),
        },
      });
    },
    onSuccess: () => {
      setPublished(true);
      qc.invalidateQueries({ queryKey: ["onboarding"] });
    },
    onError: (e: any) => showToast(e?.message ?? "Publish failed"),
  });

  async function handleUpload(key: DocKey, file: File) {
    try {
      const { path, token } = await createUpload({ data: { docKey: key, filename: file.name } });
      const { error } = await supabase.storage.from("verification-docs").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      setUploaded((p) => ({ ...p, [key]: path }));
      showToast("Document uploaded");
    } catch (e: any) {
      showToast(e?.message ?? "Upload failed");
    }
  }

  const categories = data?.categories ?? [];
  const verifyConfig = getVerificationConfig(profile.categoryKey);
  const requiredDocCount = verifyConfig.docs.length;
  const uploadedCount =
    Object.values(uploaded).filter(Boolean).length +
    (data?.verification?.doc_urls?.length ? requiredDocCount : 0);
  const pct = published ? 100 : Math.round((step / 4) * 100);

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-[#0D161F] text-[#92A0AB]">Loading…</div>;
  }

  return (
    <div
      className="fx-shell dc-body min-h-screen flex flex-col md:flex-row bg-[#0D161F] text-[#F0F2F5]"
      style={{
        fontFamily: "'Outfit',system-ui,sans-serif",
      }}
    >
      {/* Mobile header (replaces the sidebar on phones) */}
      <header className="md:hidden bg-[#1C2936] px-5 pt-5 pb-4 sticky top-0 z-40 border-b border-[#2DE2F2]/10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="flex items-center gap-[10px]">
            <span className="inline-block w-[11px] h-[11px] bg-[#2DE2F2] rotate-45" />
            <span className="font-semibold text-[17px] tracking-[0.02em] whitespace-nowrap">FISH-X.COM</span>
          </span>
          <span className="text-[11.5px] font-bold text-[#2DE2F2]">
            {published ? "Complete" : `Step ${step + 1} / 5`}
          </span>
        </div>
        <div className="h-[6px] rounded-md bg-[#0D161F] overflow-hidden mb-3">
          <div
            className="h-full rounded-md bg-[#2DE2F2] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {STEPS.map((s, i) => {
            const done = i < step || published;
            const current = i === step && !published;
            return (
              <button
                key={i}
                onClick={() => !published && setStep(i)}
                className="flex items-center gap-2 flex-none border-0 rounded-full py-1.5 px-3 cursor-pointer text-[12px] font-semibold"
                style={{
                  background: current ? "rgba(45,226,242,.14)" : "transparent",
                  color: done || current ? "#F0F2F5" : "#92A0AB",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold border-2"
                  style={{
                    background: done || current ? "#2DE2F2" : "transparent",
                    borderColor: done || current ? "#2DE2F2" : "rgba(255,255,255,.2)",
                    color: done || current ? "#04121B" : "#92A0AB",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Sidebar */}
      <aside className="hidden md:flex w-[300px] flex-none bg-[#1C2936] text-[#F0F2F5] flex-col p-[26px_24px] sticky top-0 h-screen">
        <div className="flex items-center gap-[10px] mb-[26px]">
          <span className="inline-block w-[11px] h-[11px] bg-[#2DE2F2] rotate-45" />
          <span
            className="font-semibold text-[20px] tracking-[0.02em] whitespace-nowrap"
            style={{ fontFamily: "'Outfit',Georgia,serif" }}
          >
            FISH-X.COM
          </span>
        </div>
        <div
          className="font-semibold text-[24px] leading-[1.1] text-white"
          style={{ fontFamily: "'Outfit',Georgia,serif" }}
        >
          Set up your
          <br />
          workspace
        </div>
        <div className="text-[13px] text-[#92A0AB] mt-2 mb-5">A few steps and you're taking bookings.</div>
        <div className="flex items-center gap-[10px] mb-6">
          <div className="flex-1 h-[6px] rounded-md bg-[#14202B]/10 overflow-hidden">
            <div
              className="h-full rounded-md bg-gradient-to-r from-[#2DE2F2] to-[#2DE2F2] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11.5px] font-bold text-[#2DE2F2]">
            {published ? "Complete" : `Step ${step + 1} / 5`}
          </span>
        </div>
        <nav className="flex flex-col gap-[2px]">
          {STEPS.map((s, i) => {
            const done = i < step || published;
            const current = i === step && !published;
            return (
              <button
                key={i}
                onClick={() => !published && setStep(i)}
                className="flex items-center gap-[13px] w-full border-0 rounded-xl p-3 cursor-pointer text-left transition-colors"
                style={{ background: current ? "rgba(45,226,242,.12)" : "transparent" }}
              >
                <span
                  className="w-7 h-7 rounded-full flex-none grid place-items-center text-[12px] font-bold border-2"
                  style={{
                    background: done || current ? "#2DE2F2" : "transparent",
                    borderColor: done || current ? "#2DE2F2" : "rgba(255,255,255,.2)",
                    color: done || current ? "#04121B" : "#92A0AB",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span>
                  <span
                    className="block text-[13.5px] font-semibold"
                    style={{ color: current ? "#F0F2F5" : done ? "#F0F2F5" : "#92A0AB" }}
                  >
                    {s.label}
                  </span>
                  <span className="block text-[11.5px] text-[#92A0AB] opacity-70">{s.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto pt-6 text-[11.5px] text-[#92A0AB]">
          <button
            onClick={() => navigate({ to: "/dashboard", search: { as: "angler" } })}
            className="mb-3 block text-left text-[12px] text-[#2DE2F2] underline bg-transparent border-0 cursor-pointer p-0"
          >
            I'm just here to book trips — skip for now
          </button>
          Need a hand?{" "}
          <a href="mailto:captains@fish-x.com" className="text-[#2DE2F2] underline">
            captains@fish-x.com
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-5 sm:p-8 lg:p-[56px_64px] max-w-[960px] w-full mx-auto lg:mx-0">
          {published ? (
            <div className="min-h-[70vh] flex items-center justify-center">
              <div className="max-w-[520px] text-center">
                <div
                  className="w-[82px] h-[82px] rounded-full bg-[rgba(34,197,94,0.14)] grid place-items-center text-[#22C55E] mx-auto mb-[22px] text-[36px]"
                >
                  ✓
                </div>
                <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#2DE2F2]">
                  You're live on Fish-X
                </div>
                <h1
                  className="font-semibold text-[38px] leading-[1.05] my-[10px] text-[#F0F2F5]"
                  style={{ fontFamily: "'Outfit',Georgia,serif" }}
                >
                  Your listing is published.
                </h1>
                <p className="text-[15.5px] leading-[1.55] text-[#92A0AB] mb-[26px]">
                  Anglers can now find and book <b className="text-[#F0F2F5]">{listing.title}</b>. Payments arrive
                  protected in escrow — released to you after every trip.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="bg-[#1C2936] text-white rounded-xl px-6 py-3.5 text-[13px] font-bold tracking-[0.03em]"
                  >
                    Go to dashboard
                  </button>
                  {data?.business?.slug && (
                    <a
                      href={`/b/${data.business.slug}`}
                      className="border border-[#2DE2F2]/10 text-[#2DE2F2] rounded-xl px-6 py-3.5 text-[13px] font-semibold"
                    >
                      View live listing
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <StepHeader
                step={step}
                heading={
                  step === 0
                    ? "Your business profile"
                    : step === 1
                      ? "Get verified"
                      : step === 2
                        ? "Get paid through escrow"
                        : step === 3
                          ? "Create your first listing"
                          : "Review & publish"
                }
                sub={
                  step === 0
                    ? "Tell anglers who you are. You can refine this later."
                    : step === 1
                      ? "The gold seal on your listing. Anglers only book verified operators."
                      : step === 2
                        ? "Anglers pay upfront into escrow — you're paid after every trip."
                        : step === 3
                          ? "Publish one signature offering to open your calendar."
                          : "Confirm the details below and go live."
                }
              />

              {step === 0 && (
                <ProfileStep profile={profile} setProfile={setProfile} categories={categories} />
              )}
              {step === 1 && (
                <VerifyStep
                  config={verifyConfig}
                  categoryLabel={
                    categories.find((c) => c.key === profile.categoryKey)?.label ?? "your business"
                  }
                  uploaded={uploaded}
                  onUpload={handleUpload}
                  alreadySubmitted={!!data?.verification}
                />
              )}
              {step === 2 && (
                <PayoutsStep
                  config={getPayoutConfig(profile.categoryKey)}
                  schedule={payoutSchedule}
                  setSchedule={setPayoutSchedule}
                  stripeConnected={stripeConnected}
                  onConnectStripe={async () => {
                    showToast("Opening Stripe Connect…");
                    try {
                      const res = await startConnect({
                        data: { returnUrl: `${window.location.origin}/onboarding` },
                      });
                      if (!res?.url) throw new Error("Stripe did not return an onboarding link.");
                      window.location.assign(res.url);
                    } catch (err) {
                      const msg =
                        err instanceof Response
                          ? await err.text()
                          : err instanceof Error
                            ? err.message
                            : String(err);
                      if (msg.includes("not configured")) {
                        showToast("Stripe isn't connected yet — add your Stripe key to enable payouts.");
                      } else if (msg.toLowerCase().includes("signed up for connect")) {
                        showToast(
                          "Enable Stripe Connect on your Stripe account (dashboard.stripe.com/connect), then try again.",
                        );
                      } else {
                        showToast(msg.slice(0, 160) || "Could not start Stripe onboarding.");
                      }
                    }
                  }}
                />
              )}
              {step === 3 && (
                <ListingStep listing={listing} setListing={setListing} config={listingConfig} />
              )}
              {step === 4 && (
                <ReviewStep
                  profile={profile}
                  listing={listing}
                  listingConfig={listingConfig}
                  categoryLabel={
                    categories.find((c) => c.key === profile.categoryKey)?.label ??
                    profile.categoryKey
                  }
                  verifyStatus={
                    data?.verification
                      ? "✓ Submitted"
                      : uploadedCount > 0
                        ? `${Math.min(uploadedCount, requiredDocCount)} of ${requiredDocCount}`
                        : "Not started"
                  }
                  payoutSchedule={payoutSchedule}
                />
              )}


              <div className="mt-10 flex items-center justify-between max-w-[720px]">
                <button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="text-[13px] font-semibold text-[#92A0AB] disabled:opacity-0"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (step === 0) {
                      profileM.mutate(profile);
                    } else if (step === 4) {
                      publishM.mutate();
                    } else {
                      setStep((s) => Math.min(4, s + 1));
                    }
                  }}
                  disabled={profileM.isPending || publishM.isPending}
                  className="bg-[#2DE2F2] text-[#04121B] border-0 rounded-xl px-[26px] py-[13px] text-[13.5px] font-bold tracking-[0.04em] cursor-pointer disabled:opacity-60"
                >
                  {step === 4
                    ? publishM.isPending
                      ? "Publishing…"
                      : "Publish listing & go live"
                    : profileM.isPending
                      ? "Saving…"
                      : "Continue"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-[11px] bg-[#1C2936] text-white border border-[#2DE2F2]/10 rounded-full px-[22px] py-[13px] shadow-2xl">
          <span className="w-[22px] h-[22px] rounded-full bg-[#22C55E] grid place-items-center text-[12px]">✓</span>
          <span className="text-[13.5px] font-semibold">{toast}</span>
        </div>
      )}
    </div>
  );
}

function StepHeader({ step, heading, sub }: { step: number; heading: string; sub: string }) {
  return (
    <div className="mb-8">
      <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#2DE2F2]">Step {step + 1} of 5</div>
      <h1
        className="font-semibold text-[34px] leading-[1.05] mt-2 mb-1.5 text-[#F0F2F5]"
        style={{ fontFamily: "'Outfit',Georgia,serif" }}
      >
        {heading}
      </h1>
      <p className="text-[15px] text-[#92A0AB]">{sub}</p>
    </div>
  );
}

const inputCls =
  "w-full bg-[#1C2936] border border-[#2DE2F2]/10 rounded-[10px] px-[13px] py-3 text-[14px] text-[#F0F2F5] outline-none focus:border-[#2DE2F2]";
const labelCls =
  "block text-[11px] font-bold tracking-[0.1em] uppercase text-[#92A0AB] mb-1.5";

function ProfileStep({
  profile,
  setProfile,
  categories,
}: {
  profile: any;
  setProfile: (v: any) => void;
  categories: { key: string; label: string }[];
}) {
  return (
    <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-[18px] p-6 max-w-[720px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={labelCls}>Business name</span>
          <input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className={inputCls}
            placeholder="Sterling Sportfishing"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Category</span>
          <select
            value={profile.categoryKey}
            onChange={(e) => setProfile({ ...profile, categoryKey: e.target.value })}
            className={inputCls}
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Homeport</span>
          <input
            value={profile.city}
            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
            className={inputCls}
            placeholder="Islamorada, FL"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Phone</span>
          <input
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className={inputCls}
            placeholder="+1 (305) 555-0147"
          />
        </label>
      </div>
      <label className="block mt-4">
        <span className={labelCls}>Short bio</span>
        <textarea
          value={profile.description}
          onChange={(e) => setProfile({ ...profile, description: e.target.value })}
          className={`${inputCls} min-h-[88px] resize-y`}
          placeholder="Tournament-grade offshore captain with 20+ years running…"
        />
      </label>
    </div>
  );
}

function VerifyStep({
  config,
  categoryLabel,
  uploaded,
  onUpload,
  alreadySubmitted,
}: {
  config: { headline: string; docs: DocSpec[] };
  categoryLabel: string;
  uploaded: Record<string, string | null>;
  onUpload: (k: DocKey, file: File) => void;
  alreadySubmitted: boolean;
}) {
  return (
    <div className="flex flex-col gap-[14px] max-w-[720px]">
      <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-2xl p-[16px_20px]">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#2DE2F2] mb-1">
          {categoryLabel}
        </div>
        <div className="text-[13.5px] text-[#F0F2F5] leading-[1.5]">{config.headline}</div>
      </div>
      {config.docs.map((meta) => {
        const done = !!uploaded[meta.key] || alreadySubmitted;
        return (
          <div
            key={meta.key}
            className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-2xl p-[18px_20px] flex items-center gap-4"
          >
            <span className="w-11 h-11 rounded-xl bg-[rgba(45,226,242,0.16)] grid place-items-center text-[#2DE2F2] flex-none">
              📄
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-semibold text-[#F0F2F5]">{meta.title}</div>
              <div className="text-[12.5px] text-[#92A0AB]">{meta.desc}</div>
            </div>
            {done ? (
              <span className="inline-flex items-center gap-2 bg-[rgba(34,197,94,0.14)] text-[#22C55E] rounded-full px-[14px] py-[9px] text-[12.5px] font-bold flex-none">
                <span className="w-4 h-4 rounded-full bg-[#22C55E] text-white grid place-items-center text-[10px]">
                  ✓
                </span>
                Uploaded
              </span>
            ) : (
              <label className="flex-none bg-[#1C2936] text-white border-0 rounded-[10px] px-[18px] py-[10px] text-[12.5px] font-bold cursor-pointer">
                Upload
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(meta.key, f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        );
      })}
      <div className="flex items-start gap-2.5 bg-[rgba(45,226,242,0.12)] rounded-xl px-4 py-3.5 max-w-[720px] mt-2">
        <span className="text-[#2DE2F2] flex-none mt-0.5">ℹ</span>
        <span className="text-[12.5px] leading-[1.5] text-[#F0F2F5]">
          Documents are reviewed within ~24 hours. You can finish setup now — your listing goes live the moment
          verification clears.
        </span>
      </div>
    </div>
  );
}

function PayoutsStep({
  config,
  schedule,
  setSchedule,
  stripeConnected,
  onConnectStripe,
}: {
  config: PayoutConfig;
  schedule: PayoutScheduleKey;
  setSchedule: (s: PayoutScheduleKey) => void;
  stripeConnected: boolean;
  onConnectStripe: () => void;
}) {
  // Keep the selected schedule valid for the current category
  const validKeys = config.schedules.map((s) => s.key);
  if (!validKeys.includes(schedule)) {
    setTimeout(() => setSchedule(config.schedules[0].key), 0);
  }
  const gridCols = config.flow.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return (
    <>
      <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-2xl p-[16px_20px] max-w-[720px] mb-4">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#2DE2F2] mb-1">
          {config.eyebrow}
        </div>
        <div className="text-[13.5px] text-[#F0F2F5] leading-[1.5]">{config.headline}</div>
      </div>
      <div className={`grid ${gridCols} gap-[14px] max-w-[720px] mb-5`}>
        {config.flow.map((x) => (
          <div key={x.n} className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-2xl p-[18px]">
            <div
              className="w-[34px] h-[34px] rounded-[9px] grid place-items-center mb-3 font-semibold"
              style={{ background: x.c, color: x.ic, fontFamily: "'Outfit',Georgia,serif" }}
            >
              {x.n}
            </div>
            <div className="text-[13.5px] font-semibold text-[#F0F2F5] mb-0.5">{x.t}</div>
            <div className="text-[12.5px] leading-[1.45] text-[#92A0AB]">{x.d}</div>
          </div>
        ))}
      </div>

      {/* Stripe Connect */}
      <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-[18px] p-6 max-w-[720px] mb-4">
        <div className="flex items-center gap-4">
          <span
            className="w-11 h-11 rounded-xl grid place-items-center flex-none font-bold text-white"
            style={{ background: "#635bff", fontFamily: "'Outfit',Georgia,serif" }}
          >
            S
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14.5px] font-semibold text-[#F0F2F5]">{config.connectLabel}</div>
            <div className="text-[12.5px] text-[#92A0AB]">{config.connectDesc}</div>
          </div>
          {stripeConnected ? (
            <span className="inline-flex items-center gap-2 bg-[rgba(34,197,94,0.14)] text-[#22C55E] rounded-full px-[14px] py-[9px] text-[12.5px] font-bold flex-none">
              <span className="w-4 h-4 rounded-full bg-[#22C55E] text-white grid place-items-center text-[10px]">
                ✓
              </span>
              Connected
            </span>
          ) : (
            <button
              onClick={onConnectStripe}
              className="flex-none bg-[#635bff] text-white border-0 rounded-[10px] px-[18px] py-[10px] text-[12.5px] font-bold cursor-pointer"
            >
              Connect bank
            </button>
          )}
        </div>
        <div className="text-[11.5px] text-[#92A0AB] mt-3">
          You keep 80% of every sale; the Fish-X platform fee is 20%. {config.fineprint}
        </div>

      </div>

      <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-[18px] p-6 max-w-[720px]">
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#92A0AB] mb-3">Payout schedule</div>
        <div
          className={`grid gap-3 grid-cols-1 ${config.schedules.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {config.schedules.map((opt) => {
            const on = opt.key === schedule;
            return (
              <button
                key={opt.key}
                onClick={() => setSchedule(opt.key)}
                className="border rounded-xl p-4 text-left"
                style={{
                  borderColor: on ? "#2DE2F2" : "rgba(45,226,242,.14)",
                  background: on ? "rgba(45,226,242,.12)" : "#14202B",
                  boxShadow: on ? "0 0 0 1px #2DE2F2 inset" : "none",
                }}
              >
                <div
                  className="text-[13.5px] font-semibold"
                  style={{ color: on ? "#2DE2F2" : "#F0F2F5" }}
                >
                  {opt.title}
                </div>
                <div className="text-[12px] mt-1" style={{ color: on ? "#C9D6DE" : "#92A0AB" }}>
                  {opt.desc}
                </div>
              </button>

            );
          })}
        </div>
        <div className="text-[12px] text-[#92A0AB] mt-4">{config.fineprint}</div>
      </div>
    </>
  );
}

function ListingStep({
  listing,
  setListing,
  config,
}: {
  listing: any;
  setListing: (v: any) => void;
  config: ListingConfig;
}) {
  return (
    <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-[18px] p-6 max-w-[720px]">
      <div className="mb-5">
        <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#2DE2F2]">
          {config.eyebrow}
        </div>
        <div
          className="text-[20px] font-semibold text-[#F0F2F5] mt-1"
          style={{ fontFamily: "'Outfit',Georgia,serif" }}
        >
          {config.headline}
        </div>
      </div>

      <label className="block mb-4">
        <span className={labelCls}>{config.titleLabel}</span>
        <input
          value={listing.title}
          placeholder={config.titlePlaceholder}
          onChange={(e) => setListing({ ...listing, title: e.target.value })}
          className={inputCls}
        />
      </label>

      <div
        className={`grid gap-4 mb-4 grid-cols-1 ${"${config.showDuration ? \"sm:grid-cols-3\" : \"sm:grid-cols-2\"}"}`}
      >
        {config.showDuration && (
          <label className="block">
            <span className={labelCls}>{config.durationLabel}</span>
            <input
              type="number"
              min={30}
              step={30}
              value={listing.durationMinutes}
              onChange={(e) =>
                setListing({ ...listing, durationMinutes: parseInt(e.target.value) || 30 })
              }
              className={inputCls}
            />
          </label>
        )}
        <label className="block">
          <span className={labelCls}>{config.capacityLabel}</span>
          <input
            type="number"
            min={1}
            value={listing.capacity}
            onChange={(e) => setListing({ ...listing, capacity: parseInt(e.target.value) || 1 })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{config.priceLabel}</span>
          <input
            type="number"
            min={0}
            value={listing.price}
            onChange={(e) => setListing({ ...listing, price: parseInt(e.target.value) || 0 })}
            className={inputCls}
          />
        </label>
      </div>

      <div>
        <div className={labelCls}>{config.includesLabel}</div>
        <div className="flex flex-wrap gap-2">
          {config.chips.map((ch) => {
            const on = !!listing.inc[ch.key];
            return (
              <button
                key={ch.key}
                onClick={() =>
                  setListing({ ...listing, inc: { ...listing.inc, [ch.key]: !on } })
                }
                className="border rounded-full px-[14px] py-[8px] text-[12.5px] font-semibold"
                style={{
                  background: on ? "#2DE2F2" : "#14202B",
                  borderColor: on ? "#2DE2F2" : "rgba(255,255,255,.12)",
                  color: on ? "#0D161F" : "#F0F2F5",
                }}
              >
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  profile,
  listing,
  listingConfig,
  categoryLabel,
  verifyStatus,
  payoutSchedule,
}: {
  profile: any;
  listing: any;
  listingConfig: ListingConfig;
  categoryLabel: string;
  verifyStatus: string;
  payoutSchedule: string;
}) {
  const payoutLabel =
    payoutSchedule === "weekly"
      ? "Weekly"
      : payoutSchedule === "monthly"
        ? "Monthly"
        : "After each transaction";
  const rows: Array<[string, string]> = [
    ["Business", profile.name || "—"],
    ["Category", categoryLabel],
    ["Homeport", profile.city || "—"],
    ["Verification", verifyStatus],
    ["Payouts", payoutLabel],
    [
      listingConfig.eyebrow,
      listingConfig.reviewLine({
        title: listing.title,
        capacity: listing.capacity,
        price: listing.price,
        durationMinutes: listing.durationMinutes,
      }),
    ],
  ];
  return (
    <div className="bg-[#14202B] border border-[#2DE2F2]/10 rounded-[18px] p-6 max-w-[720px]">
      <div className="grid gap-3">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between border-b border-[#2DE2F2]/[0.06] pb-3 last:border-0 last:pb-0"
          >
            <span className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#92A0AB]">
              {k}
            </span>
            <span className="text-[13.5px] text-[#F0F2F5] text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

