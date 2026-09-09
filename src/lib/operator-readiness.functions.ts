/**
 * Operator readiness gate: can this business actually take real bookings?
 * Aggregates Stripe Connect payout status, published listings, future
 * availability, profile completeness and verification into one checklist.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedBusiness } from "./stripe-connect.server";

export type ReadinessItem = {
  key: "payouts" | "listings" | "availability" | "profile" | "verification";
  label: string;
  detail: string;
  done: boolean;
  blocking: boolean;
  navKey: string;
};

export const getOperatorReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ businessId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const biz = await getOwnedBusiness(context.supabase, context.userId, data.businessId);
    const { supabase } = context;

    let chargesEnabled = Boolean(biz.charges_enabled);
    let payoutsEnabled = Boolean(biz.payouts_enabled);
    let requirementsDue: string[] = [];

    if (biz.stripe_account_id) {
      try {
        const { getStripe } = await import("./stripe.server");
        const stripe = getStripe();
        if (stripe) {
          const acct = await stripe.accounts.retrieve(biz.stripe_account_id as string);
          chargesEnabled = acct.charges_enabled;
          payoutsEnabled = acct.payouts_enabled;
          requirementsDue = acct.requirements?.currently_due ?? [];
          if (
            chargesEnabled !== Boolean(biz.charges_enabled) ||
            payoutsEnabled !== Boolean(biz.payouts_enabled)
          ) {
            await supabase
              .from("businesses")
              .update({ charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled })
              .eq("id", biz.id);
          }
        }
      } catch (e) {
        console.error("[readiness] stripe retrieve failed", e);
      }
    }

    const { data: services } = await supabase
      .from("bookable_services")
      .select("id,is_published")
      .eq("business_id", biz.id);

    const published = (services ?? []).filter((s: any) => s.is_published);
    const ids = published.map((s: any) => s.id);

    let futureSlots = 0;
    if (ids.length) {
      const { count } = await supabase
        .from("service_availability")
        .select("id", { count: "exact", head: true })
        .in("service_id", ids)
        .gte("starts_at", new Date().toISOString())
        .eq("is_blackout", false);
      futureSlots = count ?? 0;
    }

    const profileOk = Boolean(biz.hero_url && biz.description && biz.city && (biz.phone || biz.email));

    const items: ReadinessItem[] = [
      {
        key: "payouts",
        label: "Payouts connected",
        detail: !biz.stripe_account_id
          ? "Connect your bank through Stripe to receive escrow payouts."
          : chargesEnabled && payoutsEnabled
            ? "Stripe Connect is live."
            : requirementsDue.length
              ? "Stripe still needs a few details before you can be paid."
              : "Finish Stripe onboarding to enable charges and payouts.",
        done: chargesEnabled && payoutsEnabled,
        blocking: true,
        navKey: "payouts",
      },
      {
        key: "listings",
        label: "At least one published listing",
        detail: published.length
          ? `${published.length} listing${published.length === 1 ? "" : "s"} live.`
          : "Publish a listing so anglers can find and book you.",
        done: published.length > 0,
        blocking: true,
        navKey: "listings",
      },
      {
        key: "availability",
        label: "Future availability published",
        detail: futureSlots
          ? `${futureSlots} upcoming departure${futureSlots === 1 ? "" : "s"} bookable.`
          : "Publish dates and seats so guests can pick a day.",
        done: futureSlots > 0,
        blocking: true,
        navKey: "slots",
      },
      {
        key: "profile",
        label: "Profile complete",
        detail: profileOk
          ? "Photo, description and contact details are set."
          : "Add a cover photo, description, city and contact details.",
        done: profileOk,
        blocking: false,
        navKey: "profile",
      },
      {
        key: "verification",
        label: "Verification",
        detail: biz.verified_at
          ? "Verified operator badge active."
          : "Submit documents to earn the verified badge and rank higher.",
        done: Boolean(biz.verified_at),
        blocking: false,
        navKey: "verification",
      },
    ];

    const blockers = items.filter((i) => i.blocking && !i.done);

    return {
      businessId: biz.id as string,
      businessName: biz.name as string,
      isPublished: Boolean(biz.is_published),
      requirementsDue,
      items,
      blockerCount: blockers.length,
      ready: blockers.length === 0,
    };
  });

/** Flip the storefront live once every blocking readiness item is green. */
export const setStorefrontLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ businessId: z.string().uuid().optional(), live: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const biz = await getOwnedBusiness(context.supabase, context.userId, data.businessId);
    const { error } = await context.supabase
      .from("businesses")
      .update({ is_published: data.live })
      .eq("id", biz.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true, isPublished: data.live };
  });
