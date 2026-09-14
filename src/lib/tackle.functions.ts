/**
 * Tackle / gear / apparel dashboard server functions:
 * inventory CRUD, orders, KPIs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signMediaUrls } from "@/lib/media-urls.server";

function imageList(images: unknown): string[] {
  if (Array.isArray(images)) return images.filter((v): v is string => typeof v === "string");
  return [];
}

async function assertMember(
  ctx: { supabase: any; userId: string },
  businessId: string,
) {
  const { data, error } = await ctx.supabase.rpc("is_business_member", {
    _business_id: businessId,
    _user_id: ctx.userId,
    _min_role: "staff",
  });
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getShopOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { supabase } = context;

    const [{ data: products }, { data: orders }] = await Promise.all([
      supabase
        .from("inventory_products")
        .select(
          "id, sku, title, description, category, price_cents, compare_at_cents, stock_qty, low_stock_threshold, is_published, images, metadata",
        )
        .eq("business_id", data.businessId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("product_orders")
        .select(
          "id, buyer_name, buyer_email, subtotal_cents, shipping_cents, total_cents, status, tracking_number, shipping_address, created_at, paid_at, shipped_at, delivered_at, payout_released_at, notes, items:product_order_items(id, title, quantity, unit_price_cents)",
        )
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    // Product photos live in a private bucket; sign them so the dashboard can
    // render thumbnails.
    const productRows = (products ?? []) as any[];
    const flat = productRows.flatMap((p) => imageList(p.images));
    const signed = await signMediaUrls(flat, context.supabase as never);
    let cursor = 0;
    const withImages = productRows.map((p) => {
      const imgs = imageList(p.images);
      const resolved = imgs.map((orig) => signed[cursor++] ?? orig);
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      const tags = Array.isArray(meta["tags"])
        ? (meta["tags"] as unknown[]).filter((t): t is string => typeof t === "string")
        : [];
      return { ...p, images: imgs, imageUrls: resolved, tags };
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthGross =
      orders
        ?.filter(
          (o: any) =>
            o.status !== "cancelled" &&
            new Date(o.created_at) >= monthStart,
        )
        .reduce((acc: number, o: any) => acc + (o.total_cents ?? 0), 0) ?? 0;

    const toShip = orders?.filter((o: any) => o.status === "paid").length ?? 0;
    const shipped = orders?.filter((o: any) => o.status === "shipped").length ?? 0;
    const lowStock =
      withImages.filter((p: any) => p.stock_qty <= (p.low_stock_threshold ?? 5));
    const published = withImages.filter((p: any) => p.is_published).length;

    return {
      products: withImages,
      orders: orders ?? [],
      kpis: {
        monthGrossCents: monthGross,
        toShip,
        shipped,
        lowStockCount: lowStock.length,
        publishedCount: published,
        totalProducts: withImages.length,
      },
      lowStock,
    };
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        businessId: z.string().uuid(),
        sku: z.string().max(60).optional(),
        title: z.string().min(1).max(160),
        description: z.string().max(2000).optional(),
        category: z.string().max(60).optional(),
        priceCents: z.number().int().min(0),
        stockQty: z.number().int().min(0),
        lowStockThreshold: z.number().int().min(0).optional(),
        isPublished: z.boolean(),
        images: z.array(z.string().max(500)).max(8).optional(),
        tags: z.array(z.string().min(1).max(40)).max(20).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);

    // Tags live in the product `metadata` blob; merge so nothing else is lost.
    let metadata: any;
    if (data.tags) {
      let existing: Record<string, unknown> = {};
      if (data.id) {
        const { data: prev } = await context.supabase
          .from("inventory_products")
          .select("metadata")
          .eq("id", data.id)
          .maybeSingle();
        existing = ((prev?.metadata ?? {}) as Record<string, unknown>) || {};
      }
      const clean = Array.from(
        new Set(data.tags.map((t) => t.trim()).filter(Boolean)),
      );
      metadata = { ...existing, tags: clean };
    }

    const payload = {
      business_id: data.businessId,
      sku: data.sku ?? null,
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? null,
      price_cents: data.priceCents,
      stock_qty: data.stockQty,
      low_stock_threshold: data.lowStockThreshold ?? 5,
      is_published: data.isPublished,
      ...(data.images ? { images: data.images } : {}),
      ...(metadata ? { metadata } : {}),
    };
    const q = data.id
      ? context.supabase
          .from("inventory_products")
          .update(payload)
          .eq("id", data.id)
          .select()
          .single()
      : context.supabase
          .from("inventory_products")
          .insert(payload)
          .select()
          .single();
    const { data: row, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { error } = await context.supabase
      .from("inventory_products")
      .delete()
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        businessId: z.string().uuid(),
        status: z.enum([
          "pending",
          "paid",
          "shipped",
          "delivered",
          "cancelled",
          "refunded",
        ]),
        trackingNumber: z.string().max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);

    // Marking delivered starts the 72h buyer-protection clock; the scheduled
    // job releases the vendor payout (order total minus the 8% commission)
    // once that window closes.
    if (data.status === "delivered") {
      const { error: rpcErr } = await context.supabase.rpc("mark_product_order_delivered", {
        _order_id: data.id,
      });
      if (rpcErr) throw new Response(rpcErr.message, { status: 400 });
    }

    const patch: any = { status: data.status };
    if (data.trackingNumber) patch.tracking_number = data.trackingNumber;
    if (data.status === "shipped") patch.shipped_at = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("product_orders")
      .update(patch)
      .eq("id", data.id)
      .eq("business_id", data.businessId)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return row;
  });



/* ------------------------- Shipping settings ------------------------- */

export const getShippingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { data: row } = await context.supabase
      .from("vendor_shipping_settings")
      .select("flat_rate_cents, per_item_cents, free_over_cents, policy_note")
      .eq("business_id", data.businessId)
      .maybeSingle();
    return {
      flatRateCents: row?.flat_rate_cents ?? 800,
      perItemCents: row?.per_item_cents ?? 0,
      freeOverCents: row?.free_over_cents ?? 15000,
      policyNote: row?.policy_note ?? "",
    };
  });

export const saveShippingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        businessId: z.string().uuid(),
        flatRateCents: z.number().int().min(0).max(100000),
        perItemCents: z.number().int().min(0).max(100000),
        freeOverCents: z.number().int().min(0).max(1000000).nullable(),
        policyNote: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { error } = await context.supabase.from("vendor_shipping_settings").upsert(
      {
        business_id: data.businessId,
        flat_rate_cents: data.flatRateCents,
        per_item_cents: data.perItemCents,
        free_over_cents: data.freeOverCents,
        policy_note: data.policyNote ?? null,
      },
      { onConflict: "business_id" },
    );
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/* ---------------------------- Refunds ---------------------------- */

/**
 * Refund a paid product order. Reverses the vendor transfer when the payout
 * already left, restocks the inventory, and marks the order refunded.
 */
export const refundProductOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        orderId: z.string().uuid(),
        businessId: z.string().uuid(),
        reason: z.string().max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);

    const { data: order, error } = await context.supabase
      .from("product_orders")
      .select(
        "id, status, total_cents, stripe_payment_intent_id, stripe_transfer_id, items:product_order_items(product_id, quantity)",
      )
      .eq("id", data.orderId)
      .eq("business_id", data.businessId)
      .single();
    if (error || !order) throw new Response("Order not found", { status: 404 });
    if (order.status === "refunded")
      throw new Response("This order was already refunded", { status: 400 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getStripe } = await import("@/lib/stripe.server");
    const stripe = getStripe();

    if (stripe && order.stripe_payment_intent_id) {
      // Pull the vendor transfer back first so the refund comes out of the
      // right balance, then refund the buyer.
      if (order.stripe_transfer_id) {
        try {
          await stripe.transfers.createReversal(order.stripe_transfer_id, {});
        } catch {
          /* already reversed */
        }
      }
      await stripe.refunds.create(
        { payment_intent: order.stripe_payment_intent_id, reason: "requested_by_customer" },
        { idempotencyKey: `product-refund-${order.id}` },
      );
    }

    // Restock what was sold.
    for (const item of (order.items ?? []) as any[]) {
      if (!item.product_id) continue;
      const { data: prod } = await supabaseAdmin
        .from("inventory_products")
        .select("stock_qty")
        .eq("id", item.product_id)
        .maybeSingle();
      if (prod)
        await supabaseAdmin
          .from("inventory_products")
          .update({ stock_qty: (prod.stock_qty ?? 0) + (item.quantity ?? 0) })
          .eq("id", item.product_id);
    }

    const { error: upErr } = await supabaseAdmin
      .from("product_orders")
      .update({
        status: "refunded",
        notes: data.reason ?? null,
        payout_released_at: null,
      })
      .eq("id", order.id);
    if (upErr) throw new Response(upErr.message, { status: 400 });

    return { ok: true };
  });

/**
 * Trips booked on this business's storefront (charters, guided trips, slips).
 * Shops that also sell experiences need these on their dashboard once an
 * angler's booking is confirmed.
 */
export const getShopBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("bookings")
      .select(
        "id, trip_date, start_time, party_size, status, escrow_state, total_cents, deposit_cents, payout_cents, notes, angler_id, created_at, service:bookable_services(title, duration_minutes, departure_location)",
      )
      .eq("business_id", data.businessId)
      .order("trip_date", { ascending: false })
      .limit(200);
    if (error) throw new Response(error.message, { status: 400 });

    const anglerIds = Array.from(
      new Set((rows ?? []).map((b: any) => b.angler_id).filter(Boolean)),
    );
    const profileMap = new Map<string, any>();
    if (anglerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", anglerIds);
      (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
    }

    return (rows ?? []).map((b: any) => {
      const p = profileMap.get(b.angler_id);
      return {
        id: b.id as string,
        reference: String(b.id).slice(0, 8).toUpperCase(),
        tripDate: b.trip_date as string | null,
        startTime: b.start_time ? String(b.start_time).slice(0, 5) : null,
        partySize: (b.party_size as number) ?? 1,
        status: b.status as string,
        escrowState: (b.escrow_state as string | null) ?? null,
        totalCents: (b.total_cents as number) ?? 0,
        depositCents: (b.deposit_cents as number) ?? 0,
        payoutCents: (b.payout_cents as number) ?? 0,
        notes: (b.notes as string | null) ?? null,
        anglerName: p?.display_name || p?.full_name || "Angler",
        title: b.service?.title ?? "Trip",
        departure: b.service?.departure_location ?? null,
        createdAt: b.created_at as string,
      };
    });
  });
