# 0004 · Our own flip reader (replacing react-pageflip)

**Status**: Draft (waiting for owner approval)
**Date**: 2026-10-21
**Authorized by**: Sayron123, in chat ("option B"), after #49 shipped option A

## Why
Flip mode uses `react-pageflip` (`page-flip` underneath). #49 made it look like a
real book (paper edges, spine shadow, 400ms turn, stronger curl shading), but the
library still limits us:

- A page can only turn one way: soft corner curl or stiff 3D tilt, never both.
  FlipHTML5 tilts on click and curls on drag.
- Every page of the chapter is mounted in the book at once, so long chapters load
  and animate heavier than they need to.
- Its quirks have to be worked around instead of fixed (#35: the hidden cover
  page and `startPage` offset).

## Decision to make
Build our own flip component, keep every current behavior, then remove the library.

## What it must keep doing (today's behavior)
These come from `FlipReader.tsx` and `ReaderShell.tsx` as of #49.

- R-1: Desktop (wider than 880px) shows two pages side by side; phones show one.
- R-2: Turning: click or tap the right page for next, left page for back; the
  side arrow buttons; `ArrowRight` / `Space` for next, `ArrowLeft` for back;
  drag a corner (mouse) or swipe (touch).
- R-3: A short drag that is let go early springs back without turning.
- R-4: Page counter (`Page 3 – 4 / 10` on desktop, `Page 3 / 10` on phones) and
  the progress bar always match what is on screen.
- R-5: The last visible page is reported to `onPageChange`, so reading progress,
  "chapter done" and "Continue reading" save exactly as today (they stay in
  `ReaderShell` with their `savedAgeAllows` checks, spec 0003).
- R-6: Opening with `?page=N` starts on the spread or page that holds page N,
  and the reader can still go back to page 1.
- R-7: On the last page the next arrow becomes a "Next" link to the next chapter
  when there is one, and is disabled when there isn't.
- R-8: Clicking outside the book shows or hides the reader bars (`onToggleUI`).
- R-9: Two page spreads (`is_spread`) show as one wide image across both pages on
  desktop and as one whole image on phones.
- R-10: Book look from #49: paper edges that shift as you read, spine shadow,
  400ms turn, light and shadow on the turning page, light and dark mode tokens.
- R-11: Images: the first pages load eagerly, the rest lazily, via `next/image`.
- R-12: A blocked 16+ or 18+ chapter is never mounted (spec 0003); nothing in the
  new component may save state on its own.

## What it adds
- A-1: Click, tap and keys turn with a quick 3D tilt; drag and swipe curl the
  corner and follow the pointer.
- A-2: Only the pages near the current spread are mounted (about 2 spreads each
  way); the rest are added as the reader moves.
- A-3: With the system setting "reduce motion" on, pages change with a short
  fade instead of a flip.
- A-4: A spread always opens as one view on desktop. Today a spread that falls on
  an odd book position is split across two views; a blank page is inserted
  before it when needed.

## How it gets built (one PR each)
1. This spec, approved.
2. Click, tap and key turns with the 3D tilt, desktop and phone, behind
   `?flip=new`, with the book look (R-10) shared with the old reader.
   Everyone else keeps the current reader.
3. Drag and swipe with the corner curl, including spring back (R-3).
4. Spreads (R-9, A-4), `?page=N` (R-6), reduce motion (A-3), mounting only
   nearby pages (A-2).
5. Make it the default, delete the old reader and remove `react-pageflip` and
   `page-flip` from `package.json`.

## Code area
- `src/components/reader/FlipReader.tsx` (replaced in step 5)
- New: `src/components/reader/flip/` (the book, the page, the turn math)
- `src/components/reader/ReaderShell.tsx` (only to pick old or new behind `?flip=new`)
- `src/app/globals.css` (tokens only, if needed)

## Requirements (acceptance)
- AC-1: Every R-1 to R-12 behaves the same on the new reader as on the old one,
  checked in desktop Chrome, a phone sized Chrome, and Safari on an iPhone.
- AC-2: Click and key turns finish in 400ms or less; drag follows the pointer
  with no visible lag on a mid range phone.
- AC-3: A 100 page chapter mounts no more than about 10 page images at a time.
- AC-4: With reduce motion on, no flip animation plays.
- AC-5: A spread never shows split across two views on desktop.
- AC-6: tsc, ESLint and the production build pass at every step; the old reader
  stays the default until step 5.

## Out of scope
- Scroll mode.
- Zoom and pinch to zoom.
- Page turn sound.

## Owner answers (2026-10-21)
- Q-1: Clicks, taps and keys use the 3D tilt, like FlipHTML5.
- Q-2: Phones curl the page on swipe (no slide).
