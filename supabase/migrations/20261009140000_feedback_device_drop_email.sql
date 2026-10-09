-- Feedback: ask which device instead of an email (owner decision, 2026-10-09).
--
-- Why: a reply by email rarely helps (if the reader can't describe the bug in
-- the form, a back-and-forth won't either, and one-off bugs can't be
-- reproduced later), and dropping it means no personal data in this table.
-- The reader now says where the problem happened instead.
--
-- device: 'web' (computer browser), 'phone', or 'both' (noticed on both).
-- Required for form feedback (enforced by POST /api/feedback); NULL for
-- crash reports, where the reader isn't asked (user_agent still shows it).
--
-- email: dropped. Owner approved permanently erasing the 1 saved address
-- (a test report); the 2 existing reports themselves are kept.
--
-- Grants are table-level (20261009120000, 20261009130000), so the new column
-- is covered: service_role full, authenticated SELECT (admin via RLS), anon none.
--
-- HOW TO APPLY (not `db push`):
--   npx supabase db query --linked -f supabase/migrations/20261009140000_feedback_device_drop_email.sql
-- then: npx supabase gen types typescript --linked --schema public > src/types/database.ts
-- Idempotent.

alter table public.feedback
  add column if not exists device text
  check (device is null or device in ('web', 'phone', 'both'));

alter table public.feedback
  drop column if exists email;
