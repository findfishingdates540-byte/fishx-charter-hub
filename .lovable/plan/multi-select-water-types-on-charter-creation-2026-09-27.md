# Multi-select water types on charter creation

## Goal
When creating or editing a charter, captains can tick any mix of water types — Offshore / bluewater, Inshore, Nearshore & reef — instead of picking just one from a dropdown.

## Changes

1. **Charter form** (`src/components/captain/ChartersPanel.tsx`)
   - Replace the single "Water type" dropdown with a group of tick boxes: Offshore / bluewater, Inshore, Nearshore & reef, Flats, Freshwater.
   - Captains can tick any combination (at least one optional — leaving all unticked keeps the field empty, as today).
   - The chosen mix is saved as one comma-joined value in the existing `water_type` column (same approach already used for the business signup trip types), so no database change is needed.
   - When editing an existing charter, the saved value is split back into ticks so the form shows what was chosen.

2. **Validation** (`src/lib/captain-charters.functions.ts`, `src/lib/captain-management.functions.ts`)
   - Raise the `water_type` length limit (currently 40 chars) so a full mix fits comfortably.

3. **Display**
   - Charter cards and public charter pages keep showing the value; a mix reads naturally, e.g. "Inshore, Nearshore & reef".

## Technical notes
- No schema migration: `charters.water_type` stays a text column; only the max-length validator changes.
- Existing charters with a single value keep working unchanged (a single value just means one box ticked).
- Verified current state: the dropdown lives in `ChartersPanel.tsx` (`WATER_TYPES` list, `draft.water_type` select), and validators cap the field at 40 chars in `captain-charters.functions.ts` and `captain-management.functions.ts`.

## Verification
- Typecheck passes; preview builds cleanly.
- Manual check: create a charter with two types ticked, save, reopen — both ticks are still set, and the card shows the combined label.
