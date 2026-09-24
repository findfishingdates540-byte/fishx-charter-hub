export type VerificationDocSpec = { key: string; title: string; desc: string };

export const VERIFICATION_BY_CATEGORY: Record<string, { headline: string; docs: VerificationDocSpec[] }> = {
  charter: { headline: "Charter captains need proof of licensure, vessel coverage, and identity.", docs: [
    { key: "captain_license", title: "Captain's license", desc: "USCG OUPV / Master or national equivalent" },
    { key: "vessel_insurance", title: "Vessel insurance", desc: "Current liability & hull coverage" },
    { key: "gov_id", title: "Government ID", desc: "Passport or driver's license" },
  ] },
  guide_service: { headline: "Guides need a state guide license and general liability coverage.", docs: [
    { key: "guide_license", title: "Fishing guide license", desc: "State parks & wildlife guide permit" },
    { key: "liability_insurance", title: "General liability insurance", desc: "Minimum $1M recommended" },
    { key: "gov_id", title: "Government ID", desc: "Passport or driver's license" },
  ] },
  tackle_shop: { headline: "Retailers verify business registration and tax standing.", docs: [
    { key: "business_license", title: "Business license", desc: "State or municipal registration" },
    { key: "resale_cert", title: "Resale / sales tax certificate", desc: "For inventory sold on Fish-X" },
    { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
  ] },
  bait_shop: { headline: "Live-bait dealers need a wildlife or health permit alongside your business license.", docs: [
    { key: "business_license", title: "Business license", desc: "State or municipal registration" },
    { key: "bait_permit", title: "Live bait dealer permit", desc: "State wildlife / health department" },
    { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
  ] },
  marina: { headline: "Marinas verify operating permits and dockage liability coverage.", docs: [
    { key: "business_license", title: "Business license", desc: "State or municipal registration" },
    { key: "marina_permit", title: "Marina operating permit", desc: "Harbor / environmental compliance permit" },
    { key: "liability_insurance", title: "Marina liability insurance", desc: "Dockage & pollution coverage" },
  ] },
  lodge: { headline: "Lodges verify hospitality permitting and guest liability coverage.", docs: [
    { key: "business_license", title: "Business license", desc: "State or municipal registration" },
    { key: "lodging_permit", title: "Lodging / hospitality permit", desc: "Occupancy or short-term rental permit" },
    { key: "liability_insurance", title: "Property & liability insurance", desc: "Guest & property coverage" },
  ] },
  apparel: { headline: "Apparel brands verify business identity and brand ownership.", docs: [
    { key: "business_license", title: "Business license", desc: "State or municipal registration" },
    { key: "trademark_doc", title: "Trademark or brand document", desc: "Trademark certificate or brand registration" },
    { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
  ] },
  gear_mfg: { headline: "Manufacturers verify business identity and product liability coverage.", docs: [
    { key: "business_license", title: "Business license", desc: "State or municipal registration" },
    { key: "product_liability", title: "Product liability insurance", desc: "Coverage for manufactured goods" },
    { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license of the business owner" },
  ] },
};

export const DEFAULT_VERIFICATION = { headline: "Upload current business credentials for review.", docs: [
  { key: "business_license", title: "Business license", desc: "Current registration or operating permit" },
  { key: "insurance", title: "Insurance certificate", desc: "Current liability coverage" },
  { key: "gov_id", title: "Owner ID", desc: "Passport or driver's license" },
] };

export function getVerificationConfig(categoryKey: string) {
  return VERIFICATION_BY_CATEGORY[categoryKey] ?? DEFAULT_VERIFICATION;
}