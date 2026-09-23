# Mobile settings: drill-in pages instead of a stacked menu

On phones, Settings will behave like the Shopify screen in the video: a plain list of
settings sections, and tapping one opens that section on its own screen with a back
arrow at the top. Desktop and tablet keep the current side-menu layout exactly as it is.

## What changes

1. **Settings list screen (phones only)**
   - Shows the business name, the signed-in email, then a full-width row per section
     (Business profile, Storefront & visibility, Team & roles, Notifications, Payouts)
     with its short hint and a chevron on the right.
   - No section content is rendered underneath.

2. **Section screen (phones only)**
   - Tapping a row replaces the list with just that section, topped by a sticky bar:
     back arrow + section title.
   - Back returns to the list.
   - The browser/system back gesture also returns to the list rather than leaving
     Settings.

3. **Bottom dock**
   - Stays visible on the settings list.
   - Hidden while a section screen is open, so the section gets the full height and
     nothing is covered.

4. **Deep links unchanged**
   - The readiness checklist "Fix →" links still land directly on the right section;
     on a phone that opens the section screen with the back arrow pointing to the list.

5. **Desktop / tablet**
   - Untouched: sticky left menu + content column, same styling.

## Technical notes

- `src/components/business/BusinessSettings.tsx`: add a phone-only view state
  (`list` vs `section`) driven by a `max-width: 900px` media query hook, matching the
  breakpoint already used by `.fx-operator-*` rules. Above the breakpoint the existing
  two-column grid renders unchanged.
- Row markup reuses the existing `OP_SECTIONS` array; styling uses the current navy/cyan
  tokens (`#14202B` card, `#2DE2F2` accent) and Outfit type.
- Back navigation: push a history entry when opening a section and listen for `popstate`,
  so the hardware back button closes the section instead of leaving the page.
- Dock hiding: when a section screen is open, set a body/root class (e.g.
  `fx-hide-dock`) that `src/styles.css` uses to hide `.fx-operator-dock` and drop the
  `.fx-operator-dock-clearance` spacer under 900px.
- Presentation only — no changes to settings data, publish rules, or payouts logic.
