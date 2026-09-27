# Build what's left

Finish the remaining product gaps, ordered by user impact. Everything below is buildable inside the project; the publish / live-payment / email-delivery checks stay with you.

## 1. Captain's own trip calendar

Captains currently only have list views. Give them the same month calendar admins have, scoped to their own business.

- Add a business-scoped server function modelled on `getAdminTripCalendar` (`src/lib/admin.functions.ts`), guarded by `requireSupabaseAuth` + `is_business_member`.
- Render it with an operator-theme copy of `AdminTripCalendar.tsx`, added as a "Calendar" tab in the captain console.
- Show trip date, time, price, booking count and payout status per day; Sunday–Saturday grid.

## 2. Teammate invite emails

Owners can add teammates today, but the invited person never hears about it.

- Extend the teammate-add flow in `src/lib/business-settings.functions.ts` to send an invite email via the existing Resend sender (hello@bookfishingtrips.com).
- Email explains who invited them, links to sign up / sign in, and names the business.
- Reuse the email-safe template style already in `supabase/email-templates/`.

## 3. Guide and marina console depth

Guides and marinas have single-screen dashboards; captains and shops have full editors.

- Mirror the `CaptainPageShell` + dedicated edit-route pattern for guides (trips, packages, availability, bookings) and marinas (slips, reservations, services).
- Reuse existing section routes (`guide.$section.tsx`, `marina.$section.tsx`) as the entry points.

## 4. Storefront map pin

- Show an operator's location on a map on their public storefront, using the stored city/region (and coordinates where available).
- Load the map client-side only (dynamic import behind `ClientOnly`) so SSR stays clean.

## 5. Angler profile visible on bookings

- When a booking comes in, the operator view shows the angler's bio, home port and target species from their profile, next to the booking details.

## 6. In-app notification centre

- A "what happened recently" list for both anglers and operators, backed by the existing `notifications` table.
- Bell in the header with unread count; a page listing recent events (bookings, documents, payouts, messages) with links to the right screen.

## 7. Reviews loop

- After a trip is completed, prompt the angler to leave a review (in-app + email).
- Show approved reviews on the public storefront and listing pages so shoppers can read them before booking.

## 8. Polish pass

- Confirm every escrow path uses the real Stripe records (one comment in the booking flow still says "simulated").
- Richer social share previews (og tags) on storefront and marketplace listing pages.

## Suggested order

1 → 2 → 3 first (operators hit these daily), then 4–7, polish last. Each item ships independently, so you can publish after any of them.

## Technical notes

- Captain calendar: reuse the `getAdminTripCalendar` query shape; new business-scoped variant behind `requireSupabaseAuth` + `is_business_member`; operator-theme calendar component.
- Invites: extend teammate add with a Resend dispatch through the existing email sender.
- Guide/marina: mirror `CaptainPageShell` and the edit-route pattern already used for charters and products.
- Notification centre: `notifications` table already exists; add list + unread-count server functions and Realtime subscription with cleanup.
- Reviews: `reviews` table already exists; add post-completion prompt, operator-facing display, and public read policy if missing.
- No new tables expected except possibly small additions; any schema change goes through a migration with GRANTs and RLS.
