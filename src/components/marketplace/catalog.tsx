export type Cat = "rods" | "tackle" | "apparel" | "electronics";
export type IconKind = "rod" | "reel" | "lure" | "shirt" | "cap" | "spool" | "sonar" | "jacket" | "hook";

export type Product = {
  id: string;
  name: string;
  seller: string;
  sellerType: string;
  price: number;
  rating: string;
  reviews: number;
  cat: Cat;
  badge?: string;
  icon: IconKind;
  description?: string;
  specs?: Array<{ label: string; value: string }>;
  /** Set for real vendor inventory rows (purchasable through Stripe). */
  live?: boolean;
  image?: string | null;
  stockQty?: number;
  /** Fish-X business category key (charter, tackle_shop, apparel_brand, …). */
  sellerCat?: string | null;
};

/** Maps a demo seller's free-text type onto a Fish-X business category key. */
export function sellerCatFromType(sellerType: string): string {
  const s = sellerType.toLowerCase();
  if (/apparel/.test(s)) return "apparel_brand";
  if (/tackle/.test(s)) return "tackle_shop";
  if (/bait/.test(s)) return "bait_shop";
  if (/marina/.test(s)) return "marina";
  if (/lodge/.test(s)) return "lodge";
  if (/guide/.test(s)) return "guide";
  if (/charter|captain/.test(s)) return "charter";
  return "gear_manufacturer";
}


/** Maps a vendor product's free-text category onto a marketplace tab. */
export function catFromCategory(category: string | null, sellerCategory: string | null): Cat {
  const s = `${category ?? ""} ${sellerCategory ?? ""}`.toLowerCase();
  if (/apparel|shirt|hoodie|cap|jacket|wear/.test(s)) return "apparel";
  if (/electronic|sonar|gps|chartplotter|marine tech/.test(s)) return "electronics";
  if (/rod|reel/.test(s)) return "rods";
  return "tackle";
}

/** Picks an illustrative icon when a vendor product has no image. */
export function iconFromCategory(cat: Cat, title: string): IconKind {
  const t = title.toLowerCase();
  if (/reel/.test(t)) return "reel";
  if (/hook/.test(t)) return "hook";
  if (/braid|line|spool/.test(t)) return "spool";
  if (/hoodie|shirt|tee/.test(t)) return "shirt";
  if (/cap|hat/.test(t)) return "cap";
  if (/jacket|shell/.test(t)) return "jacket";
  if (/lure|jig|bait/.test(t)) return "lure";
  if (cat === "electronics") return "sonar";
  if (cat === "apparel") return "shirt";
  if (cat === "rods") return "rod";
  return "lure";
}


/** Sample catalog removed — the marketplace only lists real vendor inventory. */
export const CATALOG: Product[] = [];
const _REMOVED_SAMPLES: Product[] = [
  { id: "p1", name: "Apex 7'0\" Inshore Spinning Rod", seller: "Apex Rod Co.", sellerType: "Gear maker", price: 189, rating: "4.9", reviews: 214, cat: "rods", badge: "Bestseller", icon: "rod",
    description: "Tournament-grade inshore spinning rod hand-built in Tampa. IM8 graphite blank tuned for redfish, snook, and speckled trout — light in the hand, ruthless on the hookset.",
    specs: [{label:"Length",value:"7'0\""},{label:"Power",value:"Medium"},{label:"Action",value:"Fast"},{label:"Line",value:"8–17 lb"},{label:"Lure",value:"1/4–3/4 oz"}] },
  { id: "p2", name: "Sealine 4000 Spinning Reel", seller: "Reel Deal Tackle", sellerType: "Tackle shop", price: 145, rating: "4.8", reviews: 167, cat: "rods", icon: "reel",
    description: "Sealed 8+1 bearing spinning reel with a saltwater-shielded drag stack. The workhorse behind three IGFA line-class records last season.",
    specs: [{label:"Gear ratio",value:"6.2:1"},{label:"Max drag",value:"22 lb"},{label:"Weight",value:"9.3 oz"},{label:"Bearings",value:"8+1"}] },
  { id: "p3", name: "Tarpon Slam Lure Kit · 12 pc", seller: "Reel Deal Tackle", sellerType: "Tackle shop", price: 42, rating: "4.9", reviews: 98, cat: "tackle", badge: "Shop pick", icon: "lure",
    description: "Twelve hand-picked soft plastics and topwaters for the pre-dawn tarpon bite. Colors curated by Captain Miles Alvarez.",
    specs: [{label:"Pieces",value:"12"},{label:"Species",value:"Tarpon, snook"},{label:"Rigging",value:"Weedless"}] },
  { id: "p4", name: "UPF 50 Performance Hoodie", seller: "Tidewater Apparel", sellerType: "Apparel brand", price: 68, rating: "4.9", reviews: 342, cat: "apparel", badge: "Bestseller", icon: "shirt",
    description: "Sun hoodie built for 12-hour offshore days. UPF 50, moisture-wicking, and quick-drying with a face gaiter that actually breathes.",
    specs: [{label:"Fabric",value:"92% poly / 8% spandex"},{label:"UPF",value:"50+"},{label:"Fit",value:"Athletic"}] },
  { id: "p5", name: "Legend Trucker Cap", seller: "Tidewater Apparel", sellerType: "Apparel brand", price: 32, rating: "4.7", reviews: 120, cat: "apparel", icon: "cap",
    description: "Structured 6-panel trucker with a curved brim and salt-resistant snapback. Wear it, wash it, wear it again.",
    specs: [{label:"Front",value:"Cotton twill"},{label:"Back",value:"Mesh"},{label:"Closure",value:"Snapback"}] },
  { id: "p6", name: "ProBraid 30 lb · 300 yd", seller: "Reel Deal Tackle", sellerType: "Tackle shop", price: 28, rating: "4.8", reviews: 76, cat: "tackle", icon: "spool",
    description: "8-carrier braided line with a tight weave and a low-vis moss-green finish. Zero stretch, all hookset.",
    specs: [{label:"Test",value:"30 lb"},{label:"Length",value:"300 yd"},{label:"Diameter",value:"0.25 mm"}] },
  { id: "p7", name: "CoastScan 7\" Sonar / GPS", seller: "Apex Rod Co.", sellerType: "Gear maker", price: 899, rating: "4.9", reviews: 58, cat: "electronics", badge: "New", icon: "sonar",
    description: "7-inch chartplotter with CHIRP sonar, side-scan, and preloaded coastal charts. NMEA 2000 ready.",
    specs: [{label:"Display",value:"7\" HD"},{label:"Sonar",value:"CHIRP + SideVu"},{label:"GPS",value:"10 Hz"}] },
  { id: "p8", name: "Foul-Weather Shell Jacket", seller: "Tidewater Apparel", sellerType: "Apparel brand", price: 148, rating: "4.8", reviews: 203, cat: "apparel", icon: "jacket",
    description: "3-layer waterproof shell with taped seams and a storm hood. Tested on 40-knot runs out of Montauk.",
    specs: [{label:"Waterproof",value:"20K mm"},{label:"Breathability",value:"15K g/m²"},{label:"Seams",value:"Fully taped"}] },
  { id: "p9", name: "Circle Hook Pro Pack · 50", seller: "Reel Deal Tackle", sellerType: "Tackle shop", price: 18, rating: "4.9", reviews: 311, cat: "tackle", icon: "hook",
    description: "50 forged inline circle hooks — chemically sharpened, corrosion-resistant, and IGFA-legal for the release fleet.",
    specs: [{label:"Count",value:"50"},{label:"Sizes",value:"3/0 – 7/0"},{label:"Finish",value:"Black nickel"}] },
];

export const tileFor = (cat: Cat): { bg: string; ink: string } => {
  if (cat === "rods") return { bg: "linear-gradient(150deg,#E2F6FA,#ecd8b8)", ink: "#1F9FBE" };
  if (cat === "tackle") return { bg: "linear-gradient(150deg,#e2eef2,#d2e4ea)", ink: "#1f9fbe" };
  if (cat === "apparel") return { bg: "linear-gradient(150deg,#e9edf1,#dde3e9)", ink: "#5c6b78" };
  return { bg: "linear-gradient(150deg,#12314b,#072057)", ink: "#2DE2F2" };
};

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

import type { ReactNode } from "react";

export function ProductIcon({ kind, size = 46 }: { kind: IconKind; size?: number }) {
  const paths: Record<IconKind, ReactNode> = {
    rod: (<><path d="M3 21 20 4" /><path d="M20 4c1.5 3-1 6-3 6" /><circle cx="6" cy="18" r="1.2" /><circle cx="10" cy="14" r="1.2" /><circle cx="14" cy="10" r="1.2" /></>),
    reel: (<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.4" /><path d="M12 5V2M19 12h3" /></>),
    lure: (<><path d="M3 12c4-5 10-6 15-3l3 3-3 3c-5 3-11 2-15-3z" /><circle cx="16" cy="11" r=".9" /><path d="M8 15l-1.5 4M12 16l0 4" /></>),
    shirt: (<path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3-2 2h-4z" />),
    cap: (<><path d="M4 13a8 8 0 0 1 16 0v2H4z" /><path d="M4 15c6 3 10 3 16 0M12 5V3" /></>),
    spool: (<><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.5" /></>),
    sonar: (<><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M6 14l3-4 3 2 4-5" /><path d="M9 21h6" /></>),
    jacket: (<><path d="M9 3h6l4 4-2 3-1-1v12H8V9L7 10 5 7z" /><path d="M12 3v18" /></>),
    hook: (<><path d="M16 3a5 5 0 0 1 0 10c-3 0-5-2-5-5" /><path d="M11 8v8a4 4 0 0 0 8 0" /></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
}
