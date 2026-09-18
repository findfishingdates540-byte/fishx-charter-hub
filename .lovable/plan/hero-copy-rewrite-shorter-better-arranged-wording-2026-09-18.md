# Hero copy rewrite — shorter, better-arranged wording

The landing hero (`src/dc-templates/landing.html`) currently has an overloaded headline
("One platform for the entire fishing industry — every deal secured by escrow." spread
across five ragged line breaks) plus a long two-clause description, and the tagline is
repeated twice more on the page. The fix is copy-only: same layout, same search widget,
same collage — tighter words and balanced line breaks.

## New hero copy

**Headline (H1, tagline leads — user's pick):**

```text
One platform
for the entire
fishing industry.
```

Three balanced lines, no escrow clause inside the headline. The gold italic accent style
moves to the supporting line below so the headline keeps one visual highlight.

**Supporting escrow line (new, replaces nothing — sits between H1 and the search widget):**

```text
Every deal — booked, bought or sold — secured by escrow.
```

Short one-liner in the muted ink color with "secured by escrow" in the gold italic
treatment currently on the headline span. This replaces the old escrow clause and most of
the long description.

**Removed:** the current long description paragraph ("From charter captains and guides to
tackle shops, marinas, gear makers and apparel brands — buy, book and sell across the
fishing industry, with every payment held in escrow until it's delivered."). Its content is
already covered by the category pill row above and the escrow line + collage badges.

## De-duplicate the tagline

- Delete the small line under the search widget that reads "One platform for the entire
  fishing industry" (line ~102) — the H1 now says it.
- Keep the `<b>6</b> industry categories` stat line; it becomes the only item in that row.

## What stays untouched

- Badge pill ("Charters · Tackle · Marinas · Wholesale"), search widget, category chips,
  collage, parallax/badge animations, and the rest of the page.
- Desktop + mobile: headline max-width and line breaks verified at 393px and 1280px so
  no line wraps awkwardly.

## Verification

- Playwright screenshot of the hero at desktop (1280px) and phone (393px) widths to
  confirm balanced line breaks, no overflow, and the search widget still visible above
  the fold.
