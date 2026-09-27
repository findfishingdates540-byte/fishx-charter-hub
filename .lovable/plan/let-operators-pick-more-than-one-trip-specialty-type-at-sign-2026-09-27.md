# Let operators pick more than one trip / specialty type at signup

## What changes
On the business signup form, the "Waters you fish" question for charter captains is currently a single-choice dropdown. Charters often run offshore, nearshore and other trips, so it becomes a list of tick boxes:

- Offshore / bluewater
- Inshore
- Nearshore & reef
- Fly & light tackle
- Other (ticking it shows a short text box, e.g. "Wreck fishing, night trips")

Operators can tick as many as apply. At least one is required before continuing.

The same multi-select treatment applies to the other similar single-choice questions where more than one answer is natural:
- Guides: "Type of guiding" (Fly fishing, Bass & freshwater, Inshore / flats, Offshore, Ice fishing, Other)
- Manufacturers: "Product category" (plus Other)
- Apparel: "Product focus" (plus Other)

Tackle shop "Sales channel" stays single-choice (options already cover combinations); marina slip count stays a number.

## Look
Tappable rows styled like the rest of the signup form (card background, thin border, cyan tick when selected), large enough for phones.

## Technical details
- `src/routes/auth.tsx` `VerticalDetail`: replace `select()` with a `multi()` checkbox group (`name="detail"` checkboxes + `detail_other` text input shown when Other is ticked).
- Submit: collect via `FormData.getAll("detail")`, replace "Other" with the typed text, join with ", " into `vertical_detail` metadata (existing field, so onboarding prefill keeps working); validate at least one selection.
- Mirror the change in `src/dc-templates/auth.html` for consistency.
