/**
 * Angler shopping account sections rendered inside Settings:
 * order history, saved items (wishlist) and followed sellers.
 */
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelMyOrder,
  listMyOrders,
  listMyWishlist,
  listFollowedSellers,
  toggleWishlist,
  toggleFollowSeller,
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

export function MyOrdersSection() {
  const fetchOrders = useServerFn(listMyOrders);
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelMyOrder);
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

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {orders.map((o) => (
        <Card key={o.id}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: V.tmut }}>
                {dateOf(o.createdAt)} · Order #{o.id.slice(0, 8)}
              </div>
              <div style={{ fontFamily: V.serif, fontSize: 20, color: V.ink, marginTop: 2 }}>{o.sellerName}</div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: STATUS_TONE[o.status] ?? V.tmut,
                background: "rgba(255,255,255,.05)",
                padding: "6px 11px",
                borderRadius: 20,
              }}
            >
              {o.status.replace(/_/g, " ")}
            </span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            {o.items.map((i) => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: V.ink }}>
                <span style={{ color: V.tmut }}>
                  {i.quantity} × {i.title}
                </span>
                <span>{money(i.unitPriceCents * i.quantity)}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${V.line}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13.5,
            }}
          >
            <span style={{ color: V.tmut }}>
              {o.trackingNumber ? `Tracking ${o.trackingNumber}` : "Escrow released after delivery"}
            </span>
            <b style={{ color: V.cyan, fontFamily: V.serif, fontSize: 19 }}>{money(o.totalCents)}</b>
          </div>

          {["pending_payment", "paid"].includes(o.status) && (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                disabled={cancelM.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Cancel this order? The money goes back to the card you paid with.",
                    )
                  )
                    return;
                  cancelM.mutate(o.id);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(216,81,74,.35)",
                  color: "#c0392b",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {cancelM.isPending && cancelM.variables === o.id
                  ? "Refunding…"
                  : "Cancel & refund"}
              </button>
            </div>
          )}
        </Card>
      ))}
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
