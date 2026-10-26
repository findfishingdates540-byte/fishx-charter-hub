# Full cart → checkout → pay flow for the marketplace

Today the cart is a side drawer and "Checkout" jumps straight to Stripe, where the address is collected. This plan replaces that with two real pages.

## What shoppers will see

```text
Product / Marketplace  ->  /cart  ->  /checkout  ->  Stripe payment  ->  Order confirmed
```

**1. Cart page (`/cart`)**
- Items grouped by shop: photo, name, variant, quantity (+/-), remove, line price.
- Per-shop subtotal and shipping estimate (each shop ships separately).
- Discount code box, order total, "Continue to checkout" button, "Keep shopping" link.
- Empty state with a link back to the marketplace.
- Signed-out shoppers can view the cart; "Continue to checkout" sends them to sign in and back.

**2. Checkout page (`/checkout`, signed-in only)**
- Contact: full name, email (prefilled from profile), phone.
- Shipping address: street, apt/suite, city, state/region, ZIP, country. Option to save it to the profile for next time (prefilled on return).
- Shipping: recalculated live per shop once the address is filled, with each shop's shipping policy note.
- Order note to the seller (optional, per order).
- Discount code (carried over from cart, editable).
- Order summary sidebar (sticky on desktop, collapsible on phone): items, subtotal, shipping, discount, total.
- "Pay $X" button → Stripe card page (address no longer asked again) → return to a confirmation page.

**3. Confirmation (`/checkout/success`)**
- Order number(s), what was bought, ship-to address, "View my orders" button. Clears the cart.
- Cancelled payment returns to `/checkout` with the form still filled.

The cart drawer on the marketplace becomes a small cart icon/count linking to `/cart`; "Buy now" on a product adds it and opens `/checkout` directly.

## Technical details

- New routes: `src/routes/cart.tsx`, `src/routes/_authenticated/checkout.tsx`, `src/routes/_authenticated/checkout.success.tsx`, each with its own head().
- Shared cart hook `src/hooks/use-cart.ts` over the existing `fx-cart` localStorage key (so current carts survive); Marketplace and ProductPageView switch to it.
- Extend `CheckoutInput` in `product-checkout.functions.ts` with zod-validated `contact` (name, email, phone), `shippingAddress` (line1, line2, city, region, postal, country), `note` (≤500 chars). Save into existing `product_orders.shipping_address`, `buyer_name`, `buyer_email`, `notes` at order creation; drop Stripe's `shipping_address_collection`, prefill Stripe email; success_url → `/checkout/success?orders=…`.
- Webhook keeps the app-saved address if present (only falls back to Stripe's).
- Reuse `quoteShipping` and `quoteProductDiscount` for live totals; server still recomputes all money.
- Seller Orders view shows the buyer's note; saved address stored in profile metadata (no schema change).
- Styling: light angler theme, existing Fish-X fonts/tokens; phone layout single column.
