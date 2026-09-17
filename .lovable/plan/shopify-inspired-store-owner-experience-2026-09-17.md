# Shopify-inspired store-owner experience

## Goal

Give tackle shops, bait shops, gear manufacturers, and apparel brands a fuller merchant workspace inspired by Shopify’s information structure, while keeping the Fish-X dark navy/cyan operator design and existing marketplace workflows.

## Store-owner navigation

Reorganize the left menu into clear merchant sections without removing Fish-X-specific tools:

- **Home** — store performance and action list
- **Orders** — fulfillment, tracking, refunds, and order history
- **Products** — catalog, inventory, variants, tags, and wholesale pricing
- **Customers** — buyer list and purchase history
- **Analytics** — sales, orders, products, and customer trends
- **Messages** — full-screen customer conversations
- **Bookings** — storefront trip/service bookings where applicable
- **Online store** — storefront status, preview, public link, and presentation details
- **Payments** — earnings, fees, held funds, transfers, and bank connection
- **Settings** — store configuration
- Discounts — product coupons creation; by percecntage off, fixed price off, expiry, the full discount/coupon experience. Disount codes should apply to product price properly so users pay the right amount

The current workspace selector, badges, mobile menu, unknown-tab fallback, and active shop selection will remain intact.

## Functional pages

### 1. Home

Expand the existing overview into a useful merchant home:

- Sales, orders to fulfill, live products, and low-stock totals
- Recent order activity and best-selling products
- Clear action list for unfinished store setup, low stock, unfulfilled orders, unpublished products, and disconnected payouts
- Use only real store data; no invented trends, ratings, or earnings

### 2. Orders

Keep the current shipping, delivery, tracking, refund, address, and status tools, then improve the workspace with:

- Scannable order rows and a detailed order view
- Buyer details, item breakdown, shipping charge, total, payment/payout state, fulfillment timeline, and notes
- Search and filters that work well on desktop and mobile
- Existing refund and inventory-restock protections remain the source of truth

### 3. Products

Upgrade catalog management around the existing product editor:

- Search, filter, and sort by status, category, inventory, and stock level
- Clear draft/live/out-of-stock states and bulk publish/unpublish actions
- Keep images, custom tags, SKUs, stock thresholds, variants, wholesale tiers, and product preview
- Bring variants and wholesale controls into a clearer product-management hierarchy rather than making owners hunt for them

### 4. Customers

Add a functional customer area derived from actual product orders:

- Group buyers by signed-in buyer ID where available, otherwise normalized email
- Show name, email, order count, total spent, last order, and fulfillment status
- Open a customer detail view with their order history and direct message entry point
- Avoid a duplicate CRM schema in this phase; derive the view from the existing order records

### 5. Analytics

Add practical store analytics using existing order and product data:

- Sales and order trends by selectable date range
- Average order value, units sold, refunds, shipping collected, and net payout visibility
- Best-selling products and new versus returning buyers
- Clear empty states for stores without sales
- Do not label storefront visitor counts or conversion rates until product-view event tracking exists

### 6. Online store

Create one place for storefront management:

- Published/draft status, storefront preview, and public URL
- Store name, logo, cover photo, description, contact details, hours, gallery, social links, and existing map/address data
- Buyer-facing shipping, returns, refund, privacy, and terms links/content
- Preserve the shared Fish-X storefront template; this phase does not add a theme builder or custom domains

### 7. Payments

Retain the existing real Stripe Connect flow and payout ledger, but present store-specific summaries consistently:

- Gross sales, Fish-X fees, refunds, held funds, released payouts, and bank-transfer status
- Link payout setup and bank status directly to the relevant Settings section

## Store settings

Replace the current stacked settings experience for shops with a dedicated, responsive settings index:

- **General** — store identity, contact details, address, locale, and display currency
- **Shipping & delivery** — current flat rate, per-item rate, free-shipping threshold, and buyer-facing shipping note
- **Customer privacy** — basic controls only:
  - enable the shared Fish-X cookie notice on the storefront where required
  - ask for optional email marketing consent during shopping/checkout
  - editable privacy-policy link/text and contact details
  - no advanced regional consent engine or customer data-request automation in this phase
- **Policies** — shipping, returns/refunds, privacy, and terms shown consistently on the storefront and product pages
- **Notifications** — existing email/in-app preferences
- **Team & permissions** — existing owner, manager, and staff controls
- **Payments & payouts** — existing Stripe connection and bank status

Store policy/privacy configuration will extend the existing business settings data. If recording customer marketing consent needs new persistent fields, add them through an owner-scoped Supabase migration with grants and RLS.

## Responsive behavior

- Desktop keeps the Shopify-inspired left navigation and roomy data views.
- Tablet keeps a collapsible icon rail.
- Mobile uses a compact menu, stacked summaries, and order/product/customer detail sheets without horizontal overflow.
- Messaging remains the existing shared full-screen experience across every account type.

## Technical approach

- Refactor the large shop dashboard into focused merchant sections while reusing the existing operator shell and semantic dark-theme tokens.
- Add authenticated server functions for customer aggregation and analytics, always scoped to the active business membership.
- Reuse `product_orders`, `product_order_items`, `inventory_products`, payout records, shipping settings, business profile/policy JSON, and Stripe Connect data.
- Add only the smallest schema change required for durable marketing consent; include explicit grants and owner-safe RLS.
- Keep URL-driven tabs so refresh, deep links, and browser back preserve the selected merchant section.
- Add route metadata to any new content routes and retain existing security boundaries.

## Validation

- Test with a store owner who belongs to multiple businesses to confirm every page remains scoped to the displayed shop.
- Verify navigation and settings at desktop, tablet, and mobile sizes.
- Test product creation/editing/preview, order fulfillment/refund, customer history, analytics totals, policy display, privacy consent, and payout links.
- Confirm no blank screen occurs for unknown or stale dashboard links.