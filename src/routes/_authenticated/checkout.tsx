import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { createProductCheckout, quoteProductDiscount, quoteShipping } from "@/lib/product-checkout.functions";
import { groupByShop, useCart, usd } from "@/hooks/use-cart";
import { C, card, input, LineRow, PageShell, primaryBtn, SummaryRow } from "@/components/shopping/checkout-ui";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (s: Record<string, unknown>): { canceled?: string } => (s.canceled ? { canceled: "1" } : {}),
  head: () => ({
    meta: [
      { title: "Checkout — FISH-X.COM Marketplace" },
      { name: "description", content: "Enter your delivery details, review shipping and pay securely for your Fish-X order." },
      { property: "og:title", content: "Checkout — FISH-X.COM Marketplace" },
      { property: "og:description", content: "Secure, escrow-protected checkout for Fish-X marketplace orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const COUNTRIES: Array<[string, string]> = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["IE", "Ireland"], ["MX", "Mexico"], ["ZA", "South Africa"], ["NG", "Nigeria"],
];

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(30).optional(),
  line1: z.string().trim().min(1, "Enter your street address").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "Enter your city").max(100),
  state: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().min(1, "Enter your ZIP / postal code").max(20),
  country: z.string().length(2),
});
type Form = z.infer<typeof formSchema>;
const EMPTY: Form = { name: "", email: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "US" };
const DRAFT_KEY = "fx-checkout-draft";

function CheckoutPage() {
  const search = Route.useSearch();
  const cart = useCart();
  const groups = groupByShop(cart.lines);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [note, setNote] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<{ code: string; discountCents: number } | null>(null);
  const [err, setErr] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Prefill: unfinished draft (after a cancelled payment) → saved address → profile.
  useEffect(() => {
    const draft = (() => {
      try { return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
    })();
    const storedCode = window.sessionStorage.getItem("fx-checkout-code");
    if (storedCode) setCode(storedCode);
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const saved = (u?.user_metadata?.shipping_address ?? null) as Partial<Form> | null;
      const meta = u?.user_metadata ?? {};
      setForm({
        ...EMPTY,
        name: meta.full_name ?? meta.name ?? "",
        email: u?.email ?? "",
        ...(saved ?? {}),
        ...(draft?.form ?? {}),
      });
      if (draft?.note) setNote(draft.note);
    });
  }, []);

  const quote = useServerFn(quoteShipping);
  const plainItems = cart.items.map(({ productId, quantity }) => ({ productId, quantity }));
  const ship = useQuery({
    queryKey: ["shipping-quote", cart.items],
    queryFn: () => quote({ data: { items: plainItems } }),
    enabled: cart.items.length > 0,
  });
  const shippingCents = ship.data?.shippingCents ?? 0;

  const quoteDiscount = useServerFn(quoteProductDiscount);
  const discountMut = useMutation({
    mutationFn: () => quoteDiscount({ data: { code: code.trim(), items: plainItems } }),
    onSuccess: (r) => { setDiscount(r); setErr(""); },
    onError: (e) => { setDiscount(null); setErr(e instanceof Error ? e.message : "Discount code unavailable"); },
  });
  // Auto-apply a code carried over from the cart.
  useEffect(() => {
    if (code && !discount && cart.items.length && !discountMut.isPending && window.sessionStorage.getItem("fx-checkout-code")) {
      window.sessionStorage.removeItem("fx-checkout-code");
      discountMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, cart.items.length]);

  const discountCents = discount?.discountCents ?? 0;
  const totalCents = Math.max(0, cart.subtotalCents + shippingCents - discountCents);

  const startCheckout = useServerFn(createProductCheckout);
  const pay = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.safeParse(form);
      if (!parsed.success) {
        const e: Partial<Record<keyof Form, string>> = {};
        for (const i of parsed.error.issues) e[i.path[0] as keyof Form] ??= i.message;
        setErrors(e);
        throw new Error("Please fill in the highlighted fields.");
      }
      setErrors({});
      const f = parsed.data;
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: f, note }));
      if (saveAddress) {
        const { name, email: _e, ...addr } = f;
        void supabase.auth.updateUser({ data: { shipping_address: { name, ...addr } } });
      }
      const res = await startCheckout({
        data: {
          items: cart.items,
          origin: window.location.origin,
          ...(discount?.code ? { discountCode: discount.code } : {}),
          contact: { name: f.name, email: f.email, ...(f.phone ? { phone: f.phone } : {}) },
          shippingAddress: {
            line1: f.line1,
            ...(f.line2 ? { line2: f.line2 } : {}),
            city: f.city,
            ...(f.state ? { state: f.state } : {}),
            postal_code: f.postal_code,
            country: f.country,
          },
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      if (!res.checkoutUrl) throw new Error("Could not start payment — please try again.");
      window.sessionStorage.setItem("fx-checkout-summary", JSON.stringify({ totalCents: res.totalCents, address: f }));
      window.location.href = res.checkoutUrl;
    },
    onError: async (e) => {
      const msg = e instanceof Response ? await e.text() : e instanceof Error ? e.message : String(e);
      setErr(msg.replace(/^Error:\s*/i, "").slice(0, 200) || "Checkout failed — please try again.");
    },
  });

  const field = (k: keyof Form, label: string, opts: { type?: string; auto?: string; optional?: boolean } = {}) => (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 13, color: C.mut }}>{label}{opts.optional ? " (optional)" : ""}</span>
      <input
        type={opts.type ?? "text"}
        autoComplete={opts.auto}
        value={form[k] ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
        style={{ ...input, marginTop: 4, borderColor: errors[k] ? C.red : undefined }}
      />
      {errors[k] && <span style={{ fontSize: 12, color: C.red }}>{errors[k]}</span>}
    </label>
  );

  if (cart.ready && cart.lines.length === 0) {
    return (
      <PageShell title="Checkout" step={2}>
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <p>Your cart is empty.</p>
          <Link to="/marketplace" style={{ ...primaryBtn(), maxWidth: 260, margin: "16px auto 0" }}>Browse the marketplace</Link>
        </div>
      </PageShell>
    );
  }

  const summary = (
    <>
      {groups.map((g) => (
        <div key={g.businessId} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.mut }}>{g.name}</div>
          {g.lines.map((l) => <LineRow key={l.key} line={{ ...l }}><span style={{ fontSize: 13, color: C.mut }}>Qty {l.qty}</span></LineRow>)}
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
        <SummaryRow label="Subtotal" value={usd(cart.subtotalCents)} />
        <SummaryRow label="Shipping" value={ship.isLoading ? "…" : shippingCents ? usd(shippingCents) : "Free"} />
        {discountCents > 0 && <SummaryRow label={`Discount (${discount?.code})`} value={`−${usd(discountCents)}`} color={C.green} />}
        <SummaryRow label="Total" value={usd(totalCents)} strong />
      </div>
    </>
  );

  return (
    <PageShell title="Checkout" step={2}>
      {search.canceled && (
        <div style={{ ...card, marginBottom: 14, borderColor: C.accent }}>Payment was cancelled — your details are still here when you're ready.</div>
      )}
      <div className="fx-checkout-grid">
        <div style={{ display: "grid", gap: 14 }}>
          <button className="fx-checkout-mobile-summary" onClick={() => setSummaryOpen((o) => !o)} style={{ ...card, textAlign: "left", cursor: "pointer", fontFamily: C.sans, fontSize: 15 }}>
            {summaryOpen ? "Hide" : "Show"} order summary · <strong>{usd(totalCents)}</strong>
          </button>
          {summaryOpen && <div className="fx-checkout-mobile-summary" style={card}>{summary}</div>}

          <section style={card}>
            <h2 style={h2}>Contact</h2>
            <div className="fx-checkout-fields">
              {field("name", "Full name", { auto: "name" })}
              {field("email", "Email", { type: "email", auto: "email" })}
              {field("phone", "Phone", { type: "tel", auto: "tel", optional: true })}
            </div>
          </section>

          <section style={card}>
            <h2 style={h2}>Shipping address</h2>
            <div className="fx-checkout-fields">
              <div style={{ gridColumn: "1 / -1" }}>{field("line1", "Street address", { auto: "address-line1" })}</div>
              <div style={{ gridColumn: "1 / -1" }}>{field("line2", "Apt, suite, unit", { auto: "address-line2", optional: true })}</div>
              {field("city", "City", { auto: "address-level2" })}
              {field("state", "State / region", { auto: "address-level1", optional: true })}
              {field("postal_code", "ZIP / postal code", { auto: "postal-code" })}
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 13, color: C.mut }}>Country</span>
                <select value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} style={{ ...input, marginTop: 4 }}>
                  {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 14 }}>
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
              Save this address for next time
            </label>
          </section>

          <section style={card}>
            <h2 style={h2}>Shipping</h2>
            {groups.map((g) => {
              const v = ship.data?.byVendor.find((x) => x.businessId === g.businessId);
              return (
                <div key={g.businessId} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{g.name} · {g.lines.reduce((a, l) => a + l.qty, 0)} item(s)</span>
                    <strong>{ship.isLoading ? "…" : v?.shippingCents ? usd(v.shippingCents) : "Free"}</strong>
                  </div>
                  {v?.policyNote && <div style={{ fontSize: 13, color: C.mut, marginTop: 2 }}>{v.policyNote}</div>}
                </div>
              );
            })}
          </section>

          <section style={card}>
            <h2 style={h2}>Note to the seller <span style={{ fontWeight: 400, fontSize: 13, color: C.mut }}>(optional)</span></h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Delivery instructions, sizing questions, gift message…"
              style={{ ...input, resize: "vertical" }}
            />
            <div style={{ fontSize: 12, color: C.mut, textAlign: "right" }}>{note.length}/500</div>
          </section>

          <section style={card}>
            <h2 style={h2}>Discount code</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={code} onChange={(e) => { setCode(e.target.value.slice(0, 40)); setDiscount(null); }} placeholder="Enter code" style={input} />
              <button
                onClick={() => discountMut.mutate()}
                disabled={code.trim().length < 2 || discountMut.isPending}
                style={{ ...primaryBtn(code.trim().length < 2), width: "auto", padding: "0 18px", fontSize: 14 }}
              >
                {discountMut.isPending ? "…" : "Apply"}
              </button>
            </div>
            {discount && <div style={{ color: C.green, fontSize: 14, marginTop: 6 }}>{discount.code} applied — you save {usd(discount.discountCents)}</div>}
          </section>
        </div>

        <aside style={{ ...card, position: "sticky", top: 16, alignSelf: "start" }}>
          <h2 style={h2}>Order summary</h2>
          <div className="fx-checkout-desktop-summary">{summary}</div>
          {err && <div role="alert" style={{ color: C.red, fontSize: 14, margin: "10px 0" }}>{err}</div>}
          <button onClick={() => pay.mutate()} disabled={pay.isPending || !cart.ready} style={{ ...primaryBtn(pay.isPending), marginTop: 12 }}>
            {pay.isPending ? "Starting secure payment…" : `Pay ${usd(totalCents)}`}
          </button>
          <p style={{ fontSize: 12, color: C.mut, marginTop: 10 }}>
            You'll enter your card on Stripe's secure page. Funds are held until delivery is confirmed.
          </p>
          <Link to="/cart" style={{ color: C.accent, fontSize: 14 }}>← Back to cart</Link>
        </aside>
      </div>
    </PageShell>
  );
}

const h2 = { fontSize: 18, margin: "0 0 12px", fontWeight: 600 } as const;
