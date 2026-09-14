import { useMemo, useState } from "react";
import { MediaImg } from "@/components/media/MediaImg";
import { WholesalePanel } from "@/components/tackle/WholesalePanel";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getShopOverview,
  upsertProduct,
  deleteProduct,
  updateOrderStatus,
  getShippingSettings,
  saveShippingSettings,
  refundProductOrder,
} from "@/lib/tackle.functions";
import {
  OperatorShell,
  OperatorNavItem,
  KPICard,
  Card,
  StatusPill,
  money,
} from "@/components/operator/OperatorShell";
import { PaymentsDashboard } from "@/components/operator/PaymentsDashboard";
import { BusinessSettings } from "@/components/business/BusinessSettings";
import { BusinessInbox } from "@/components/messages/BusinessInbox";
import { ImageUpload } from "@/components/business/ImageUpload";
import { useQuery } from "@tanstack/react-query";

export type Product = {
  id: string;
  sku: string | null;
  title: string;
  category: string | null;
  price_cents: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_published: boolean;
  description: string | null;
  images: string[];
  /** Signed, renderable versions of `images`. */
  imageUrls: (string | null)[];
};

type Order = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  total_cents: number;
  status: string;
  created_at: string;
  subtotal_cents?: number | null;
  shipping_cents?: number | null;
  tracking_number?: string | null;
  shipping_address?: Record<string, any> | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  payout_released_at?: string | null;
  notes?: string | null;
  items: { id: string; title: string; quantity: number; unit_price_cents: number }[];
};

const overviewQO = (businessId: string) =>
  queryOptions({
    queryKey: ["shop-overview", businessId],
    queryFn: () => getShopOverview({ data: { businessId } }),
  });

/**
 * Copy adapts per vertical: tackle_shop / gear_mfg / apparel.
 */
const KIND_COPY: Record<
  string,
  { workspaceKind: string; productLabel: string; ordersLabel: string; brand: string }
> = {
  tackle_shop: {
    workspaceKind: "Tackle Shop",
    productLabel: "Tackle",
    ordersLabel: "Orders",
    brand: "Live bait, terminal tackle, lures.",
  },
  bait_shop: {
    workspaceKind: "Bait & Tackle",
    productLabel: "Tackle",
    ordersLabel: "Orders",
    brand: "Live bait, terminal tackle, lures.",
  },
  gear_mfg: {
    workspaceKind: "Gear Manufacturer",
    productLabel: "Gear",
    ordersLabel: "Wholesale orders",
    brand: "Rods, reels, electronics, hard goods.",
  },
  apparel: {
    workspaceKind: "Apparel Brand",
    productLabel: "Apparel",
    ordersLabel: "Orders",
    brand: "Performance apparel & merch.",
  },
};

export function ShopDashboard({
  businessId,
  workspaceName,
  operatorName,
  categoryKey,
}: {
  businessId: string;
  workspaceName: string;
  operatorName: string;
  categoryKey: string;
}) {
  const copy = KIND_COPY[categoryKey] ?? KIND_COPY.tackle_shop;
  const { data } = useSuspenseQuery(overviewQO(businessId));
  const [active, setActive] = useState("overview");

  const nav: OperatorNavItem[] = [
    { key: "overview", label: "Overview", icon: <BoxIcon /> },
    { key: "products", label: copy.productLabel, icon: <TagIcon /> },
    {
      key: "orders",
      label: copy.ordersLabel,
      icon: <CartIcon />,
      badge: data.kpis.toShip || undefined,
    },
    { key: "wholesale", label: "Wholesale", icon: <TagIcon /> },
    { key: "messages", label: "Messages", icon: <CartIcon /> },
    { key: "payments", label: "Payments", icon: <TagIcon /> },
    { key: "settings", label: "Settings", icon: <GearIcon /> },
  ];

  const titles: Record<string, { t: string; s: string }> = {
    overview: { t: "Shop overview", s: "Revenue, orders and inventory health." },
    products: { t: `${copy.productLabel} catalog`, s: "Publish, edit, restock." },
    orders: { t: copy.ordersLabel, s: "Fulfillment queue and history." },
    wholesale: {
      t: "Wholesale & variants",
      s: "Trade pricing, price breaks, buyer approvals and product options.",
    },
    messages: { t: "Messages", s: "Customer questions about your products and orders." },
    payments: { t: "Payments & payouts", s: "Revenue, fees, escrow and bank transfers." },
    settings: { t: "Settings", s: "Storefront profile and payouts." },
  };

  return (
    <OperatorShell
      workspaceName={workspaceName}
      workspaceKind={copy.workspaceKind}
      operatorName={operatorName}
      operatorRole={copy.brand}
      nav={nav}
      active={active}
      onNav={setActive}
      pageTitle={titles[active].t}
      pageSub={titles[active].s}
    >
      {active === "overview" && <Overview data={data} />}
      {active === "products" && <Products businessId={businessId} data={data} />}
      {active === "orders" && <Orders businessId={businessId} data={data} />}
      {active === "wholesale" && (
        <WholesalePanel businessId={businessId} products={data.products} />
      )}
      {active === "payments" && <PaymentsDashboard businessId={businessId} />}
      {active === "messages" && <BusinessInbox theme="dark" businessId={businessId} />}
      {active === "settings" && <Settings businessId={businessId} />}
    </OperatorShell>
  );
}

function Overview({ data }: { data: any }) {
  const k = data.kpis;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
        <KPICard label="Month gross" value={money(k.monthGrossCents)} trend="MTD" />
        <KPICard
          label="To ship"
          value={String(k.toShip)}
          trend={k.toShip ? "action" : "clear"}
          trendPositive={k.toShip === 0}
        />
        <KPICard label="Products live" value={`${k.publishedCount}/${k.totalProducts}`} />
        <KPICard
          label="Low stock"
          value={String(k.lowStockCount)}
          trend={k.lowStockCount ? "restock" : "ok"}
          trendPositive={k.lowStockCount === 0}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18 }}>
        <Card eyebrow="Fulfillment" title="Latest orders">
          <OrderList rows={data.orders.slice(0, 6)} minimal />
        </Card>
        <Card eyebrow="Restock soon" title="Low stock">
          {data.lowStock.length === 0 ? (
            <div style={{ color: "#92A0AB", fontSize: 14 }}>All good — no low-stock items.</div>
          ) : (
            data.lowStock.map((p: Product) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(255,255,255,.05)",
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(216,81,74,.16)",
                    display: "grid",
                    placeItems: "center",
                    color: "#F87171",
                    flex: "none",
                    fontWeight: 700,
                  }}
                >
                  !
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#F0F2F5" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#92A0AB" }}>
                    {p.sku ? `SKU ${p.sku}` : "No SKU"}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#F87171" }}>
                  {p.stock_qty} left
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

function Products({ businessId, data }: { businessId: string; data: any }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertProduct);
  const deleteFn = useServerFn(deleteProduct);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const upsertM = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-overview", businessId] });
      setEditing(null);
      setShowForm(false);
    },
  });
  const deleteM = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shop-overview", businessId] }),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card
        title="Catalog"
        right={
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimary}>
            + Add product
          </button>
        }
      >
        {data.products.length === 0 ? (
          <Empty label="No products yet — add your first item." />
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr .8fr .8fr .8fr .6fr",
                gap: 16,
                padding: "10px 4px 12px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "#92A0AB",
                borderBottom: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <span>Product</span>
              <span>SKU</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Live</span>
            </div>
            {data.products.map((p: Product) => (
              <button
                key={p.id}
                onClick={() => { setEditing(p); setShowForm(true); }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr .8fr .8fr .8fr .6fr",
                  gap: 16,
                  padding: "14px 4px",
                  borderBottom: "1px solid rgba(255,255,255,.05)",
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  borderTop: 0,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 10,
                      flex: "none",
                      background: "#1C2936",
                      overflow: "hidden",
                    }}
                  >
                    {(p.imageUrls?.[0] || p.images?.[0]) && (
                      <MediaImg
                        src={p.imageUrls?.[0] || p.images?.[0]}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#F0F2F5" }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "#92A0AB" }}>{p.category ?? "Uncategorised"}</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: "#F0F2F5" }}>{p.sku ?? "—"}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#F0F2F5" }}>{money(p.price_cents)}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: p.stock_qty <= p.low_stock_threshold ? "#F87171" : "#F0F2F5",
                  }}
                >
                  {p.stock_qty}
                </span>
                <StatusPill label={p.is_published ? "Live" : "Draft"} tone={p.is_published ? "green" : "muted"} />
              </button>
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <ProductForm
          businessId={businessId}
          key={editing?.id ?? "new"}
          initial={editing ?? undefined}
          saving={upsertM.isPending}
          onCancel={() => { setEditing(null); setShowForm(false); }}
          onSave={(v) =>
            upsertM.mutate({ data: { ...v, businessId, id: editing?.id } })
          }
          onDelete={
            editing
              ? () => deleteM.mutate({ data: { id: editing.id, businessId } })
              : undefined
          }
        />
      )}
    </div>
  );
}

export function ProductForm({
  businessId,
  initial,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  businessId: string;
  initial?: Product;
  onCancel: () => void;
  onSave: (v: {
    sku: string;
    title: string;
    description: string;
    category: string;
    priceCents: number;
    stockQty: number;
    lowStockThreshold: number;
    isPublished: boolean;
    images: string[];
  }) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price_cents / 100) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock_qty) : "0");
  const [low, setLow] = useState(initial ? String(initial.low_stock_threshold) : "5");
  const [isPublished, setPublished] = useState(initial?.is_published ?? false);
  // Seed from the saved product, otherwise editing silently wipes the copy.
  const [description, setDescription] = useState(initial?.description ?? "");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);

  return (
    <Card title={initial ? "Edit product" : "Add product"}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category">
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Price $">
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Stock">
          <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Low-stock alert">
          <input type="number" value={low} onChange={(e) => setLow(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <div style={{ marginTop: 14 }}>
        <Field label="Description">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, fontFamily: "inherit" }}
          />
        </Field>
      </div>
      <div style={{ marginTop: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#92A0AB",
            marginBottom: 10,
          }}
        >
          Photos
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
          {images.map((url, i) => (
            <div key={`${url}-${i}`}>
              <ImageUpload
                businessId={businessId}
                value={url}
                label={i === 0 ? "Main photo" : `Photo ${i + 1}`}
                aspect="1 / 1"
                onChange={(next) =>
                  setImages((prev) => prev.map((u, idx) => (idx === i ? next : u)).filter(Boolean))
                }
              />
              <button
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ ...btnGhost, padding: "6px 10px", fontSize: 12, marginTop: 6 }}
              >
                Remove
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <ImageUpload
              businessId={businessId}
              value=""
              label={images.length ? "Add photo" : "Main photo"}
              aspect="1 / 1"
              onChange={(url) => url && setImages((prev) => [...prev, url])}
            />
          )}
        </div>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontSize: 13, color: "#F0F2F5" }}>
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setPublished(e.target.checked)}
        />
        Publish to marketplace
      </label>
      <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
        <button
          disabled={saving || !title || !price}
          onClick={() =>
            onSave({
              title,
              sku,
              category,
              description,
              priceCents: Math.round(Number(price) * 100),
              stockQty: Number(stock) || 0,
              lowStockThreshold: Number(low) || 5,
              isPublished,
              images,
            })
          }
          style={btnPrimary}
        >
          {saving ? "Saving…" : "Save product"}
        </button>
        <button onClick={onCancel} style={btnGhost}>
          Cancel
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{ ...btnGhost, marginLeft: "auto", color: "#F87171", borderColor: "rgba(216,81,74,.28)" }}
          >
            Delete
          </button>
        )}
      </div>
    </Card>
  );
}

function Orders({ businessId, data }: { businessId: string; data: any }) {
  const [tab, setTab] = useState<
    "all" | "paid" | "shipped" | "delivered" | "refunded"
  >("all");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data.orders as Order[]).filter((o) => {
      const byTab =
        tab === "all"
          ? true
          : tab === "refunded"
            ? o.status === "refunded" || o.status === "cancelled"
            : o.status === tab;
      if (!byTab) return false;
      if (!term) return true;
      const hay = [
        o.id,
        o.buyer_name,
        o.buyer_email,
        o.tracking_number,
        o.shipping_address ? formatAddress(o.shipping_address) : "",
        ...(o.items ?? []).map((i) => i.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [tab, q, data.orders]);

  return (
    <Card
      title="Order history"
      right={
        <div style={{ display: "flex", gap: 4, background: "#1C2936", borderRadius: 11, padding: 4, flexWrap: "wrap" }}>
          {(["all", "paid", "shipped", "delivered", "refunded"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                background: tab === k ? "#0D161F" : "transparent",
                color: tab === k ? "#F0F2F5" : "#92A0AB",
                border: 0,
                borderRadius: 9,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
              }}
            >
              {k === "paid" ? "To ship" : k === "refunded" ? "Refunded" : k}
            </button>
          ))}
        </div>
      }
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by buyer, item, address, tracking or order number"
        style={{
          width: "100%",
          background: "#0D161F",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 11,
          padding: "11px 14px",
          color: "#F0F2F5",
          fontSize: 13,
          fontFamily: "inherit",
          marginBottom: 8,
        }}
      />
      <OrderList rows={filtered} businessId={businessId} />
    </Card>
  );
}

function OrderList({
  rows,
  businessId,
  minimal,
}: {
  rows: Order[];
  businessId?: string;
  minimal?: boolean;
}) {
  const qc = useQueryClient();
  const [trackDrafts, setTrackDrafts] = useState<Record<string, string>>({});
  const shipFn = useServerFn(updateOrderStatus);
  const refundFn = useServerFn(refundProductOrder);
  const refundM = useMutation({
    mutationFn: refundFn,
    onSuccess: () =>
      businessId && qc.invalidateQueries({ queryKey: ["shop-overview", businessId] }),
  });
  const shipM = useMutation({
    mutationFn: shipFn,
    onSuccess: () =>
      businessId && qc.invalidateQueries({ queryKey: ["shop-overview", businessId] }),
  });

  if (!rows.length) return <Empty label="No orders here yet." />;
  const toneFor = (s: string) =>
    s === "delivered"
      ? "green"
      : s === "shipped"
        ? "cyan"
        : s === "paid"
          ? "gold"
          : s === "cancelled" || s === "refunded"
            ? "red"
            : "muted";
  return (
    <div>
      {rows.map((o) => (
        <div
          key={o.id}
          style={{
            display: "grid",
            gridTemplateColumns: minimal ? "1.5fr 1fr auto auto" : "1fr 1.5fr 1fr .8fr auto",
            gap: 14,
            padding: "14px 4px",
            borderBottom: "1px solid rgba(255,255,255,.05)",
            alignItems: "center",
          }}
        >
          {!minimal && (
            <span style={{ fontSize: 12.5, color: "#92A0AB", fontFamily: "monospace" }}>
              {o.id.slice(0, 8)}
            </span>
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#F0F2F5" }}>
              {o.buyer_name ?? o.buyer_email ?? "Guest"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#92A0AB",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {o.items?.map((it) => `${it.quantity}× ${it.title}`).join(", ") || "—"}
            </div>
            {!minimal && (
              <div style={{ fontSize: 12, color: "#92A0AB", marginTop: 4, lineHeight: 1.5 }}>
                {o.shipping_address ? (
                  <div>Ship to: {formatAddress(o.shipping_address)}</div>
                ) : (
                  <div>No delivery address on this order yet.</div>
                )}
                <div style={{ marginTop: 2 }}>
                  {[
                    o.paid_at ? `Paid ${dayOf(o.paid_at)}` : null,
                    o.shipped_at ? `Shipped ${dayOf(o.shipped_at)}` : null,
                    o.delivered_at ? `Delivered ${dayOf(o.delivered_at)}` : null,
                    o.payout_released_at ? `Paid out ${dayOf(o.payout_released_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || `Placed ${dayOf(o.created_at)}`}
                </div>
                {o.tracking_number && (
                  <div style={{ marginTop: 2, color: "#2DE2F2" }}>Tracking {o.tracking_number}</div>
                )}
                {["paid", "shipped"].includes(o.status) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <input
                      value={trackDrafts[o.id] ?? o.tracking_number ?? ""}
                      onChange={(e) => setTrackDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                      placeholder="Tracking number"
                      style={{
                        background: "#0D161F",
                        border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 9,
                        padding: "7px 10px",
                        color: "#F0F2F5",
                        fontSize: 12,
                        fontFamily: "inherit",
                        minWidth: 160,
                      }}
                    />
                    <button
                      onClick={() =>
                        businessId &&
                        shipM.mutate({
                          data: {
                            id: o.id,
                            businessId,
                            status: o.status as "paid" | "shipped",
                            trackingNumber: (trackDrafts[o.id] ?? "").trim(),
                          },
                        })
                      }
                      disabled={!((trackDrafts[o.id] ?? "").trim())}
                      style={{ ...btnGhost, padding: "7px 12px", fontSize: 12 }}
                    >
                      Save tracking
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <span style={{ fontFamily: "'Outfit', Georgia, serif", fontSize: 17, fontWeight: 600, color: "#F0F2F5" }}>
            {money(o.total_cents)}
          </span>
          <StatusPill label={o.status} tone={toneFor(o.status) as any} />
          {!minimal && businessId && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {o.status === "paid" && (
                <button
                  onClick={() => shipM.mutate({ data: { id: o.id, businessId, status: "shipped" } })}
                  style={{ ...btnPrimary, padding: "8px 12px", fontSize: 12 }}
                >
                  Mark shipped
                </button>
              )}
              {o.status === "shipped" && (
                <button
                  onClick={() => shipM.mutate({ data: { id: o.id, businessId, status: "delivered" } })}
                  style={{ ...btnPrimary, padding: "8px 12px", fontSize: 12 }}
                >
                  Mark delivered
                </button>
              )}
              {["paid", "shipped", "delivered"].includes(o.status) && (
                <button
                  disabled={refundM.isPending}
                  onClick={() => {
                    if (!window.confirm("Refund this order to the buyer and restock the items?")) return;
                    refundM.mutate({ data: { orderId: o.id, businessId } });
                  }}
                  style={{
                    ...btnGhost,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#F87171",
                    borderColor: "rgba(216,81,74,.28)",
                  }}
                >
                  {refundM.isPending ? "Refunding…" : "Refund"}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const dayOf = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

function formatAddress(a: Record<string, any>): string {
  return [a.name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country]
    .filter(Boolean)
    .join(", ");
}

function ShippingSettingsCard({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const loadFn = useServerFn(getShippingSettings);
  const saveFn = useServerFn(saveShippingSettings);
  const q = useQuery({
    queryKey: ["shipping-settings", businessId],
    queryFn: () => loadFn({ data: { businessId } }),
  });
  const [draft, setDraft] = useState<{
    flat: string;
    perItem: string;
    freeOver: string;
    note: string;
  } | null>(null);

  const s = q.data;
  const view =
    draft ??
    (s
      ? {
          flat: String(s.flatRateCents / 100),
          perItem: String(s.perItemCents / 100),
          freeOver: s.freeOverCents == null ? "" : String(s.freeOverCents / 100),
          note: s.policyNote ?? "",
        }
      : null);

  const saveM = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["shipping-settings", businessId] });
    },
  });

  return (
    <Card eyebrow="Fulfillment" title="Shipping & returns">
      {!view ? (
        <div style={{ fontSize: 13, color: "#92A0AB" }}>Loading shipping settings…</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#92A0AB", marginBottom: 14, lineHeight: 1.6 }}>
            Buyers are charged these rates at checkout — Fish-X calculates shipping on the server
            from what you set here.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Field label="Flat rate $">
              <input
                type="number"
                value={view.flat}
                onChange={(e) => setDraft({ ...view, flat: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Each extra item $">
              <input
                type="number"
                value={view.perItem}
                onChange={(e) => setDraft({ ...view, perItem: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Free over $ (blank = never)">
              <input
                type="number"
                value={view.freeOver}
                onChange={(e) => setDraft({ ...view, freeOver: e.target.value })}
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Shipping & returns note (shown to buyers)">
              <textarea
                rows={3}
                value={view.note}
                onChange={(e) => setDraft({ ...view, note: e.target.value })}
                style={{ ...inputStyle, fontFamily: "inherit" }}
              />
            </Field>
          </div>
          <button
            disabled={saveM.isPending || !draft}
            onClick={() =>
              saveM.mutate({
                data: {
                  businessId,
                  flatRateCents: Math.round(Number(view.flat || 0) * 100),
                  perItemCents: Math.round(Number(view.perItem || 0) * 100),
                  freeOverCents:
                    view.freeOver === "" ? null : Math.round(Number(view.freeOver) * 100),
                  policyNote: view.note,
                },
              })
            }
            style={{ ...btnPrimary, marginTop: 16 }}
          >
            {saveM.isPending ? "Saving…" : "Save shipping settings"}
          </button>
        </>
      )}
    </Card>
  );
}

function Settings({ businessId }: { businessId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ShippingSettingsCard businessId={businessId} />
      <BusinessSettings businessId={businessId} />
    </div>
  );
}

/* --- shared UI helpers --- */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "#92A0AB",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 10,
  padding: "10px 12px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 14,
  background: "#14202B",
  color: "#F0F2F5",
  outline: "none",
};

export const btnPrimary: React.CSSProperties = {
  background: "#0D161F",
  color: "#F0F2F5",
  border: 0,
  borderRadius: 11,
  padding: "10px 16px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

export const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#F0F2F5",
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 11,
  padding: "10px 16px",
  fontFamily: "'Outfit', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: "32px 10px", textAlign: "center", color: "#92A0AB", fontSize: 14 }}>
      {label}
    </div>
  );
}



/* icons */
function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M20 12 12 20l-9-9V3h8l9 9z" />
      <circle cx="7" cy="7" r="1.4" />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M3 3h2l2.4 12.2A2 2 0 0 0 9.4 17H18a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9" cy="21" r="1.4" />
      <circle cx="18" cy="21" r="1.4" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
