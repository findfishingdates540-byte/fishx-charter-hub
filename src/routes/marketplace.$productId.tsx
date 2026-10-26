import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { CATALOG, type Product } from "@/components/marketplace/catalog";
import { getStoreProduct, type ProductVariant, type StoreProduct } from "@/lib/product-checkout.functions";
import { ProductPageView, rowToProduct } from "@/components/marketplace/ProductPageView";
import { productHead } from "@/components/marketplace/product-head";

/**
 * Legacy id-based product URL. Published products redirect to the
 * readable /marketplace/<shop>/<product> address; owner previews stay here.
 */
export const Route = createFileRoute("/marketplace/$productId")({
  validateSearch: (s: Record<string, unknown>): { preview?: boolean } =>
    s.preview === true || s.preview === "1" ? { preview: true } : {},
  loaderDeps: ({ search }) => ({ preview: search.preview }),
  loader: async ({ params, deps }) => {
    const demo = CATALOG.find((p) => p.id === params.productId);
    if (demo)
      return { product: demo as Product | null, businessId: null as string | null, variants: [] as ProductVariant[] };
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.productId);
    if (isUuid) {
      let row: StoreProduct | null = null;
      try {
        row = await getStoreProduct({ data: { productId: params.productId } });
      } catch {
        row = null;
      }
      if (row) {
        if (!deps.preview && row.shopSlug && row.productSlug) {
          throw redirect({
            to: "/marketplace/$shopSlug/$productSlug",
            params: { shopSlug: row.shopSlug, productSlug: row.productSlug },
            statusCode: 301,
          });
        }
        return { product: rowToProduct(row) as Product | null, businessId: row.businessId as string, variants: (row.variants ?? []) as ProductVariant[] };
      }
    }
    if (deps.preview) return { product: null, businessId: null, variants: [] };
    throw notFound();
  },
  head: ({ loaderData }) => productHead(loaderData?.product ?? null),
  component: LegacyProductPage,
});

function LegacyProductPage() {
  const data = Route.useLoaderData();
  const { preview } = Route.useSearch();
  const { productId } = Route.useParams();
  return <ProductPageView data={data} preview={preview} productId={productId} />;
}
