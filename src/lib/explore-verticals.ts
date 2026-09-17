/**
 * Shared definition of the Explore hub verticals. Used by the angler Explore
 * hub (dashboard tab) and by the public /explore/$vertical directory pages so
 * both always describe the same parts of the industry.
 */
import { PLATFORM_PHOTOS } from "@/lib/platform-photos";

export type Vertical = {
  key: string;
  title: string;
  blurb: string;
  action: string;
  photo: string;
  /** Business categories that belong to this vertical. */
  categories: string[];
  /** Optional marketplace call-to-action on the vertical page. */
  marketplace?: boolean;
  /** Charters have their own dedicated explorer. */
  href?: string;
};

export const VERTICALS: Vertical[] = [
  {
    key: "charters",
    title: "Charter captains",
    blurb:
      "Book an exclusive time block with a verified captain — offshore, inshore or nearshore, boat and crew included.",
    action: "Browse charters",
    photo: PLATFORM_PHOTOS.marinaSunset,
    categories: ["charter"],
  },
  {
    key: "guides",
    title: "Fishing guides",
    blurb:
      "Wade, kayak and river guides who bring the local knowledge, the gear and the spots that actually produce.",
    action: "Find a guide",
    photo: PLATFORM_PHOTOS.openWater,
    categories: ["guide_service"],
  },
  {
    key: "marinas",
    title: "Marinas & slips",
    blurb:
      "Reserve a slip or mooring by the night or the season, with fuel, power and dock services on site.",
    action: "Browse marinas",
    photo: PLATFORM_PHOTOS.harbourFleet,
    categories: ["marina"],
  },
  {
    key: "tackle",
    title: "Tackle & bait shops",
    blurb:
      "Local shops stocking rods, reels, terminal tackle and fresh bait — order ahead or shop their full catalog.",
    action: "Shop local",
    photo: PLATFORM_PHOTOS.dockLines,
    categories: ["tackle_shop", "bait_shop"],
    marketplace: true,
  },
  {
    key: "lodges",
    title: "Lodges & stays",
    blurb:
      "Fishing lodges and waterside stays built around early starts — rooms, meals and dock access in one booking.",
    action: "Browse lodges",
    photo: PLATFORM_PHOTOS.quietBasin,
    categories: ["lodge"],
  },
  {
    key: "gear",
    title: "Gear & apparel",
    blurb:
      "Rods, reels, electronics and apparel from verified brands, with escrow-protected checkout and tracked delivery.",
    action: "Open marketplace",
    photo: PLATFORM_PHOTOS.duskFleet,
    categories: ["gear_mfg", "apparel"],
    marketplace: true,
  },
];

export const verticalFor = (key: string | undefined) =>
  VERTICALS.find((v) => v.key === key) ?? null;
