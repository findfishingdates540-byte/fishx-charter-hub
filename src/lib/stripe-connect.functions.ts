/**
 * Stripe Connect onboarding for service providers (captains, guides, marinas,
 * tackle shops, manufacturers, apparel brands).
 *
 * Uses Express accounts: the operator onboards on Stripe-hosted pages, then
 * `charges_enabled` / `payouts_enabled` are synced back onto `businesses`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedBusiness, findOwnedBusiness } from "./stripe-connect.server";

export const getConnectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const biz = await findOwnedBusiness(context.supabase, context.userId, data.businessId);
    if (!biz) {
      return {
        businessId: null as string | null,
        businessName: null as string | null,
        stripeConfigured: false,
        stripeAccountId: null as string | null,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
        commissionRate: 0.2,
        noBusiness: true,
      };
    }
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    let chargesEnabled = biz.charges_enabled ?? false;
    let payoutsEnabled = biz.payouts_enabled ?? false;
    let requirementsDue: string[] = [];

    if (stripe && biz.stripe_account_id) {
      try {
        const acct = await stripe.accounts.retrieve(biz.stripe_account_id);
        chargesEnabled = acct.charges_enabled;
        payoutsEnabled = acct.payouts_enabled;
        requirementsDue = acct.requirements?.currently_due ?? [];
        const { error } = await context.supabase
          .from("businesses")
          .update({
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            onboarding_completed_at:
              chargesEnabled && payoutsEnabled ? new Date().toISOString() : biz.onboarding_completed_at,
          })
          .eq("id", biz.id);
        if (error) console.error("[stripe] status sync failed", error.message);
      } catch (err) {
        console.error("[stripe] account retrieve failed", err);
      }
    }

    return {
      businessId: biz.id as string | null,
      businessName: biz.name as string | null,
      stripeConfigured: Boolean(stripe),
      stripeAccountId: (biz.stripe_account_id as string | null) ?? null,
      chargesEnabled,
      payoutsEnabled,
      requirementsDue,
      commissionRate: Number(biz.commission_rate ?? 0.2),
      noBusiness: false,
    };
  });

// GET on purpose: some hosting layers (Netlify/CDN redirects) downgrade POST
// to GET on /_serverFn/*, which surfaces as "Expected POST. Got GET".
export const createConnectOnboardingLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ businessId: z.string().uuid().optional(), returnUrl: z.string().url() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const biz = await getOwnedBusiness(context.supabase, context.userId, data.businessId);
    const { requireStripe } = await import("./stripe.server");
    const stripe = requireStripe();
    let accountId = biz.stripe_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: biz.email ?? undefined,
        business_profile: {
          name: biz.name,
          url: biz.website ?? undefined,
        },
        metadata: { business_id: biz.id },
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      const { error } = await context.supabase
        .from("businesses")
        .update({ stripe_account_id: accountId, stripe_account_type: "express" })
        .eq("id", biz.id);
      if (error) throw new Error(error.message);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: data.returnUrl,
      return_url: data.returnUrl,
      type: "account_onboarding",
    });

    return { url: link.url, accountId };
  });

/** Express dashboard link so operators can see their balance and payouts. */
export const createConnectDashboardLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const biz = await getOwnedBusiness(context.supabase, context.userId, data.businessId);
    if (!biz.stripe_account_id) throw new Error("Connect your payout account first");
    const { requireStripe } = await import("./stripe.server");
    const login = await requireStripe().accounts.createLoginLink(biz.stripe_account_id);
    return { url: login.url };
  });
