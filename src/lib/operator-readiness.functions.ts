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

    // Shops satisfy the "something to sell" bar with live, in-stock products.
    const { data: productRows } = await supabase
      .from("inventory_products")
      .select("id,is_published,stock_qty")
      .eq("business_id", biz.id);
    const liveProducts = (productRows ?? []).filter(
      (p: any) => p.is_published && (p.stock_qty ?? 0) > 0,
    ).length;

    const sellable = published.length > 0 || liveProducts > 0;
    const bookable = futureSlots > 0 || liveProducts > 0;

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
        detail: published.length || liveProducts
          ? `${published.length} listing${published.length === 1 ? "" : "s"} live${liveProducts ? ` · ${liveProducts} product${liveProducts === 1 ? "" : "s"} in stock` : ""}.`
          : "Publish a listing or product so anglers can find and book you.",
        done: sellable,
        blocking: true,
        navKey: "listings",
      },
      {
        key: "availability",
        label: "Future availability published",
        detail: futureSlots
          ? `${futureSlots} upcoming departure${futureSlots === 1 ? "" : "s"} bookable.`
          : liveProducts
            ? "Products are in stock and orderable."
            : "Publish dates and seats so guests can pick a day.",
        done: bookable,
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
    const ready = blockers.length === 0;
    const grace = Boolean((biz as any).listing_grace) && !ready;

    // Grandfathered operators get one warning that their page will be hidden
    // once they stop being bookable. Best-effort: never blocks the console.
    if (grace && !(biz as any).listing_grace_notified_at) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendDirectNotification } = await import("./notifications.server");
        const { data: team } = await supabaseAdmin
          .from("business_members")
          .select("user_id")
          .eq("business_id", biz.id);
        await supabaseAdmin
          .from("businesses")
          .update({ listing_grace_notified_at: new Date().toISOString() })
          .eq("id", biz.id);
        await Promise.all(
          (team ?? []).map((m: { user_id: string }) =>
            sendDirectNotification(supabaseAdmin, {
              userId: m.user_id,
              category: "verification",
              title: "Finish setup to stay visible to anglers",
              body: `${biz.name} is still showing on FISH-X.COM, but listings now only appear once payouts are connected and you have upcoming dates or in-stock products. Finish the remaining steps to stay listed.`,
              link: "/dashboard?tab=payouts",
              severity: "warning",
              meta: { businessId: biz.id, blockers: blockers.map((b) => b.key) },
            }),
          ),
        );
      } catch (e) {
        console.error("[readiness] grace notice failed", e);
      }
    }


    return {
      businessId: biz.id as string,
      businessName: biz.name as string,
      isPublished: Boolean(biz.is_published),
      requirementsDue,
      items,
      blockerCount: blockers.length,
      ready,
      grace,
      // Anglers only see this operator when it is published AND bookable
      // (or still inside the grandfather window).
      listingVisible: Boolean(biz.is_published) && (ready || grace),
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

    // Going live is only allowed when the operator can actually be booked —
    // payouts connected plus an upcoming date or an in-stock product.
    if (data.live) {
      const missing: string[] = [];
      if (!(biz.charges_enabled && biz.payouts_enabled)) missing.push("payouts");
      const { data: svc } = await context.supabase
        .from("bookable_services")
        .select("id")
        .eq("business_id", biz.id)
        .eq("is_published", true);
      const ids = (svc ?? []).map((s: any) => s.id);
      let slots = 0;
      if (ids.length) {
        const { count } = await context.supabase
          .from("service_availability")
          .select("id", { count: "exact", head: true })
          .in("service_id", ids)
          .gte("starts_at", new Date().toISOString())
          .eq("is_blackout", false);
        slots = count ?? 0;
      }
      const { count: prodCount } = await context.supabase
        .from("inventory_products")
        .select("id", { count: "exact", head: true })
        .eq("business_id", biz.id)
        .eq("is_published", true)
        .gt("stock_qty", 0);
      if (!slots && !(prodCount ?? 0)) missing.push("availability");
      if (missing.length) {
        return { ok: false as const, isPublished: Boolean(biz.is_published), missing };
      }
    }

    const { error } = await context.supabase
      .from("businesses")
      .update({ is_published: data.live })
      .eq("id", biz.id);
    if (error) throw new Response(error.message, { status: 400 });

    return { ok: true as const, isPublished: data.live, missing: [] as string[] };
  });
