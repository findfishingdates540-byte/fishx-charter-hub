import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBootstrap } from "@/lib/auth.functions";
import { upsertProduct } from "@/lib/tackle.functions";
import { CaptainPageShell } from "@/components/captain/CaptainPageShell";
import { ProductForm } from "@/components/tackle/ShopDashboard";

export const Route = createFileRoute("/_authenticated/shop/products/new")({
  head: () => ({
    meta: [
      { title: "Add product — Fish-X" },
      { name: "description", content: "Add a new product to your shop catalog." },
      { property: "og:title", content: "Add product — Fish-X" },
      { property: "og:description", content: "Add a new product to your shop catalog." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bootstrap = useServerFn(getMyBootstrap);
  const { data: boot, isLoading } = useQuery({
    queryKey: ["my-bootstrap"],
    queryFn: () => bootstrap(),
  });
  const businessId: string | null = (boot as any)?.businesses?.[0]?.business?.id ?? null;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading || !businessId) {
    return (
      <CaptainPageShell title="Add product" backLabel="← Back to catalog" backSearch={{ tab: "products" }}>
        <div style={{ color: "var(--tmut)", fontSize: 13 }}>
          {isLoading ? "Loading your shop…" : "We couldn't find a shop for this account."}
        </div>
      </CaptainPageShell>
    );
  }

  const backToCatalog = () => navigate({ to: "/dashboard", search: { tab: "products" } });

  return (
    <CaptainPageShell
      title="Add product"
      subtitle="New catalog item"
      backLabel="← Back to catalog"
      backSearch={{ tab: "products" }}
    >
      {error && (
        <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      <ProductForm
        businessId={businessId}
        saving={saving}
        onCancel={backToCatalog}
        onSave={async (v) => {
          setSaving(true);
          setError(null);
          try {
            const row = await upsertProduct({ data: { ...v, businessId } });
            await qc.invalidateQueries({ queryKey: ["shop-overview", businessId] });
            // Land on the new product's editor so the owner can preview it.
            navigate({ to: "/shop/products/$productId/edit", params: { productId: row.id } });
          } catch (err: any) {
            setError(err?.message || "We couldn't save that product. Check the details and try again.");
          } finally {
            setSaving(false);
          }
        }}
      />
    </CaptainPageShell>
  );
}
