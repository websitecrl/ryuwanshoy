-- HOTFIX: temporarily restore an EMPTY `feedback.email` column.
--
-- 20261009140000 dropped `email` before the code that stops writing it was
-- deployed. The live code (deployed 2026-10-09 09:42 UTC) still sends
-- `email: <value or null>` on every insert, so PostgREST rejected every
-- feedback and crash report with a 500 ("Could not send"). Checked live.
--
-- This re-adds the column (nullable, no data: the erased test address does
-- NOT come back) so the live code works again right away. The new code
-- (feat/feedback-device) never reads or writes it.
--
-- Drop it again with 20261009160000_feedback_drop_email_final.sql ONLY AFTER
-- the feat/feedback-device code is deployed. Until then, the old live form
-- may store an email if a reader types one.
--
-- HOW TO APPLY:
--   npx supabase db query --linked -f supabase/migrations/20261009150000_feedback_email_compat.sql
-- Types are NOT regenerated for this temporary column (the new code must not
-- use it). Idempotent.

alter table public.feedback
  add column if not exists email text
  check (email is null or char_length(email) <= 254);
