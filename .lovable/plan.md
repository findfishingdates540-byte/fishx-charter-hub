# Captain storefront charter booking flow

## Confirmed problem

The storefront currently has three competing booking controls:

- Selecting a trip package only changes local storefront state.
- The right-side booking card also requires an inline date and departure before its button becomes usable.
- A separate “Next available departures” section lists departures across the whole business and links directly into booking.

The data model already supports the correct hierarchy: a package in `bookable_services` has `charter_id` and `boat_id`, and the parent charter also has its assigned `boat_id`. No schema migration is required.

## User flow

```text
Captain storefront
  Charter + assigned boat
    Package A  [Select]
    Package B  [Select]

Selected package summary
Party size
[Pick a departure]
        |
        v
Dedicated booking page: Date & time
        |
        v
Add-ons -> Deposit -> Confirmation
```

## Implementation

1. **Return the real charter hierarchy to the storefront**
   - Include each published service’s `charter_id` and `boat_id` in the public business-profile query.
   - Include enough parent charter and boat information to show which charter and vessel each package belongs to.
   - Keep charter and guided-trip packages separate from unrelated service kinds on captain/guide storefronts.

2. **Group storefront packages under their charter and boat**
   - Replace the flat trip list with charter groups.
   - Show the charter name and assigned boat once, with its packages beneath it.
   - Selecting a package updates the booking summary without navigating away or loading departures inline.

3. **Make “Pick a departure” the storefront handoff**
   - Simplify the storefront booking card to the selected package, price, and party size.
   - Make the button usable as soon as a valid package is selected.
   - Route it to the existing dedicated booking page with the selected package, party size, charter context, and an instruction to open directly at Date & Time.
   - Preserve the storefront URL as the back destination.

4. **Move all departure selection off the storefront**
   - Remove the business-wide “Next available departures” section.
   - Remove the inline date/departure controls from the storefront sidebar.
   - Use the booking page’s existing availability calendar as the single place to select a departure.

5. **Keep package, charter, and boat context correct in booking**
   - Add a validated booking-page start step so storefront traffic opens at Date & Time rather than the independent trip-detail step.
   - Load sibling packages by the same `charter_id`, not merely by the same business.
   - Resolve the boat from the selected package/parent charter, so changing packages cannot accidentally show another charter’s boat or departures.
   - Keep the selected service ID as the authoritative package for availability, pricing, add-ons, seat holds, and checkout.

6. **Navigation and responsive behavior**
   - “Back” from Date & Time returns to the captain storefront when that is where the angler started.
   - Keep direct charter-search bookings working through the existing trip-detail-first flow.
   - Ensure charter groups, package rows, the booking summary, and the departure page work on desktop and mobile.

## Verification

- Select two different packages on one storefront and confirm neither selection navigates away.
- Confirm “Pick a departure” opens Date & Time for the selected package and only shows that package’s departures.
- Confirm the displayed charter and boat remain correct when switching between sibling packages.
- Confirm packages from another charter owned by the same captain do not appear as siblings.
- Confirm back navigation returns to the originating storefront.
- Confirm a selected departure continues through add-ons and checkout using the existing atomic hold and payment flow.
- Confirm direct discovery/charter-detail booking links still open normally.
