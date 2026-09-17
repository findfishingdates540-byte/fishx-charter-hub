import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, KPICard, StatusPill, money } from "@/components/operator/OperatorShell";
import { deleteProductDiscount, getMerchantInsights, listProductDiscounts, saveProductDiscount } from "@/lib/merchant-commerce.functions";

const input: React.CSSProperties = { width: "100%", border: "1px solid rgba(255,255,255,.09)", borderRadius: 8, padding: "10px 12px", background: "#0D161F", color: "#F0F2F5", font: "inherit" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 15px", background: "#2DE2F2", color: "#04121B", fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { ...primary, background: "transparent", color: "#F0F2F5", border: "1px solid rgba(255,255,255,.12)" };

function Empty({ children }: { children: React.ReactNode }) { return <div style={{ padding: 30, textAlign: "center", color: "#92A0AB", fontSize: 14 }}>{children}</div>; }
function dateLabel(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

export function MerchantCustomers({ businessId }: { businessId: string }) {
  const load = useServerFn(getMerchantInsights);
  const { data, isLoading } = useQuery({ queryKey: ["merchant-insights", businessId], queryFn: () => load({ data: { businessId } }) });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const customers = useMemo(() => (data?.customers ?? []).filter((c: any) => `${c.name} ${c.email ?? ""}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  const customer = data?.customers.find((c: any) => c.key === selected);
  return <div style={{ display: "grid", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
      <KPICard label="Customers" value={String(data?.customers.length ?? 0)} />
      <KPICard label="Returning" value={String(data?.summary.returningCustomers ?? 0)} />
      <KPICard label="Orders" value={String(data?.summary.orderCount ?? 0)} />
      <KPICard label="Average order" value={money(data?.summary.averageOrderCents ?? 0)} />
    </div>
    <Card title={customer ? customer.name : "Customers"} right={customer ? <button style={ghost} onClick={() => setSelected(null)}>Back to customers</button> : null}>
      {customer ? <div style={{ display: "grid", gap: 14 }}>
        <div style={{ color: "#92A0AB", fontSize: 13 }}>{customer.email ?? "No email"} · {customer.orders} order{customer.orders === 1 ? "" : "s"} · {money(customer.totalSpentCents)}</div>
        {customer.orderHistory.map((o: any) => <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,.07)" }}><span>#{o.id.slice(0, 8).toUpperCase()} · {dateLabel(o.createdAt)}</span><StatusPill label={o.status} tone={o.status === "delivered" ? "green" : "gold"} /><strong>{money(o.totalCents)}</strong></div>)}
      </div> : <>
        <input aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers by name or email" style={{ ...input, marginBottom: 12 }} />
        {isLoading ? <Empty>Loading customers…</Empty> : customers.length === 0 ? <Empty>No customers yet. Buyers appear here after their first order.</Empty> : customers.map((c: any) => <button key={c.key} onClick={() => setSelected(c.key)} style={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(160px,1fr) auto auto auto", gap: 16, alignItems: "center", padding: "14px 4px", border: 0, borderBottom: "1px solid rgba(255,255,255,.07)", background: "transparent", color: "#F0F2F5", textAlign: "left", cursor: "pointer" }}><span><strong style={{ display: "block" }}>{c.name}</strong><small style={{ color: "#92A0AB" }}>{c.email ?? "No email"}</small></span><span>{c.orders} orders</span><span>{money(c.totalSpentCents)}</span><span style={{ color: "#92A0AB" }}>{dateLabel(c.lastOrderAt)}</span></button>)}
      </>}
    </Card>
  </div>;
}

export function MerchantAnalytics({ businessId }: { businessId: string }) {
  const load = useServerFn(getMerchantInsights);
  const { data, isLoading } = useQuery({ queryKey: ["merchant-insights", businessId], queryFn: () => load({ data: { businessId } }) });
  if (isLoading || !data) return <Card title="Store analytics"><Empty>Loading store performance…</Empty></Card>;
  const s = data.summary;
  const peak = Math.max(1, ...data.monthly.map((m: any) => m.salesCents));
  return <div style={{ display: "grid", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
      <KPICard label="Net sales" value={money(s.salesCents)} />
      <KPICard label="Average order" value={money(s.averageOrderCents)} />
      <KPICard label="Units sold" value={String(s.unitsSold)} />
      <KPICard label="Net payout" value={money(s.netPayoutCents)} />
      <KPICard label="Discounts" value={money(s.discountsCents)} />
      <KPICard label="Refunds" value={money(s.refundsCents)} />
    </div>
    <div className="fx-stack" style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18 }}>
      <Card eyebrow="Last 12 active months" title="Sales trend">
        {data.monthly.length === 0 ? <Empty>No completed sales yet.</Empty> : <div style={{ height: 190, display: "flex", alignItems: "end", gap: 10, paddingTop: 24 }}>{data.monthly.map((m: any) => <div key={m.month} style={{ flex: 1, display: "grid", gap: 7, justifyItems: "center" }}><small style={{ color: "#92A0AB" }}>{money(m.salesCents)}</small><div style={{ width: "100%", minHeight: 4, height: `${Math.max(4, m.salesCents / peak * 125)}px`, background: "#2DE2F2", borderRadius: "5px 5px 0 0" }} /><small style={{ color: "#92A0AB" }}>{m.month.slice(5)}</small></div>)}</div>}
      </Card>
      <Card eyebrow="Products" title="Best sellers">{data.topProducts.length === 0 ? <Empty>No product sales yet.</Empty> : data.topProducts.map((p: any, index: number) => <div key={p.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 10, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.07)" }}><span style={{ color: "#2DE2F2" }}>{index + 1}</span><span>{p.title}<small style={{ display: "block", color: "#92A0AB" }}>{p.units} sold</small></span><strong>{money(p.salesCents)}</strong></div>)}</Card>
    </div>
  </div>;
}

export function MerchantDiscounts({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listProductDiscounts);
  const save = useServerFn(saveProductDiscount);
  const remove = useServerFn(deleteProductDiscount);
  const { data = [] } = useQuery({ queryKey: ["product-discounts", businessId], queryFn: () => list({ data: { businessId } }) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discountType: "percentage" as "percentage" | "fixed", amount: "10", minimum: "0", expires: "", limit: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["product-discounts", businessId] });
  const saveM = useMutation({ mutationFn: () => save({ data: { businessId, code: form.code, discountType: form.discountType, value: form.discountType === "percentage" ? Math.round(Number(form.amount)) : Math.round(Number(form.amount) * 100), minimumOrderCents: Math.round(Number(form.minimum || 0) * 100), expiresAt: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null, maxRedemptions: form.limit ? Number(form.limit) : null, isActive: true } }), onSuccess: () => { setOpen(false); setForm({ code: "", discountType: "percentage", amount: "10", minimum: "0", expires: "", limit: "" }); refresh(); } });
  const deleteM = useMutation({ mutationFn: (id: string) => remove({ data: { businessId, id } }), onSuccess: refresh });
  return <div style={{ display: "grid", gap: 18 }}><Card title="Discount codes" right={<button style={primary} onClick={() => setOpen((v) => !v)}>{open ? "Close" : "+ Create discount"}</button>}>
    {open && <div style={{ display: "grid", gap: 12, padding: 16, marginBottom: 18, background: "#1C2936", borderRadius: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <label>Code<input style={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="SUMMER20" /></label>
        <label>Type<select style={input} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option></select></label>
        <label>{form.discountType === "percentage" ? "Percentage" : "Amount ($)"}<input style={input} type="number" min="1" max={form.discountType === "percentage" ? 100 : undefined} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label>Minimum order ($)<input style={input} type="number" min="0" value={form.minimum} onChange={(e) => setForm({ ...form, minimum: e.target.value })} /></label>
        <label>Expires<input style={input} type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></label>
        <label>Usage limit<input style={input} type="number" min="1" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} placeholder="Unlimited" /></label>
      </div><button disabled={!form.code || saveM.isPending} style={primary} onClick={() => saveM.mutate()}>{saveM.isPending ? "Creating…" : "Create discount"}</button>{saveM.error && <span style={{ color: "#F87171" }}>{(saveM.error as Error).message}</span>}
    </div>}
    {data.length === 0 ? <Empty>No discount codes yet.</Empty> : data.map((d: any) => { const expired = d.expires_at && new Date(d.expires_at) < new Date(); return <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 14, alignItems: "center", padding: "14px 4px", borderBottom: "1px solid rgba(255,255,255,.07)" }}><span><strong>{d.code}</strong><small style={{ display: "block", color: "#92A0AB" }}>{d.discount_type === "percentage" ? `${d.value}% off` : `${money(d.value)} off`}{d.minimum_order_cents ? ` · minimum ${money(d.minimum_order_cents)}` : ""}</small></span><span style={{ color: "#92A0AB" }}>{d.redemption_count}{d.max_redemptions ? ` / ${d.max_redemptions}` : ""} used</span><StatusPill label={expired ? "expired" : d.is_active ? "active" : "inactive"} tone={expired || !d.is_active ? "muted" : "green"} /><button style={{ ...ghost, color: "#F87171" }} onClick={() => deleteM.mutate(d.id)}>Delete</button></div>; })}
  </Card></div>;
}

export function MerchantOnlineStore({ businessId, slug }: { businessId: string; slug?: string }) {
  return <div style={{ display: "grid", gap: 18 }}>
    <Card eyebrow="Sales channel" title="Online store" right={slug ? <Link to="/b/$slug" params={{ slug }} target="_blank" style={{ ...primary, textDecoration: "none" }}>Preview store ↗</Link> : null}>
      <p style={{ color: "#A9B6C1", marginTop: 0 }}>Control how your shop appears across Fish-X, publish it, and keep buyer-facing details accurate.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {["Store identity & photos", "Contact & opening hours", "Shipping & returns", "Privacy & legal policies"].map((label) => <div key={label} style={{ padding: 15, background: "#1C2936", borderRadius: 8, color: "#F0F2F5" }}>✓ {label}</div>)}
      </div>
    </Card>
    <Card eyebrow="Configure" title="Store settings"><p style={{ color: "#92A0AB" }}>Open Settings to edit your storefront, policies, shipping, privacy, team, notifications, and payouts.</p><Link to="/dashboard" search={{ tab: "settings" }} style={{ ...primary, display: "inline-block", textDecoration: "none" }}>Open store settings</Link></Card>
  </div>;
}
