/**
 * Product (gear / tackle / bait / apparel / manufacturer) checkout.
 *
 * Money model mirrors bookings: the buyer pays the PLATFORM account, orders are
 * created as `pending_payment`, and the Stripe webhook marks them paid and
 * transfers the vendor's share to their connected account. The platform keeps
 * PRODUCT_FEE_RATE (8%) of the order total.
 * A multi-vendor cart produces one order row per vendor but a single Stripe
 * Checkout session. Shipping is computed on the SERVER from each vendor's
 * shipping settings — never trusted from the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoreProduct = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number;
  image: string | null;
  businessId: string;
  sellerName: string;
  sellerCategory: string | null;
  variants?: ProductVariant[];
  wholesaleOnly?: boolean;
};

export type ProductVariant = {
  id: string;
  option_name: string;
  option_value: string;
  sku: string | null;
  price_delta_cents: number;
  stock_qty: number;
};

const firstImage = (images: unknown): string | null => {
  if (Array.isArray(images) && images.length > 0) {
    const i = images[0];
    if (typeof i === "string") return i;
    if (i && typeof i === "object" && typeof (i as { url?: string }).url === "string") {
      return (i as { url: string }).url;
    }
  }
  return null;
};

/** Published vendor inventory available to buy in the marketplace. */
export const listStoreProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("inventory_products")
    .select(
      "id,title,description,category,price_cents,compare_at_cents,stock_qty,images,business_id,business:businesses(name,category_key,is_published)",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Response(error.message, { status: 500 });

  // Wholesale-only lines never appear in the retail marketplace.
  const { data: tradeOnly } = await supabaseAdmin
    .from("product_wholesale_settings")
    .select("product_id")
    .eq("wholesale_only", true);
  const hidden = new Set((tradeOnly ?? []).map((r) => r.product_id));

  return (data ?? [])
    .filter((p) => !hidden.has(p.id))
    .filter((p) => (p.business as { is_published?: boolean } | null)?.is_published !== false)
    .map<StoreProduct>((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      priceCents: p.price_cents ?? 0,
      compareAtCents: p.compare_at_cents,
      stockQty: p.stock_qty ?? 0,
      image: firstImage(p.images),
      businessId: p.business_id,
      sellerName: (p.business as { name?: string } | null)?.name ?? "Fish-X vendor",
      sellerCategory: (p.business as { category_key?: string } | null)?.category_key ?? null,
    }));
});


/* ---------------- Shipping (server-authoritative) ---------------- */

export type VendorShipping = {
  flatRateCents: number;
  perItemCents: number;
  freeOverCents: number | null;
  policyNote: string | null;
};

/** Fallback used when a vendor hasn't configured shipping yet. */
export const DEFAULT_SHIPPING: VendorShipping = {
  flatRateCents: 800,
  perItemCents: 0,
  freeOverCents: 15000,
  policyNote: null,
};

type ShippingClient = {
  from: (t: string) => any;
};

async function loadShippingSettings(
  client: ShippingClient,
  businessIds: string[],
): Promise<Map<string, VendorShipping>> {
  const map = new Map<string, VendorShipping>();
  if (!businessIds.length) return map;
  const { data } = await client
    .from("vendor_shipping_settings")
    .select("business_id,flat_rate_cents,per_item_cents,free_over_cents,policy_note")
    .in("business_id", businessIds);
  for (const row of (data ?? []) as any[]) {
    map.set(row.business_id, {
      flatRateCents: row.flat_rate_cents ?? 0,
      perItemCents: row.per_item_cents ?? 0,
      freeOverCents: row.free_over_cents ?? null,
      policyNote: row.policy_note ?? null,
    });
  }
  return map;
}

/** Shipping charged by one vendor for a given subtotal / unit count. */
export function shippingFor(
  settings: VendorShipping,
  subtotalCents: number,
  units: number,
): number {
  if (subtotalCents <= 0) return 0;
  if (settings.freeOverCents != null && subtotalCents >= settings.freeOverCents) return 0;
  const extras = Math.max(0, units - 1) * settings.perItemCents;
  return settings.flatRateCents + extras;
}

/**
 * Public shipping quote so the cart can show the same number the server will
 * charge. Reads published products only.
 */
export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        items: z
          .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
          .max(30),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    if (!data.items.length) return { shippingCents: 0, byVendor: [] as Array<{ businessId: string; shippingCents: number }> };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: products } = await supabaseAdmin
      .from("inventory_products")
      .select("id,price_cents,business_id,is_published")
      .in("id", data.items.map((i) => i.productId));

    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    const groups = new Map<string, { subtotal: number; units: number }>();
    for (const item of data.items) {
      const p = byId.get(item.productId);
      if (!p || !p.is_published) continue;
      const g = groups.get(p.business_id) ?? { subtotal: 0, units: 0 };
      g.subtotal += (p.price_cents ?? 0) * item.quantity;
      g.units += item.quantity;
      groups.set(p.business_id, g);
    }

    const settings = await loadShippingSettings(supabaseAdmin as never, [...groups.keys()]);
    const byVendor = [...groups.entries()].map(([businessId, g]) => ({
      businessId,
      shippingCents: shippingFor(settings.get(businessId) ?? DEFAULT_SHIPPING, g.subtotal, g.units),
    }));
    return {
      shippingCents: byVendor.reduce((a, v) => a + v.shippingCents, 0),
      byVendor,
    };
  });

const CheckoutInput = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(200),
        variantId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(30),
  origin: z.string().url().optional(),
});

export const createProductCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CheckoutInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { splitAmount, requireStripe, PRODUCT_FEE_RATE } = await import("./stripe.server");

    const ids = data.items.map((i) => i.productId);
    const { data: products, error } = await supabaseAdmin
      .from("inventory_products")
      .select("id,title,sku,price_cents,stock_qty,images,business_id,is_published")
      .in("id", ids);
    if (error) throw new Response(error.message, { status: 500 });

    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    // Variants carry their own SKU, stock and price delta.
    const variantIds = data.items.map((i) => i.variantId).filter(Boolean) as string[];
    const variantById = new Map<string, any>();
    if (variantIds.length) {
      const { data: variants } = await supabaseAdmin
        .from("product_variants")
        .select("id,product_id,option_name,option_value,sku,price_delta_cents,stock_qty")
        .in("id", variantIds);
      for (const v of variants ?? []) variantById.set(v.id, v);
    }

    // Approved trade buyers get wholesale pricing, MOQ and break pricing.
    const businessIds = [...new Set((products ?? []).map((p) => p.business_id))];
    const { data: approved } = await supabaseAdmin
      .from("trade_accounts")
      .select("business_id")
      .eq("buyer_id", userId)
      .eq("status", "approved")
      .in("business_id", businessIds);
    const tradeFor = new Set((approved ?? []).map((r) => r.business_id));

    const { data: wholesaleRows } = await supabaseAdmin
      .from("product_wholesale_settings")
      .select("product_id,business_id,min_order_qty,case_pack,wholesale_only,wholesale_price_cents")
      .in("product_id", ids);
    const wholesaleBy = new Map((wholesaleRows ?? []).map((r) => [r.product_id, r]));
    const { data: tierRows } = await supabaseAdmin
      .from("product_price_tiers")
      .select("product_id,min_qty,unit_price_cents")
      .in("product_id", ids)
      .order("min_qty");

    const unitPriceFor = (product: any, qty: number, variant: any | null) => {
      const base = (product.price_cents ?? 0) + (variant?.price_delta_cents ?? 0);
      const w = wholesaleBy.get(product.id);
      if (!w || !tradeFor.has(product.business_id)) return base;
      let price = w.wholesale_price_cents ?? base;
      for (const t of tierRows ?? []) {
        if (t.product_id === product.id && qty >= t.min_qty) price = t.unit_price_cents;
      }
      return price + (variant?.price_delta_cents ?? 0);
    };

    for (const item of data.items) {
      const p = byId.get(item.productId);
      if (!p || !p.is_published) throw new Response("Product is no longer available", { status: 404 });
      const w = wholesaleBy.get(p.id);
      if (w?.wholesale_only && !tradeFor.has(p.business_id)) {
        throw new Response(`"${p.title}" is available to approved trade buyers only`, { status: 403 });
      }
      if (w && tradeFor.has(p.business_id)) {
        if (item.quantity < (w.min_order_qty ?? 1)) {
          throw new Response(
            `"${p.title}" has a minimum order of ${w.min_order_qty} units`,
            { status: 400 },
          );
        }
        if ((w.case_pack ?? 1) > 1 && item.quantity % w.case_pack !== 0) {
          throw new Response(
            `"${p.title}" ships in cases of ${w.case_pack}`,
            { status: 400 },
          );
        }
      }
      const variant = item.variantId ? variantById.get(item.variantId) : null;
      if (item.variantId && (!variant || variant.product_id !== p.id)) {
        throw new Response("That option is no longer available", { status: 404 });
      }
      const available = variant ? variant.stock_qty : (p.stock_qty ?? 0);
      if (available < item.quantity) {
        throw new Response(`Only ${available} left of "${p.title}"`, { status: 409 });
      }
    }

    // Group the cart by vendor — one order row per business.
    const groups = new Map<
      string,
      Array<{ product: NonNullable<ReturnType<typeof byId.get>>; qty: number; variant: any | null; unit: number }>
    >();
    for (const item of data.items) {
      const p = byId.get(item.productId)!;
      const variant = item.variantId ? variantById.get(item.variantId) : null;
      const list = groups.get(p.business_id) ?? [];
      list.push({
        product: p,
        qty: item.quantity,
        variant,
        unit: unitPriceFor(p, item.quantity, variant),
      });
      groups.set(p.business_id, list);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name,display_name")
      .eq("id", userId)
      .maybeSingle();
    const buyerName = profile?.full_name ?? profile?.display_name ?? null;

    // Every seller in the cart must be able to receive money before we take
    // the buyer's card — otherwise the charge lands with no payable vendor.
    const { assertVendorsPayable } = await import("./vendor-payments.server");
    await assertVendorsPayable(supabaseAdmin as never, [...groups.keys()]);

    const shippingSettings = await loadShippingSettings(supabaseAdmin as never, [...groups.keys()]);
    let shippingTotal = 0;

    const orderIds: string[] = [];
    const lineItems: Array<Record<string, unknown>> = [];
    let grandTotal = 0;

    for (const [businessId, lines] of groups) {
      const subtotal = lines.reduce((a, l) => a + l.unit * l.qty, 0);
      const units = lines.reduce((a, l) => a + l.qty, 0);
      // Each vendor ships separately, so each order carries its own shipping.
      const shipping = shippingFor(
        shippingSettings.get(businessId) ?? DEFAULT_SHIPPING,
        subtotal,
        units,
      );
      shippingTotal += shipping;
      const total = subtotal + shipping;
      const { platformFeeCents, vendorCents } = splitAmount(total, PRODUCT_FEE_RATE);

      const { data: order, error: ordErr } = await supabaseAdmin
        .from("product_orders")
        .insert({
          business_id: businessId,
          buyer_id: userId,
          buyer_name: buyerName,
          subtotal_cents: subtotal,
          shipping_cents: shipping,
          tax_cents: 0,
          total_cents: total,
          status: "pending_payment",
          payout_cents: vendorCents,
          application_fee_cents: platformFeeCents,
        })
        .select("id")
        .single();
      if (ordErr) throw new Response(ordErr.message, { status: 500 });
      orderIds.push(order.id);
      grandTotal += total;

      const { error: itemErr } = await supabaseAdmin.from("product_order_items").insert(
        lines.map((l) => ({
          order_id: order.id,
          product_id: l.product.id,
          variant_id: l.variant?.id ?? null,
          variant_label: l.variant
            ? `${l.variant.option_name}: ${l.variant.option_value}`
            : null,
          title: l.product.title,
          sku: l.variant?.sku ?? l.product.sku,
          unit_price_cents: l.unit,
          quantity: l.qty,
        })),
      );
      if (itemErr) throw new Response(itemErr.message, { status: 500 });

      for (const l of lines) {
        const image = firstImage(l.product.images);
        lineItems.push({
          quantity: l.qty,
          price_data: {
            currency: "usd",
            unit_amount: l.unit,
            product_data: {
              name: l.variant
                ? `${l.product.title} (${l.variant.option_value})`
                : l.product.title,
              ...(image ? { images: [image] } : {}),
            },
          },
        });
      }
    }

    if (shippingTotal > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: shippingTotal,
          product_data: { name: "Shipping" },
        },
      });
    }

    const stripe = requireStripe();
    const origin = data.origin ?? "https://booking.fish-x.com";
    const metadata = {
      kind: "product_order",
      order_ids: orderIds.join(","),
      buyer_id: userId,
    };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems as never,
        metadata,
        payment_intent_data: { metadata },
        // Vendors need somewhere to ship to.
        shipping_address_collection: {
          allowed_countries: ["US", "CA", "GB", "AU", "NZ", "IE", "MX", "ZA", "NG"],
        },
        phone_number_collection: { enabled: true },
        success_url: `${origin}/marketplace?paid=1&order=${orderIds[0]}`,
        cancel_url: `${origin}/marketplace?canceled=1`,
      },
      { idempotencyKey: `product-checkout-${orderIds.join("-")}` },
    );

    await supabaseAdmin
      .from("product_orders")
      .update({
        stripe_session_id: session.id,
        ...(typeof session.payment_intent === "string"
          ? { stripe_payment_intent_id: session.payment_intent }
          : {}),
      })
      .in("id", orderIds);

    return { orderIds, totalCents: grandTotal, checkoutUrl: session.url };
  });

/** Owner preview of a product regardless of publish state (preview mode). */
export const previewStoreProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p, error } = await supabase
      .from("inventory_products")
      .select(
        "id,title,description,category,price_cents,compare_at_cents,stock_qty,images,business_id,is_published,business:businesses(name,category_key)",
      )
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!p) return null;
    const { data: member } = await supabase.rpc("is_business_member", {
      _business_id: p.business_id,
      _user_id: userId,
      _min_role: "staff",
    });
    if (!member) throw new Response("Forbidden", { status: 403 });
    const [{ data: variants }, { data: wholesale }] = await Promise.all([
      supabase
        .from("product_variants")
        .select("id,option_name,option_value,sku,price_delta_cents,stock_qty")
        .eq("product_id", p.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("product_wholesale_settings")
        .select("wholesale_only")
        .eq("product_id", p.id)
        .maybeSingle(),
    ]);
    const product: StoreProduct = {
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      priceCents: p.price_cents ?? 0,
      compareAtCents: p.compare_at_cents,
      stockQty: p.stock_qty ?? 0,
      image: firstImage(p.images),
      businessId: p.business_id,
      sellerName: (p.business as { name?: string } | null)?.name ?? "Fish-X vendor",
      sellerCategory: (p.business as { category_key?: string } | null)?.category_key ?? null,
      variants: variants ?? [],
      wholesaleOnly: wholesale?.wholesale_only ?? false,
    };
    return product;
  });

/** Single published vendor product (public — used by the product detail page). */
export const getStoreProduct = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("inventory_products")
      .select(
        "id,title,description,category,price_cents,compare_at_cents,stock_qty,images,business_id,is_published,business:businesses(name,category_key)",
      )
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!p || !p.is_published) return null;
    const [{ data: variants }, { data: wholesale }] = await Promise.all([
      supabaseAdmin
        .from("product_variants")
        .select("id,option_name,option_value,sku,price_delta_cents,stock_qty")
        .eq("product_id", p.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabaseAdmin
        .from("product_wholesale_settings")
        .select("wholesale_only")
        .eq("product_id", p.id)
        .maybeSingle(),
    ]);
    const product: StoreProduct = {
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      priceCents: p.price_cents ?? 0,
      compareAtCents: p.compare_at_cents,
      stockQty: p.stock_qty ?? 0,
      image: firstImage(p.images),
      businessId: p.business_id,
      sellerName: (p.business as { name?: string } | null)?.name ?? "Fish-X vendor",
      sellerCategory: (p.business as { category_key?: string } | null)?.category_key ?? null,
      variants: variants ?? [],
      wholesaleOnly: wholesale?.wholesale_only ?? false,
    };
    return product;
  });
