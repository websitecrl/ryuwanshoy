# 0002 · SEO: age gate overlay and real 404s

**Status**: Assumed
**Date**: 2026-10-09
**Authorized by**: Sayron123, during /develop

## Owed decision
1. Whether search engines and link previews may see page content behind the age gate.
2. What the age filtered lists (home hero, home latest chapters, `/comics` grid) show in the
   server HTML, before the browser has read the reader's saved age.

## Assumption built on
- The age gate is a reader prompt, not access control. Every visitor (crawlers included) gets
  the same HTML: the real page content, with the age gate rendered as an overlay on top.
  No user agent sniffing, no per visitor HTML (the HTML is cached and shared).
- An inline `<head>` script reads `localStorage['ryu-age']` and marks `<html>` before first
  paint, so a reader who already picked an age never sees the overlay. A new reader is blocked
  from first paint, before JS loads.
- Before the saved age is known (server HTML, and the first client render), age filtered lists
  show only all ages series (`min_age` 13 or lower, `null` counts as 13). After the age is read,
  older readers see the extra series appear. A reader never sees a series above their age,
  not even briefly.
- Unknown series slugs, unknown chapter numbers, and chapter segments that are not a plain
  whole number (for example `1abc`) return HTTP 404.

## Code area
- `src/components/shared/AgeGate.tsx`, `src/app/layout.tsx`, `src/lib/age.ts` (new)
- `src/app/(components)/HomeClient.tsx`, `src/components/admin/reader/HeroBanner.tsx`,
  `src/components/admin/reader/SeriesGrid.tsx`
- `src/app/comics/[slug]/page.tsx`, `src/app/comics/[slug]/[chapter]/page.tsx`

## Requirements
- AC-1: The HTML of `/`, `/comics`, `/comics/<slug>` and `/comics/<slug>/<n>` contains the page
  content (headings, series titles, links), not an empty body.
- AC-2: The HTML is identical for every visitor (no cookies, headers or user agent read).
- AC-3: A reader with no saved age sees the gate over the page from first paint and cannot
  scroll or tab into the page behind it. Picking an age removes it and saves the age.
- AC-4: A reader with a saved age never sees the gate, not even a flash.
- AC-5: Age filtered lists in the server HTML contain only all ages series.
- AC-6: `curl -I` returns 404 for `/comics/<bad-slug>`, `/comics/<slug>/<missing-number>`
  and `/comics/<slug>/abc`, and 200 for real pages.
- AC-7: `/admin` never shows the gate.

## Ratify
This decision was recorded by /develop, not deliberated. Run `/architect seo-age-gate`
to deliberate and ratify it. Until then it stays flagged as an owed decision; it does not block marking the feature `done`.
