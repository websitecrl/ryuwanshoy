# 0001 · Crash reports and reader feedback

**Status**: Assumed
**Date**: 2026-10-09
**Authorized by**: project owner, in chat during /develop ("go with your recommendations")

## Owed decision
How readers report crashes and send feedback after Sentry was removed (browser
errors are otherwise invisible), where reports are stored, and how the admin
sees them.

## Assumption built on
- **Reader triggered only.** Nothing is sent automatically. The error screens
  (`src/app/error.tsx`, new `src/app/global-error.tsx`) offer a "Send report"
  button that sends: page URL, error message, Next's error digest, user agent,
  and an optional note.
- **Feedback form** at `/feedback`, linked from the public footer: type
  (Bug / Idea / Other), message (1 to 1000 characters), optional email (only
  for a reply, with a notice saying so).
- **Storage:** new Supabase table `feedback`
  (`supabase/migrations/20261009120000_create_feedback.sql`). Written only by
  `POST /api/feedback` with the service role client. No anon access. Admin can
  SELECT (RLS, admin uid) so the notification bell gets Realtime events.
- **Abuse protection:** Workers rate limit binding `FEEDBACK_LIMITER`
  (3 per 60 s per IP), length limits in the API and in the table, the existing
  profanity filter on the message.
- **Admin:** `/admin/feedback` lists reports newest first, marks them read,
  deletes them. The notification bell shows the unread feedback count and
  links to that page.
- **Privacy:** no IP stored; email optional; reports are only visible to the
  admin.
- **Change, 2026-10-09 (owner decision): no email, ask the device instead.**
  A reply by email rarely helps (if the reader can't describe the bug in the
  form, a back and forth won't either, and one-off bugs can't be reproduced
  later), and it was personal data in the database. The form now asks
  "Where did it happen?" with two checkboxes, Web (computer) and Phone, at
  least one required for every form kind, both allowed (stored as
  `device` = 'web' | 'phone' | 'both'; NULL for crash reports, where the
  reader isn't asked). The `email` column was dropped
  (`20261009140000_feedback_device_drop_email.sql`, owner approved erasing the
  1 saved test address). This replaces the email parts of the bullets above
  and AC-3, which now reads: "A form submission without a device is
  rejected; Web, Phone and both are accepted."

## Code area
- `supabase/migrations/20261009120000_create_feedback.sql`, `src/types/database.ts` (regenerated)
- `src/app/api/feedback/route.ts`, `src/app/api/feedback/[id]/route.ts`
- `src/app/error.tsx`, `src/app/global-error.tsx`, `src/components/shared/CrashReport.tsx`
- `src/app/feedback/page.tsx`, the public footer
- `src/app/admin/feedback/page.tsx`, admin sidebar, `src/components/admin/NotificationBell.tsx`
- `wrangler.jsonc` (`FEEDBACK_LIMITER`), `cloudflare-env.d.ts`

## Requirements
- AC-1: On the error screen, "Send report" stores one `crash` row and confirms it to the reader.
- AC-2: The feedback form stores one row of the chosen type; empty or over-length messages are rejected with a clear message.
- AC-3: An invalid email is rejected; an empty email is allowed.
- AC-4: More than 3 submissions in 60 s from one IP get a "too many" response.
- AC-5: Readers cannot read or list feedback (`GET /api/feedback` is admin only; no anon table access).
- AC-6: `/admin/feedback` lists reports newest first; the admin can mark read and delete.
- AC-7: The notification bell shows the unread feedback count and updates when a new report arrives.

## Ratify
This decision was recorded by /develop, not deliberated. Run `/architect crash
report and feedback` to deliberate and ratify it. Until then it stays flagged
as an owed decision; it does not block marking the feature `done`.
