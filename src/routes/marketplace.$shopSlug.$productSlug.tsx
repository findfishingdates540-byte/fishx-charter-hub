import { createFileRoute, notFound } from "@tanstack/react-router";
import { getStoreProduct, resolveProductSlug, type ProductVariant } from "@/lib/product-checkout.functions";
import { ProductPageView, rowToProduct } from "@/components/marketplace/ProductPageView";
import { productHead } from "@/components/marketplace/product-head";

/** Readable product URL: /marketplace/<shop-slug>/<product-name>. */
export const Route = createFileRoute("/marketplace/$shopSlug/$productSlug")({
  loader: async ({ params }) => {
    const id = await resolveProductSlug({ data: { shopSlug: params.shopSlug, productSlug: params.productSlug } });
    if (!id) throw notFound();
    const row = await getStoreProduct({ data: { productId: id } });
    if (!row) throw notFound();
    return {
      id,
      product: rowToProduct(row),
      businessId: row.businessId as string | null,
      variants: (row.variants ?? []) as ProductVariant[],
    };
  },
  head: ({ loaderData }) => productHead(loaderData?.product ?? null),
  component: ProductBySlugPage,
});

function ProductBySlugPage() {
  const data = Route.useLoaderData();
  return <ProductPageView data={data} productId={data.id} />;
}
