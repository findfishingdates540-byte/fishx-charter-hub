# What's left across the app

A short list of the gaps still open, grouped by who can close them. Nothing here is broken today — these are the pieces that finish the product.

## 1. Needs you, not me

These can't be done from inside the project.

- **Publish + redeploy Netlify.** The live sites still run older code, so recent work (product preview pages, photo fixes, the new messaging, the Explore hub) isn't visible to real users yet.
- **One live payment test.** A business needs to finish Stripe Connect onboarding (charges and payouts enabled), then run a single real booking end to end and confirm the production webhook logged it.
- **Confirm one real email delivery.** The sender is configured, but no booking confirmation has been confirmed as actually landing in an inbox.

## 2. Gaps I can build

Ordered by how much they affect real users.

1. **Captain's own trip calendar.** Admins have a month calendar of every trip with dates, times, price and payout status. Captains only have list views — they should get the same calendar scoped to their own business.
2. **Teammate invite emails.** Owners can add and remove teammates, but an invited person never receives an email telling them to join.
3. **Guide and marina consoles are thin.** Captains and shops have full editors (trips, packages, products, availability, bookings). Guides and marinas have single-screen dashboards without the same depth.
4. **Storefront map pin.** Operator profiles show a city but no location on a map.
5. **Angler profile visible on bookings.** Anglers can fill in bio, home port and target species; operators don't see any of that when a booking comes in.
6. **Notification centre.** Emails go out, but there's no in-app list of "what happened recently" for either side.
7. **Reviews loop.** Reviews exist in the data model but there's no prompt after a completed trip and no place a shopper reads them before booking.

## 3. Smaller polish items

- Booking flow file still notes escrow as simulated in one place — worth a pass to confirm every path uses the real Stripe records.
- Public pages (storefronts, marketplace listings) could use richer share previews for links posted to social.

## Suggested order

Publish first so real users get the finished work. Then captain calendar → teammate invites → guide/marina depth, since those are the ones operators hit daily.

## Technical notes

- Captain calendar: reuse `getAdminTripCalendar` in `src/lib/admin.functions.ts` as the shape, add a business-scoped variant behind `requireSupabaseAuth` + `is_business_member`, and render with a copy of `AdminTripCalendar.tsx` in the operator theme.
- Invites: extend `src/lib/business-settings.functions.ts` teammate add with a Resend dispatch, reusing the existing email sender.
- Guide/marina depth: mirror the `CaptainPageShell` + dedicated edit-route pattern already used for charters and products.
