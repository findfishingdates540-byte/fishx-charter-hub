# Bookmarkable mobile settings pages

On phones, every settings menu will use the same list-to-page pattern: selecting an item opens only that item, with a clear back bar and no stacked or dropdown menu. Desktop and tablet layouts remain unchanged.

## What changes

1. **Account settings navigation**
   - Turn the current phone sidebar into a clean list for Personal details, Security, Orders, Saved items, Followed sellers, Notifications, and each owned business.
   - Selecting an item opens only that content on the phone, with a sticky back arrow returning to the settings list.

2. **Business settings navigation**
   - Keep the existing business list-to-section phone experience for Profile, Visibility, Team, Notifications, and Payouts.
   - When entered from account settings, back first returns to that business's settings list, then to the main settings list.
   - Apply the same behavior inside captain, guide, marina, and store consoles.

3. **Deep links and history**
   - Store the selected account section, business, and business subsection in the URL so every screen can be bookmarked or reopened directly.
   - Update the URL when navigating instead of relying on temporary component state.
   - Browser/system Back and the visible back arrow follow the same predictable hierarchy without leaving Settings too early.
   - Existing readiness “Fix” links continue opening the correct business subsection.

4. **Responsive behavior**
   - Phone-only section pages hide the operator bottom dock and reserve the full content width.
   - Tablet and desktop retain the current side navigation and content columns, while their selected section also stays reflected in the URL.

## Technical details

- Add validated search parameters to the authenticated Settings route for the account section, business ID, and business subsection.
- Make `SettingsPage` derive selection from those parameters and navigate through TanStack Router links/navigation.
- Extend `BusinessSettings` with URL-backed section changes and an explicit parent-back callback; remove synthetic `pushState` handling so router history is authoritative.
- Thread section deep-link state through each operator dashboard's Settings rendering without changing settings data or business rules.
- Verify direct loading, refresh, visible Back, browser Back, and phone/desktop layouts.
