-- Final step of "no email in feedback" (spec 0001 change note, 2026-10-09).
--
-- ⚠ Run ONLY AFTER the feat/feedback-device code is deployed
--   (`npm run deploy` after merging). Check first: the live form shows
--   "Where did it happen?" and no email field. Running it earlier breaks
--   every feedback/crash submission again (see 20261009150000).
--
-- Drops the temporary `email` column re-added by 20261009150000. Any email
-- the old live form stored in between is erased (owner decision: no emails).
--
-- HOW TO APPLY:
--   npx supabase db query --linked -f supabase/migrations/20261009160000_feedback_drop_email_final.sql
-- Types already have no `email` (generated after 20261009140000). Idempotent.

alter table public.feedback drop column if exists email;
