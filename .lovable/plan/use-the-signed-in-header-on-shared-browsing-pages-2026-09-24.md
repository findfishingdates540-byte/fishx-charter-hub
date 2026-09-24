# Use the signed-in header on shared browsing pages

## What will change
- Make the shared public-page header session-aware: signed-out visitors keep the existing public navigation, while signed-in users see the authenticated navigation.
- Reuse one signed-in header across charter search, service search, Explore, Discover, marketplace, listing details, and other public browsing pages that operators or anglers can open while logged in.
- Keep the logo, Dashboard, notifications, messages, marketplace, account, and sign-out actions available in the signed-in version.
- Preserve the existing responsive public menu for signed-out visitors and give the signed-in header a compact mobile menu without changing dashboard navigation.

## Technical details
- Extract the reusable signed-in navigation from the angler dashboard into a focused shared header component rather than duplicating it across routes.
- Let `PublicHeader` switch between signed-out and signed-in variants after session resolution, while respecting existing custom actions used by marketplace pages.
- Replace the angler dashboard's copied header with the same shared signed-in component so both versions remain visually and behaviorally consistent.
- Verify search results signed out and signed in, plus phone and desktop layouts, and check the current build and runtime logs.

## Scope
- Header/navigation presentation only.
- No changes to search results, booking logic, account permissions, or operator dashboards.
