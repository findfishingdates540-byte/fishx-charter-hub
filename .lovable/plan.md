# Hide operator listings until they can actually take a booking

Right now a listing goes public the moment an operator flips it live, even if they never connected payouts or added dates. Anglers then hit payment errors at checkout. This change makes "visible to anglers" depend on being genuinely bookable.

## The rule

An operator appears in Explore, search, the marketplace and on their public page only when:

1. Their payments are connected and able to receive money, and
2. They have at least one live listing with upcoming dates (trips, guided trips, slips, lodging) — or, for shops, at least one live product in stock.

Shops selling gear follow the same rule: products drop out of the marketplace until the shop can receive money.

## Operators already live today

Nobody gets pulled down without warning. Every business that is currently public is flagged as grandfathered and stays visible. They get:

- A clear banner at the top of their console: what's missing, and that their listings will be hidden until it's fixed, with a "Fix now" link to the exact step.
- One notification (in-app and email) explaining the same.

Once they finish the missing steps, the flag clears and they are on the normal rule. New operators from this point are only listed once they meet the bar.

## What operators see while they're not ready

- Their console keeps working fully — setup, listings, dates, documents, payments, everything. Nothing is blocked.
- Their "Go live" toggle explains exactly what is still missing instead of silently publishing an unbookable page.
- Their public page shows for them (preview) but is not reachable by anglers or listed anywhere.

## What anglers see

- No operator appears who can't complete a booking, so the "can't accept payments" error disappears.
- Explore counts, category chips and city filters reflect only bookable operators.

## Technical notes

- New database columns on `businesses`: `listing_ready` (boolean, maintained automatically) and `listing_grace` (boolean, set true for every currently published business as the grandfather flag).
- A security-definer function recomputes `listing_ready` for a business: `charges_enabled` AND `payouts_enabled` AND (a published `bookable_services` row with a future non-blackout `service_availability` slot, OR a published `inventory_products` row for retail categories). Triggered on changes to `businesses` (Stripe flags), `bookable_services`, `service_availability` and `inventory_products`, plus a one-time backfill in the migration.
- Public visibility becomes `is_published AND (listing_ready OR listing_grace)`:
  - Enforced in the anon SELECT RLS policies on `businesses`, `bookable_services` and `inventory_products` (services/products check their parent through the helper function), so direct API reads are gated too.
  - Mirrored as explicit filters in the public read paths: `listPublicBusinesses`, `getBusinessProfile`, `getBusinessBySlug`, `services-search.functions.ts`, `shopping.functions.ts`, `charters.functions.ts`, `tackle.functions.ts`, `marina.functions.ts`, `angler-explore.functions.ts` and `ranking.functions.ts` / `rank_listings`.
- `getOperatorReadiness` gains the availability/product condition in its blocking set and returns `listingVisible` + `grace` so `ReadinessGate` can render the warning banner; `setStorefrontLive` refuses to publish when blockers remain (returns the blocker list rather than throwing).
- Grandfather notification: a one-shot pass over grandfathered businesses sends `sendDirectNotification` (category "verification"/setup) to each business's members with a link to their payouts step; guarded by a marker so it isn't re-sent.
- Admin: the Operators panel `operatorStatus()` gains a "Hidden — setup incomplete" state, and the Listings panel shows why a listing isn't public.
