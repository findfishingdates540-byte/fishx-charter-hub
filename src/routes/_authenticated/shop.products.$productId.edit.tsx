import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBootstrap } from "@/lib/auth.functions";
import { upsertProduct, deleteProduct } from "@/lib/tackle.functions";
import { CaptainPageShell } from "@/components/captain/CaptainPageShell";
import { overviewQO, ProductForm, type Product } from "@/components/tackle/ShopDashboard";

export const Route = createFileRoute("/_authenticated/shop/products/$productId/edit")({
  head: () => ({
    meta: [
      { title: "Edit product — Fish-X" },
      { name: "description", content: "Update your product details, photos, price and stock." },
      { property: "og:title", content: "Edit product — Fish-X" },
      { property: "og:description", content: "Update your product details, photos, price and stock." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bootstrap = useServerFn(getMyBootstrap);
  const { data: boot, isLoading: bootLoading } = useQuery({
    queryKey: ["my-bootstrap"],
    queryFn: () => bootstrap(),
  });
  const businessId: string | null = (boot as any)?.businesses?.[0]?.business?.id ?? null;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    ...overviewQO(businessId ?? "none"),
    enabled: !!businessId,
  });
  const product: Product | undefined = overview?.products?.find((p: Product) => p.id === productId);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLoading = bootLoading || (!!businessId && overviewLoading);

  if (isLoading || !businessId || !product) {
    return (
      <CaptainPageShell title="Edit product" backLabel="← Back to catalog" backSearch={{ tab: "products" }}>
        <div style={{ color: "var(--tmut)", fontSize: 13 }}>
          {isLoading ? "Loading product…" : "We couldn't find that product."}
        </div>
      </CaptainPageShell>
    );
  }

  const backToCatalog = () => navigate({ to: "/dashboard", search: { tab: "products" } });

  return (
    <CaptainPageShell
      title="Edit product"
      subtitle={product.title}
      backLabel="← Back to catalog"
      backSearch={{ tab: "products" }}
    >
      {error && (
        <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      <ProductForm
        key={product.id}
        businessId={businessId}
        initial={product}
        saving={saving}
        onCancel={backToCatalog}
        onSave={async (v) => {
          setSaving(true);
          setError(null);
          try {
            await upsertProduct({ data: { ...v, businessId, id: product.id } });
            await qc.invalidateQueries({ queryKey: ["shop-overview", businessId] });
            backToCatalog();
          } catch (err: any) {
            setError(err?.message || "We couldn't save that product. Check the details and try again.");
          } finally {
            setSaving(false);
          }
        }}
        onDelete={async () => {
          setSaving(true);
          setError(null);
          try {
            await deleteProduct({ data: { id: product.id, businessId } });
            await qc.invalidateQueries({ queryKey: ["shop-overview", businessId] });
            backToCatalog();
          } catch (err: any) {
            setError(err?.message || "We couldn't delete that product. Please try again.");
            setSaving(false);
          }
        }}
      />
    </CaptainPageShell>
  );
}
