import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ShopRecommendation = { productId: string; reason: string };

/** AI shopping assistant: recommends in-stock, published products from one store. */
export const recommendShopProducts = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ businessId: z.string().uuid(), query: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; summary: string; items: ShopRecommendation[] } | { ok: false; message: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, message: "The shopping assistant isn't configured yet." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("inventory_products")
      .select("id,title,description,category,price_cents,stock_qty")
      .eq("business_id", data.businessId)
      .eq("is_published", true)
      .gt("stock_qty", 0)
      .limit(80);
    const products = rows ?? [];
    if (products.length === 0) return { ok: true, summary: "This shop has no products available right now.", items: [] };

    const catalog = products
      .map((p) => `${p.id} | ${p.title} | ${p.category ?? "-"} | $${(p.price_cents / 100).toFixed(2)} | ${(p.description ?? "").slice(0, 200).replace(/\s+/g, " ")}`)
      .join("\n");
    const instructions =
      "You are a helpful fishing-shop assistant. Recommend up to 4 products ONLY from the catalog that match the shopper's need. " +
      'Reply with JSON only: {"summary": string (one short sentence), "items": [{"productId": string, "reason": string (max 20 words)}]}. ' +
      "Use exact ids from the catalog. If nothing fits, return an empty items array and say so in summary.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        instructions,
        input: `Catalog (id | title | category | price | description):\n${catalog}\n\nShopper need: ${data.query}`,
      }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 429) return { ok: false, message: "The assistant is busy — please try again in a moment." };
      if (res.status === 402) return { ok: false, message: "The shopping assistant is temporarily unavailable." };
      return { ok: false, message: "The assistant couldn't answer right now. Please try again later." };
    }

    let text = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
        } catch {
          /* ignore partial */
        }
      }
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, message: "The assistant couldn't find a match. Try describing it differently." };
    try {
      const parsed = JSON.parse(match[0]) as { summary?: string; items?: ShopRecommendation[] };
      const valid = new Set(products.map((p) => p.id));
      const items = (parsed.items ?? []).filter((i) => i && valid.has(i.productId)).slice(0, 4);
      return { ok: true, summary: parsed.summary ?? "", items };
    } catch {
      return { ok: false, message: "The assistant couldn't find a match. Try describing it differently." };
    }
  });
