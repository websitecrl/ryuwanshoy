# 0003 · Age restricted series and chapter pages

**Status**: Assumed
**Date**: 2026-10-09
**Authorized by**: Sayron123, during /develop

## Owed decision
How a series page or chapter reader treats a reader whose saved age band is below the
series `min_age` (for example a reader who picked 13 opening a direct link to an 18+ series).

## Assumption built on
- Decided in the browser, like the age gate (spec 0002). The HTML stays the same for every
  visitor and keeps the real content, so search engines still see it. The age is self reported,
  so this protects honest younger readers; it is not access control.
- When the saved age is below the series `min_age` (13, 16 or 18; `null` counts as 13), the page
  content is replaced by a "not for your age" screen.
- No flash: `AGE_INIT_SCRIPT` also writes the saved age to `<html data-reader-age>`, and CSS
  hides the content (and shows the block screen) before first paint.
- The block screen offers "Back to comics" and "I picked the wrong age". The second clears the
  saved age, so the age gate asks again.
- No saved age yet: the age gate shows as before; after picking, the rule above applies.

## Code area
- `src/lib/age.ts`, `src/hooks/useSavedAge.ts`, `src/app/globals.css`
- `src/components/shared/AgeRestricted.tsx` (new)
- `src/app/comics/[slug]/page.tsx`, `src/app/comics/[slug]/[chapter]/page.tsx`

## Requirements
- AC-1: A reader with saved age 13 opening a 16+ or 18+ series page or chapter sees the block
  screen, never the content, not even before React loads.
- AC-2: A reader with saved age 16 is blocked from 18+ only; a reader with 18 is never blocked.
- AC-3: 13+ series (or `min_age` null) are never blocked.
- AC-4: "I picked the wrong age" clears the saved age and shows the age gate again.
- AC-5: The HTML is identical for every visitor and still contains the page content.

## Ratify
This decision was recorded by /develop, not deliberated. Run `/architect age-restricted-pages`
to deliberate and ratify it. Until then it stays flagged as an owed decision; it does not block marking the feature `done`.
