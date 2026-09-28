# Storefronts for sellers of goods: show products, not services

## Goal
When a visitor opens the public storefront (`/b/<slug>`) of a business that sells goods — tackle shops, bait shops, apparel brands, gear manufacturers — the page should lead with their available products. Today the page always leads with a "Services" section, and products (if any) appear as a small secondary strip at the bottom.

## What changes

### 1. Product-first layout for goods sellers (`src/components/profile/OperatorProfile.tsx`)
- Detect goods-selling categories: `tackle_shop`, `bait_shop`, `apparel`, `gear_mfg`.
- For these businesses:
  - The main section becomes **Products** — a proper grid of product cards (photo, name, price, stock status) instead of the current small strip.
  - Each product card links to its marketplace page (`/marketplace/$productId`) where the buyer can purchase.
  - The services section is shown only if the business actually has bookable services (e.g. a tackle shop's rigging clinic), and it moves below the products.
  - If the shop has no products yet, show a friendly "No products listed yet" state instead of an empty services list.
  - Header stats swap emphasis: "products" count first, "services" second.
- Charter, guide, marina, and lodge storefronts are unchanged — they keep leading with trips/services.

### 2. Labels (`LABEL_BY_CATEGORY` in the same file)
- Update the section labels for shop categories so they read "Products" / "Shop the range" instead of "Services".

## Technical notes
- `getBusinessProfile` (`src/lib/businesses.functions.ts`) already returns `products` from `inventory_products` with images — no backend change needed.
- All changes are in `OperatorProfile.tsx` (the shared storefront component used by `/b/$slug`); no route or database changes.
- Verified only published, in-stock products appear (the loader already filters).

## Verification
- Typecheck passes.
- Preview `/b/star-gate` (apparel store with 2 products) renders the product grid first; a captain storefront still shows trips first.
