/**
 * One rule for every "make this live" action: a business can only publish
 * listings, charters, packages, products or its storefront once its setup is
 * complete — Stripe payouts connected, approved verification, plus the basic
 * business details anglers need (name, city, contact).
 */

export type PublishBlocker = "payouts" | "verification" | "details";

const MESSAGES: Record<PublishBlocker, string> = {
  payouts:
    "Connect your payouts (Stripe) before making anything live — anglers can't pay you yet.",
  verification:
    "Your verification is still pending. Submit your documents and wait for approval before making anything live.",
  details:
    "Add your business details (city and a phone or email) before making anything live.",
};

export class PublishBlockedError extends Error {
  missing: PublishBlocker[];
  constructor(missing: PublishBlocker[]) {
    super(MESSAGES[missing[0] ?? "details"]);
    this.name = "PublishBlockedError";
    this.missing = missing;
  }
}

/** Returns the list of missing setup groups for this business. */
export async function publishBlockers(
  supabase: any,
  businessId: string,
): Promise<PublishBlocker[]> {
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("charges_enabled,payouts_enabled,verified_at,name,city,phone,email,stripe_account_id")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !biz) return ["payouts"];

  const payoutsOk = await syncPayoutStatus(supabase, businessId, biz);

  const missing: PublishBlocker[] = [];
  if (!payoutsOk) missing.push("payouts");
  if (!biz.verified_at) missing.push("verification");
  if (!(biz.name && biz.city && (biz.phone || biz.email))) missing.push("details");
  return missing;
}

/**
 * Stored Stripe flags can lag behind reality (missed webhook, operator just
 * finished onboarding). When they say "not connected" but an account exists,
 * ask Stripe directly and persist the fresh result.
 */
export async function syncPayoutStatus(
  supabase: any,
  businessId: string,
  biz: { charges_enabled?: boolean | null; payouts_enabled?: boolean | null; stripe_account_id?: string | null },
): Promise<boolean> {
  if (biz.charges_enabled && biz.payouts_enabled) return true;
  if (!biz.stripe_account_id) return false;
  try {
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    if (!stripe) return false;
    const acct = await stripe.accounts.retrieve(biz.stripe_account_id);
    const ok = Boolean(acct.charges_enabled && acct.payouts_enabled);
    const update = {
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      ...(ok ? { onboarding_completed_at: new Date().toISOString() } : {}),
    };
    let { error } = await supabase.from("businesses").update(update).eq("id", businessId);
    if (error) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      ({ error } = await supabaseAdmin.from("businesses").update(update).eq("id", businessId));
      if (error) console.error("[publish-guard] payout sync failed", error.message);
    }
    return ok;
  } catch (e) {
    console.error("[publish-guard] stripe retrieve failed", e);
    return false;
  }
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
