import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(context: { supabase: any; userId: string }, businessId: string, role: "staff" | "manager" = "staff") {
  const { data, error } = await context.supabase.rpc("is_business_member", {
    _business_id: businessId,
    _user_id: context.userId,
    _min_role: role,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You don't have access to this store.");
}

const businessInput = z.object({ businessId: z.string().uuid() });

export const getMerchantInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { data: orders, error } = await context.supabase
      .from("product_orders")
      .select("id,buyer_id,buyer_name,buyer_email,status,subtotal_cents,shipping_cents,discount_cents,total_cents,payout_cents,application_fee_cents,created_at,paid_at,shipped_at,delivered_at,items:product_order_items(product_id,title,quantity,unit_price_cents)")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const paid = (orders ?? []).filter((o: any) => o.paid_at && !["cancelled", "refunded"].includes(o.status));
    const refunded = (orders ?? []).filter((o: any) => o.status === "refunded");
    const customerMap = new Map<string, any>();
    const productMap = new Map<string, any>();
    const monthMap = new Map<string, { salesCents: number; orders: number }>();

    for (const order of orders ?? []) {
      const key = order.buyer_id ? `id:${order.buyer_id}` : `email:${String(order.buyer_email ?? "guest").trim().toLowerCase()}`;
      const current = customerMap.get(key) ?? {
        key,
        buyerId: order.buyer_id ?? null,
        name: order.buyer_name ?? "Guest customer",
        email: order.buyer_email ?? null,
        orders: 0,
        totalSpentCents: 0,
        lastOrderAt: order.created_at,
        lastStatus: order.status,
        orderHistory: [],
      };
      current.orders += 1;
      if (order.paid_at && !["cancelled", "refunded"].includes(order.status)) current.totalSpentCents += order.total_cents ?? 0;
      if (order.created_at > current.lastOrderAt) {
        current.lastOrderAt = order.created_at;
        current.lastStatus = order.status;
      }
      current.orderHistory.push({ id: order.id, createdAt: order.created_at, status: order.status, totalCents: order.total_cents ?? 0 });
      customerMap.set(key, current);

      if (order.paid_at && !["cancelled", "refunded"].includes(order.status)) {
        const ym = String(order.paid_at).slice(0, 7);
        const month = monthMap.get(ym) ?? { salesCents: 0, orders: 0 };
        month.salesCents += order.total_cents ?? 0;
        month.orders += 1;
        monthMap.set(ym, month);
        for (const item of order.items ?? []) {
          const productKey = item.product_id ?? item.title;
          const product = productMap.get(productKey) ?? { id: productKey, title: item.title, units: 0, salesCents: 0 };
          product.units += item.quantity ?? 0;
          product.salesCents += (item.unit_price_cents ?? 0) * (item.quantity ?? 0);
          productMap.set(productKey, product);
        }
      }
    }

    const returningCustomers = [...customerMap.values()].filter((c) => c.orders > 1).length;
    return {
      customers: [...customerMap.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt)),
      summary: {
        salesCents: paid.reduce((sum: number, o: any) => sum + (o.total_cents ?? 0), 0),
        orderCount: paid.length,
        averageOrderCents: paid.length ? Math.round(paid.reduce((sum: number, o: any) => sum + (o.total_cents ?? 0), 0) / paid.length) : 0,
        unitsSold: paid.flatMap((o: any) => o.items ?? []).reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0),
        shippingCents: paid.reduce((sum: number, o: any) => sum + (o.shipping_cents ?? 0), 0),
        discountsCents: paid.reduce((sum: number, o: any) => sum + (o.discount_cents ?? 0), 0),
        refundsCents: refunded.reduce((sum: number, o: any) => sum + (o.total_cents ?? 0), 0),
        netPayoutCents: paid.reduce((sum: number, o: any) => sum + (o.payout_cents ?? 0), 0),
        returningCustomers,
      },
      monthly: [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, values]) => ({ month, ...values })),
      topProducts: [...productMap.values()].sort((a, b) => b.salesCents - a.salesCents).slice(0, 8),
    };
  });

const discountInput = z.object({
  businessId: z.string().uuid(),
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40).transform((v) => v.toUpperCase()),
  discountType: z.enum(["percentage", "fixed"]),
  value: z.number().int().positive(),
  minimumOrderCents: z.number().int().min(0).default(0),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const listProductDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId);
    const { data: rows, error } = await context.supabase.from("product_discounts").select("*").eq("business_id", data.businessId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveProductDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => discountInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId, "manager");
    const payload = {
      business_id: data.businessId,
      code: data.code,
      discount_type: data.discountType,
      value: data.value,
      minimum_order_cents: data.minimumOrderCents,
      starts_at: data.startsAt ?? null,
      expires_at: data.expiresAt ?? null,
      max_redemptions: data.maxRedemptions ?? null,
      is_active: data.isActive,
    };
    const query = data.id
      ? context.supabase.from("product_discounts").update(payload).eq("id", data.id).eq("business_id", data.businessId)
      : context.supabase.from("product_discounts").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteProductDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid(), id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId, "manager");
    const { error } = await context.supabase.from("product_discounts").delete().eq("id", data.id).eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const bulkSetProductsPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid(), productIds: z.array(z.string().uuid()).min(1).max(100), isPublished: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.businessId, "manager");
    const { error } = await context.supabase.from("inventory_products").update({ is_published: data.isPublished }).eq("business_id", data.businessId).in("id", data.productIds);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
