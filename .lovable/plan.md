# Responsive operator navigation redesign

## Reference analysis

The Stitch design solves the current mobile clutter with three distinct navigation layers instead of placing every destination in one crowded row:

1. **Sticky identity row**
   - A compact menu button, Fish-X wordmark, current workspace, and notification bell share one stable row.
   - The workspace name truncates rather than pushing controls off-screen.
   - The row stays visible while the operator scrolls.

2. **Independent horizontal work tabs**
   - All dashboard destinations live in a single, swipeable pill row beneath the identity row.
   - Every pill has a fixed width, so labels do not compress or wrap.
   - The scrollbar is hidden, a right-edge fade signals more items, badges remain attached to their labels, and the active tab uses cyan fill.
   - Selecting an off-screen tab brings it into view.

3. **Four-item bottom dock**
   - Only the most frequent actions stay fixed at the bottom; the full tab set remains available above and in the menu.
   - The fourth item opens account/settings rather than crowding the dock with secondary tools.
   - Content receives enough bottom space that the dock never covers controls.

The visual hierarchy also keeps the page title below navigation, uses a two-column mobile KPI grid where values remain readable, and stacks complex content. The reference’s marina-specific labels, VHF status, and operational copy will not be copied to other business types.

## Current-state findings

- Marina, guide, tackle shop, bait shop, gear manufacturer, and apparel dashboards already share `OperatorShell`, but its mobile rules turn the desktop sidebar into a collapsed dropdown rather than the Stitch two-row navigation.
- Captain uses a separate hand-built shell, so its header behaves differently and its `Calendar` destination is present in content but omitted from the visible navigation list.
- Broad authenticated-page CSS currently targets nearly every sticky header and injects another hamburger menu. The operator redesign needs an explicit shell boundary so it does not receive duplicate controls.
- Desktop navigation is already suitable as a sidebar; the redesign should preserve it and specialize the compact layout for tablets and phones.

## Implementation

### 1. Build one responsive operator shell

- Refactor the shared operator shell into explicit desktop and compact navigation regions.
- Keep the desktop sidebar at larger widths.
- At tablet/phone widths, render the Stitch structure:
  - sticky top identity row;
  - accessible menu button and slide/drop drawer containing the complete destination list, account, settings, and sign out;
  - compact Fish-X brand;
  - current workspace control with truncation and existing multi-store switching where available;
  - live notification bell;
  - horizontally swipeable pill navigation with badges, active state, hidden scrollbar, edge fade, and automatic active-tab visibility;
  - fixed/sticky four-item bottom dock with safe-area spacing.
- Use the existing Fish-X navy/cyan tokens and Outfit typography rather than Stitch’s alternate font and teal values.
- Add proper focus states, labels, expanded state, keyboard operation, and reduced-motion behavior.

### 2. Give each operator the right navigation

Use the same structure while retaining each operator’s real destinations:

- **Marina/lodge:** Overview, Slips, Bookings, Calendar, Guests, Reservations, Services, Listings, Messages, Payouts, Settings. Bottom dock: Harbor, Slips, Bookings, Account.
- **Guide service:** Overview, Trips, Calendar, Guides, Availability, Guests, Requests, Listings, Messages, Payouts, Settings. Bottom dock: Home, Trips, Calendar, Account.
- **Store operators** (tackle, bait, gear, apparel): Home, Orders, Products, Customers, Analytics, Discounts, Online store, Bookings, Wholesale, Messages, Payments, Settings. Bottom dock: Home, Orders, Products, Account.
- **Captain/charter:** Overview, Bookings, Calendar, Charter Trips, Blockout Dates, Fleet, Messages, Earnings, Settings. Bottom dock: Home, Bookings, Charters, Account.

Badges will continue to use real pending/upcoming/request data only. Operator-specific status controls remain operator-specific: VHF for marinas, availability state for captains, workspace switching for multi-store owners.

### 3. Bring Captain into the shared behavior

- Reuse the responsive operator navigation structure for the captain dashboard while leaving all existing captain panels and actions intact.
- Restore Calendar to the visible navigation.
- Preserve captain readiness links, booking badges, accepting/paused control, messages, earnings, settings, and sign-out behavior.

### 4. Match the reference’s mobile content behavior

- Place page title/subtitle beneath the compact navigation instead of competing for space in the identity row.
- Keep compact KPI cards in a stable two-column phone grid when their contents fit; collapse complex split layouts and tables safely.
- Tighten card and page spacing for phones without changing dashboard data or workflows.
- Add bottom inset spacing for the dock and handle iPhone safe areas.
- Prevent label wrapping, horizontal page overflow, clipped menus, overlapping notification panels, and covered form controls.

### 5. Isolate legacy responsive rules

- Exclude the new operator header from the generic authenticated-header hamburger decorator.
- Replace overlapping operator-specific mobile selectors with scoped shell rules so public, angler, booking, messaging, and admin headers remain unchanged.

## Verification

- Check marina, guide, store, and captain dashboards at 393px phone, 768px tablet, and desktop widths.
- Verify horizontal swipe/scroll, active-tab auto-positioning, badges, drawer open/close, bottom-dock destinations, workspace switching, notifications, settings/account, and sign out.
- Verify each dashboard’s existing panels still open and no content sits beneath the bottom dock.
- Confirm there is no horizontal page overflow, duplicate hamburger, wrapped/clipped labels, or navigation-driven layout shift.
- Check the preview build and browser console after the changes.

## Scope

This changes operator dashboard navigation and responsive presentation only. It does not alter booking, payout, listing, notification, or account data logic.
