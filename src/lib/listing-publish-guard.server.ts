/**
 * One rule for every "make this live" action: a business can only publish
 * listings, charters, packages, products or its storefront once its
 * credentials are complete — Stripe payouts connected plus the basic business
 * details anglers need (name, city, contact).
 */

export type PublishBlocker = "payouts" | "details";

export class PublishBlockedError extends Error {
  missing: PublishBlocker[];
  constructor(missing: PublishBlocker[]) {
    super(
      missing.includes("payouts")
        ? "Connect your payouts (Stripe) before making anything live — anglers can't pay you yet."
        : "Add your business details (city and a phone or email) before making anything live.",
    );
    this.name = "PublishBlockedError";
    this.missing = missing;
  }
}

/** Returns the list of missing credential groups for this business. */
export async function publishBlockers(
  supabase: any,
  businessId: string,
): Promise<PublishBlocker[]> {
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("charges_enabled,payouts_enabled,name,city,phone,email")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !biz) return ["payouts"];

  const missing: PublishBlocker[] = [];
  if (!(biz.charges_enabled && biz.payouts_enabled)) missing.push("payouts");
  if (!(biz.name && biz.city && (biz.phone || biz.email))) missing.push("details");
  return missing;
}

/**
 * Throws when `live` is true and the business still has missing credentials.
 * Unpublishing is always allowed.
 */
export async function assertCanPublish(
  supabase: any,
  businessId: string,
  live: boolean | undefined,
) {
  if (!live) return;
  const missing = await publishBlockers(supabase, businessId);
  if (missing.length) throw new PublishBlockedError(missing);
}
