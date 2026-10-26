import type { Product } from "@/components/marketplace/catalog";

export function productHead(product: Product | null) {
  if (!product)
    return { meta: [{ title: "Product — FISH-X.COM Bookings & Marketplace" }, { name: "robots", content: "noindex" }] };
  const title = `${product.name} — Fish-X Marketplace`;
  const description = product.description ?? `${product.name} from ${product.seller}. Escrow-protected on Fish-X.`;
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "product" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
  if (product.image && /^https?:\/\//.test(product.image)) {
    meta.push({ property: "og:image", content: product.image });
    meta.push({ name: "twitter:image", content: product.image });
  }
  return { meta };
}
