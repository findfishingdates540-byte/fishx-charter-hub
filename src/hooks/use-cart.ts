import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStoreProducts, type StoreProduct } from "@/lib/product-checkout.functions";

/** Cart storage shared by the marketplace, product pages, /cart and /checkout. */
const CART_KEY = "fx-cart";
const LABEL_KEY = "fx-cart-labels";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Labels = Record<string, { label: string; deltaCents: number }>;

export type CartLine = {
  key: string;
  productId: string;
  variantId?: string;
  variantLabel: string | null;
  qty: number;
  product: StoreProduct;
  unitCents: number;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useCart() {
  const [cart, setCartState] = useState<Record<string, number>>({});
  const [labels, setLabels] = useState<Labels>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCartState(read(CART_KEY, {}));
    setLabels(read(LABEL_KEY, {}));
    setReady(true);
  }, []);

  const setCart = useCallback((next: Record<string, number>) => {
    setCartState(next);
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const fetchProducts = useServerFn(listStoreProducts);
  const { data: products, isLoading } = useQuery({
    queryKey: ["store-products"],
    queryFn: () => fetchProducts(),
  });

  const lines = useMemo<CartLine[]>(() => {
    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    return Object.entries(cart).flatMap(([key, qty]) => {
      const [productId, variantId] = key.split(":");
      if (!UUID_RE.test(productId) || qty <= 0) return [];
      const product = byId.get(productId);
      if (!product) return [];
      const l = labels[key];
      return [
        {
          key,
          productId,
          variantId: variantId && UUID_RE.test(variantId) ? variantId : undefined,
          variantLabel: l?.label ?? null,
          qty,
          product,
          unitCents: product.priceCents + (l?.deltaCents ?? 0),
        },
      ];
    });
  }, [cart, labels, products]);

  const setQty = (key: string, qty: number) => {
    const next = { ...cart };
    if (qty <= 0) delete next[key];
    else next[key] = Math.min(qty, 50);
    setCart(next);
  };
  const clear = () => {
    setCart({});
    try {
      window.localStorage.removeItem(LABEL_KEY);
    } catch {
      /* ignore */
    }
  };

  const subtotalCents = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const items = lines.map((l) => ({
    productId: l.productId,
    quantity: l.qty,
    ...(l.variantId ? { variantId: l.variantId } : {}),
  }));

  return { ready: ready && !isLoading, lines, items, count, subtotalCents, setQty, clear };
}

/** Groups lines by shop — each shop ships its own parcel. */
export function groupByShop(lines: CartLine[]) {
  const map = new Map<string, { businessId: string; name: string; lines: CartLine[]; subtotalCents: number }>();
  for (const l of lines) {
    const g = map.get(l.product.businessId) ?? {
      businessId: l.product.businessId,
      name: l.product.sellerName,
      lines: [],
      subtotalCents: 0,
    };
    g.lines.push(l);
    g.subtotalCents += l.unitCents * l.qty;
    map.set(l.product.businessId, g);
  }
  return [...map.values()];
}

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
