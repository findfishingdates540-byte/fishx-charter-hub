/**
 * Angler shopping account sections rendered inside Settings:
 * order history, saved items (wishlist) and followed sellers.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MediaImg } from "@/components/media/MediaImg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelMyOrder,
  listMyOrders,
  listMyWishlist,
  listFollowedSellers,
  toggleWishlist,
  toggleFollowSeller,
  type MyOrder,
} from "@/lib/shopping.functions";

const V = {
  serif: "'Outfit',Georgia,serif",
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  card: "#ffffff",
  cyan: "#1f9fbe",
  cyansoft: "#e2eef2",
  tmut: "#5c6b78",
  line: "rgba(13,34,54,.10)",
};

const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const dateOf = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const STATUS_TONE: Record<string, string> = {
  pending_payment: "#F0B429",
  paid: "#2DE2F2",
  shipped: "#8AB4F8",
  delivered: "#4ADE80",
  cancelled: "#F87171",
  refunded: "#F87171",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, padding: 18 }}>
      {children}
    </div>
  );
}

function Empty({ title, sub, to, cta }: { title: string; sub: string; to: string; cta: string }) {
  return (
    <Card>
      <div style={{ textAlign: "center", padding: "28px 12px" }}>
        <div style={{ fontFamily: V.serif, fontSize: 21, color: V.ink, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: V.tmut, marginBottom: 16 }}>{sub}</div>
        <Link
          to={to}
          style={{
            display: "inline-block",
            background: V.cyan,
            color: "#031029",
            fontWeight: 700,
            fontSize: 13,
            padding: "10px 18px",
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          {cta}
        </Link>
      </div>
    </Card>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid · preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
const DONE = ["cancelled", "refunded"];

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? V.tmut;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "#031029",
        background: tone,
        padding: "4px 9px",
        borderRadius: 6,
      }}
    >
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function Thumb({ src, alt, size = 84 }: { src: string | null; alt: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 12,
        overflow: "hidden",
        background: V.cyansoft,
        display: "grid",
        placeItems: "center",
        color: V.tmut,
        fontSize: 11,
      }}
    >
      {src ? (
        <MediaImg src={src} alt={alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        "No photo"
      )}
    </div>
  );
}

function statusDate(o: MyOrder) {
  if (o.status === "delivered" && o.deliveredAt) return `On ${dateOf(o.deliveredAt)}`;
  if (o.status === "shipped" && o.shippedAt) return `Shipped ${dateOf(o.shippedAt)}`;
  if (o.paidAt) return `Paid ${dateOf(o.paidAt)}`;
  return `Placed ${dateOf(o.createdAt)}`;
}

function addressLines(a: Record<string, string | null> | null): string[] {
  if (!a) return [];
  const g = (k: string) => (typeof a[k] === "string" && a[k] ? (a[k] as string) : null);
  return [
    g("name"),
    g("line1"),
    g("line2"),
    [g("city"), g("state"), g("postal_code")].filter(Boolean).join(", ") || null,
    g("country"),
    g("phone"),
  ].filter((x): x is string => !!x);
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: bold ? V.ink : V.tmut, fontWeight: bold ? 700 : 400 }}>
      <span>{k}</span>
      <span style={{ color: V.ink }}>{v}</span>
    </div>
  );
}

function OrderDetail({
  o,
  onBack,
  onCancel,
  cancelling,
}: {
  o: MyOrder;
  onBack: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const steps = [
    { label: "Order placed", at: o.createdAt },
    { label: "Payment confirmed", at: o.paidAt },
    { label: "Shipped", at: o.shippedAt },
    { label: "Delivered", at: o.deliveredAt },
  ];
  const addr = addressLines(o.shippingAddress);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button
        onClick={onBack}
        style={{ justifySelf: "start", background: "transparent", border: 0, color: V.cyan, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
      >
        ← All orders
      </button>
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: V.serif, fontSize: 22, color: V.ink }}>Order #{o.id.slice(0, 8).toUpperCase()}</div>
            <div style={{ fontSize: 13, color: V.tmut, marginTop: 2 }}>
              {o.sellerName} · placed {dateOf(o.createdAt)}
            </div>
          </div>
          <StatusPill status={o.status} />
        </div>

        {!DONE.includes(o.status) && (
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            {steps.map((s) => (
              <div key={s.label} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: s.at ? "#4ADE80" : V.line, flexShrink: 0 }} />
                <span style={{ color: s.at ? V.ink : V.tmut, fontWeight: s.at ? 600 : 400 }}>{s.label}</span>
                {s.at && <span style={{ color: V.tmut, marginLeft: "auto" }}>{dateOf(s.at)}</span>}
              </div>
            ))}
            {o.trackingNumber && (
              <div style={{ fontSize: 13.5, color: V.ink, marginTop: 4 }}>
                Tracking number: <b>{o.trackingNumber}</b>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: V.ink, marginBottom: 10 }}>Items</div>
        <div style={{ display: "grid", gap: 12 }}>
          {o.items.map((i) => {
            const body = (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Thumb src={i.image} alt={i.title} size={64} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: V.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
                  <div style={{ fontSize: 13, color: V.tmut }}>
                    {i.quantity} × {money(i.unitPriceCents)}
                  </div>
                </div>
                <b style={{ color: V.ink }}>{money(i.unitPriceCents * i.quantity)}</b>
              </div>
            );
            return i.productId ? (
              <Link key={i.id} to="/marketplace/$productId" params={{ productId: i.productId }} style={{ textDecoration: "none" }}>
                {body}
              </Link>
            ) : (
              <div key={i.id}>{body}</div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${V.line}`, display: "grid", gap: 6 }}>
          <Row k="Subtotal" v={money(o.subtotalCents)} />
          <Row k="Shipping" v={o.shippingCents ? money(o.shippingCents) : "Free"} />
          {o.discountCents > 0 && <Row k="Discount" v={`−${money(o.discountCents)}`} />}
          <Row k="Total" v={money(o.totalCents)} bold />
        </div>
      </Card>

      {addr.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, color: V.ink, marginBottom: 8 }}>Shipping to</div>
          {addr.map((l) => (
            <div key={l} style={{ fontSize: 13.5, color: V.tmut }}>{l}</div>
          ))}
        </Card>
      )}

      <Card>
        <div style={{ fontSize: 13.5, color: V.tmut }}>
          Your payment is held safely and only released to {o.sellerName} after delivery.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Link to="/messages" style={{ background: V.cyan, color: "#031029", fontWeight: 700, fontSize: 13, padding: "9px 14px", borderRadius: 10, textDecoration: "none" }}>
            Message the shop
          </Link>
          {["pending_payment", "paid"].includes(o.status) && (
            <button
              disabled={cancelling}
              onClick={() => {
                if (!window.confirm("Cancel this order? The money goes back to the card you paid with.")) return;
                onCancel();
              }}
              style={{ background: "transparent", border: "1px solid rgba(216,81,74,.35)", color: "#c0392b", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              {cancelling ? "Refunding…" : "Cancel & refund"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

export function MyOrdersSection() {
  const fetchOrders = useServerFn(listMyOrders);
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelMyOrder);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "closed">("active");
  const cancelM = useMutation({
    mutationFn: (orderId: string) => cancelFn({ data: { orderId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-orders"] }),
    onError: (e: unknown) =>
      window.alert(e instanceof Error ? e.message : "We couldn't cancel that order."),
  });
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetchOrders(),
  });

  if (isLoading) return <Card><span style={{ color: V.tmut, fontSize: 13.5 }}>Loading your orders…</span></Card>;
  if (orders.length === 0)
    return (
      <Empty
        title="No orders yet"
        sub="Gear, tackle and apparel you buy in the marketplace will show up here with live delivery status."
        to="/marketplace"
        cta="Browse the marketplace"
      />
    );

  const open = openId ? orders.find((o) => o.id === openId) : null;
  if (open)
    return (
      <OrderDetail
        o={open}
        onBack={() => setOpenId(null)}
        onCancel={() => cancelM.mutate(open.id)}
        cancelling={cancelM.isPending && cancelM.variables === open.id}
      />
    );

  const active = orders.filter((o) => !DONE.includes(o.status));
  const closed = orders.filter((o) => DONE.includes(o.status));
  const shown = view === "active" ? active : closed;
  const tab = (key: "active" | "closed", label: string) => (
    <button
      onClick={() => setView(key)}
      style={{
        background: "transparent",
        border: 0,
        borderBottom: `2px solid ${view === key ? V.cyan : "transparent"}`,
        color: view === key ? V.ink : V.tmut,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        padding: "10px 4px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 22, borderBottom: `1px solid ${V.line}` }}>
        {tab("active", `Ongoing / delivered (${active.length})`)}
        {tab("closed", `Cancelled / refunded (${closed.length})`)}
      </div>
      {shown.length === 0 && (
        <Card><span style={{ color: V.tmut, fontSize: 13.5 }}>Nothing here.</span></Card>
      )}
      {shown.map((o) => {
        const first = o.items[0];
        const more = o.items.length - 1;
        return (
          <button
            key={o.id}
            onClick={() => setOpenId(o.id)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              background: V.card,
              border: `1px solid ${V.line}`,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Thumb src={first?.image ?? null} alt={first?.title ?? "Order"} />
            <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ color: V.ink, fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {first?.title ?? "Order"}
                  {more > 0 ? ` + ${more} more` : ""}
                </div>
                <span style={{ color: V.cyan, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>See details</span>
              </div>
              <div style={{ fontSize: 12.5, color: V.tmut }}>
                Order #{o.id.slice(0, 8).toUpperCase()} · {o.sellerName} · {money(o.totalCents)}
              </div>
              <div style={{ marginTop: 6 }}><StatusPill status={o.status} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: V.ink }}>{statusDate(o)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function WishlistSection() {
  const qc = useQueryClient();
  const fetchWishlist = useServerFn(listMyWishlist);
  const toggle = useServerFn(toggleWishlist);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-wishlist"],
    queryFn: () => fetchWishlist(),
  });
  const remove = useMutation({
    mutationFn: (productId: string) => toggle({ data: { productId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-wishlist"] });
      qc.invalidateQueries({ queryKey: ["my-wishlist-ids"] });
    },
  });

  if (isLoading) return <Card><span style={{ color: V.tmut, fontSize: 13.5 }}>Loading saved items…</span></Card>;
  if (items.length === 0)
    return (
      <Empty
        title="Nothing saved yet"
        sub="Tap the heart on any marketplace product to keep it here for later."
        to="/marketplace"
        cta="Find gear to save"
      />
    );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
      {items.map((w) => (
        <div
          key={w.productId}
          style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          <Link
            to="/marketplace/$productId"
            params={{ productId: w.productId }}
            style={{ display: "block", height: 140, background: "rgba(255,255,255,.04)" }}
          >
            {w.image && (
              <MediaImg src={w.image} alt={w.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </Link>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <span style={{ fontSize: 12, color: V.tmut }}>{w.sellerName}</span>
            <span style={{ fontFamily: V.serif, fontSize: 17.5, color: V.ink, lineHeight: 1.2 }}>{w.title}</span>
            <span style={{ fontSize: 12.5, color: w.stockQty > 0 ? V.tmut : "#F87171" }}>
              {w.stockQty > 0 ? `${w.stockQty} in stock` : "Out of stock"}
            </span>
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8 }}>
              <b style={{ fontFamily: V.serif, fontSize: 19, color: V.cyan }}>{money(w.priceCents)}</b>
              <button
                onClick={() => remove.mutate(w.productId)}
                disabled={remove.isPending}
                style={{
                  background: "transparent",
                  border: `1px solid ${V.line}`,
                  color: V.tmut,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontFamily: V.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FollowedSellersSection() {
  const qc = useQueryClient();
  const fetchSellers = useServerFn(listFollowedSellers);
  const toggle = useServerFn(toggleFollowSeller);
  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["followed-sellers"],
    queryFn: () => fetchSellers(),
  });
  const unfollow = useMutation({
    mutationFn: (businessId: string) => toggle({ data: { businessId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followed-sellers"] }),
  });

  if (isLoading) return <Card><span style={{ color: V.tmut, fontSize: 13.5 }}>Loading sellers…</span></Card>;
  if (sellers.length === 0)
    return (
      <Empty
        title="You're not following any sellers"
        sub="Follow tackle shops, marinas and brands to keep their new listings close."
        to="/marketplace"
        cta="Discover sellers"
      />
    );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {sellers.map((s) => (
        <Card key={s.businessId}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: V.cyansoft,
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                flex: "none",
                color: V.cyan,
                fontWeight: 700,
              }}
            >
              {s.logoUrl ? (
                <MediaImg src={s.logoUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                s.name.slice(0, 1)
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: V.serif, fontSize: 19, color: V.ink }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: V.tmut }}>
                {[s.city, s.region].filter(Boolean).join(", ") || s.categoryKey?.replace(/_/g, " ")}
              </div>
            </div>
            <Link
              to="/b/$slug"
              params={{ slug: s.slug }}
              style={{ fontSize: 12.5, fontWeight: 700, color: V.cyan, textDecoration: "none" }}
            >
              Visit store
            </Link>
            <button
              onClick={() => unfollow.mutate(s.businessId)}
              disabled={unfollow.isPending}
              style={{
                background: "transparent",
                border: `1px solid ${V.line}`,
                color: V.tmut,
                borderRadius: 10,
                padding: "8px 12px",
                fontFamily: V.sans,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Unfollow
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
