/**
 * Angler shopping account: orders, wishlist (saved items) and followed sellers.
 * All queries run as the signed-in user (RLS applies).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export type MyOrder = {
  id: string;
  status: string;
  totalCents: number;
  shippingCents: number;
  subtotalCents: number;
  createdAt: string;
  trackingNumber: string | null;
  sellerName: string;
  businessId: string;
  discountCents: number;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingAddress: Record<string, string | null> | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
    productId: string | null;
    image: string | null;
  }>;
};

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("product_orders")
      .select(
        "id,status,total_cents,shipping_cents,subtotal_cents,created_at,paid_at,shipped_at,delivered_at,discount_cents,shipping_address,tracking_number,business_id,business:businesses(name),items:product_order_items(id,title,quantity,unit_price_cents,product_id,product:inventory_products(images))",
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Response(error.message, { status: 500 });

    return (data ?? []).map<MyOrder>((o: any) => ({
      id: o.id,
      status: o.status,
      totalCents: o.total_cents ?? 0,
      shippingCents: o.shipping_cents ?? 0,
      subtotalCents: o.subtotal_cents ?? 0,
      createdAt: o.created_at,
      trackingNumber: o.tracking_number ?? null,
      discountCents: o.discount_cents ?? 0,
      paidAt: o.paid_at ?? null,
      shippedAt: o.shipped_at ?? null,
      deliveredAt: o.delivered_at ?? null,
      shippingAddress: o.shipping_address ?? null,
      businessId: o.business_id,
      sellerName: o.business?.name ?? "Fish-X vendor",
      items: (o.items ?? []).map((i: any) => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        unitPriceCents: i.unit_price_cents ?? 0,
        productId: i.product_id ?? null,
        image: firstImage(i.product?.images),
      })),
    }));
  });

export type WishlistItem = {
  productId: string;
  title: string;
  priceCents: number;
  image: string | null;
  stockQty: number;
  sellerName: string;
  addedAt: string;
};

export const listMyWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("product_wishlist")
      .select(
        "product_id,created_at,product:inventory_products(id,title,price_cents,images,stock_qty,is_published,business:businesses(name))",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Response(error.message, { status: 500 });

    return (data ?? [])
      .filter((r: any) => r.product)
      .map<WishlistItem>((r: any) => ({
        productId: r.product_id,
        title: r.product.title,
        priceCents: r.product.price_cents ?? 0,
        image: firstImage(r.product.images),
        stockQty: r.product.stock_qty ?? 0,
        sellerName: r.product.business?.name ?? "Fish-X vendor",
        addedAt: r.created_at,
      }));
  });

/** Ids only — used to paint hearts on marketplace cards. */
export const listMyWishlistIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("product_wishlist")
      .select("product_id")
      .eq("user_id", userId);
    if (error) throw new Response(error.message, { status: 500 });
    return (data ?? []).map((r: { product_id: string }) => r.product_id);
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: readErr } = await supabase
      .from("product_wishlist")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", data.productId)
      .maybeSingle();
    if (readErr) throw new Response(readErr.message, { status: 500 });

    if (existing) {
      const { error } = await supabase.from("product_wishlist").delete().eq("id", existing.id);
      if (error) throw new Response(error.message, { status: 400 });
      return { saved: false };
    }
    const { error } = await supabase
      .from("product_wishlist")
      .insert({ user_id: userId, product_id: data.productId });
    if (error) throw new Response(error.message, { status: 400 });
    return { saved: true };
  });

export type FollowedSeller = {
  businessId: string;
  name: string;
  slug: string;
  city: string | null;
  region: string | null;
  categoryKey: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  followedAt: string;
};

export const listFollowedSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("business_followers")
      .select(
        "business_id,created_at,business:businesses(id,name,slug,city,region,category_key,logo_url,hero_url)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Response(error.message, { status: 500 });

    return (data ?? [])
      .filter((r: any) => r.business)
      .map<FollowedSeller>((r: any) => ({
        businessId: r.business_id,
        name: r.business.name,
        slug: r.business.slug,
        city: r.business.city,
        region: r.business.region,
        categoryKey: r.business.category_key,
        logoUrl: r.business.logo_url,
        heroUrl: r.business.hero_url,
        followedAt: r.created_at,
      }));
  });

export const toggleFollowSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: readErr } = await supabase
      .from("business_followers")
      .select("business_id")
      .eq("user_id", userId)
      .eq("business_id", data.businessId)
      .maybeSingle();
    if (readErr) throw new Response(readErr.message, { status: 500 });

    if (existing) {
      const { error } = await supabase
        .from("business_followers")
        .delete()
        .eq("user_id", userId)
        .eq("business_id", data.businessId);
      if (error) throw new Response(error.message, { status: 400 });
      return { following: false };
    }
    const { error } = await supabase
      .from("business_followers")
      .insert({ user_id: userId, business_id: data.businessId });
    if (error) throw new Response(error.message, { status: 400 });
    return { following: true };
  });

/**
 * Buyer-initiated cancellation. Allowed while the shop hasn't shipped yet:
 * the card payment is refunded through Stripe, any vendor transfer already
 * made is pulled back, and the stock goes back on the shelf.
 */
export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ orderId: z.string().uuid(), reason: z.string().max(300).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("product_orders")
      .select(
        "id,status,buyer_id,total_cents,stripe_payment_intent_id,stripe_transfer_id,shipped_at,items:product_order_items(product_id,quantity)",
      )
      .eq("id", data.orderId)
      .eq("buyer_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("We couldn't find that order on your account.");
    if (order.status === "refunded" || order.status === "cancelled") {
      return { ok: true as const, alreadyCancelled: true };
    }
    if (order.shipped_at || ["shipped", "delivered"].includes(String(order.status))) {
      throw new Error(
        "This order has already shipped — message the shop to arrange a return instead.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getStripe } = await import("@/lib/stripe.server");
    const stripe = getStripe();

    if (stripe && order.stripe_payment_intent_id) {
      if (order.stripe_transfer_id) {
        try {
          await stripe.transfers.createReversal(order.stripe_transfer_id, {});
        } catch {
          /* already reversed */
        }
      }
      try {
        await stripe.refunds.create(
          { payment_intent: order.stripe_payment_intent_id, reason: "requested_by_customer" },
          { idempotencyKey: `buyer-cancel-${order.id}` },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[stripe] buyer refund failed", message);
        throw new Error(`We couldn't send the refund: ${message}`);
      }
    }

    for (const item of (order.items ?? []) as Array<{ product_id: string | null; quantity: number }>) {
      if (!item.product_id) continue;
      const { data: prod } = await supabaseAdmin
        .from("inventory_products")
        .select("stock_qty")
        .eq("id", item.product_id)
        .maybeSingle();
      if (prod) {
        await supabaseAdmin
          .from("inventory_products")
          .update({ stock_qty: (prod.stock_qty ?? 0) + (item.quantity ?? 0) })
          .eq("id", item.product_id);
      }
    }

    const now = new Date().toISOString();
    const nextStatus = order.stripe_payment_intent_id ? "refunded" : "cancelled";
    await supabaseAdmin
      .from("product_orders")
      .update({
        status: nextStatus,
        notes: data.reason ?? "Cancelled by buyer",
        payout_released_at: null,
        payout_due_at: null,
        updated_at: now,
      })
      .eq("id", order.id);

    await supabaseAdmin.from("domain_events").insert({
      topic: "order.cancelled_by_buyer",
      aggregate_type: "product_order",
      aggregate_id: order.id,
      payload: { order_id: order.id, amount_cents: order.total_cents, cancelled_by: userId },
    });

    return { ok: true as const, alreadyCancelled: false, status: nextStatus };
  });
