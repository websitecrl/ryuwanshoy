-- Reader feedback and crash reports (spec 0001).
--
-- Rows are written ONLY by POST /api/feedback with the service role client
-- (rate limited, validated, profanity filtered). anon gets no access at all,
-- so readers can't read each other's reports (they may contain an email) or
-- insert around the API's checks.
--
-- The admin reads through /api/feedback (service role) and the notification
-- bell subscribes to new rows over Realtime in the admin session, which needs
-- SELECT for `authenticated` plus an admin-only RLS policy (same admin uid as
-- every other "Admin can ..." policy in this schema).
--
-- HOW TO APPLY: do NOT use `supabase db push` (see 20261004120000). Run:
--   npx supabase db query --linked -f supabase/migrations/20261009120000_create_feedback.sql
-- then regenerate types:
--   npx supabase gen types typescript --linked > src/types/database.ts
--
-- Idempotent: safe to run twice.

create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  -- 'crash' comes from the error screen; the rest from the feedback form.
  kind          text not null check (kind in ('bug', 'idea', 'other', 'crash')),
  -- Required for bug/idea/other (enforced by the API); optional note on a crash.
  message       text not null default '' check (char_length(message) <= 1000),
  -- Optional, only when the reader wants a reply.
  email         text check (email is null or char_length(email) <= 254),
  -- Context, filled automatically (crash) or from the current page (form).
  page_url      text check (page_url is null or char_length(page_url) <= 500),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 500),
  -- Crash only: the error the reader saw, and Next's server error digest.
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  error_digest  text check (error_digest is null or char_length(error_digest) <= 100),
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Admin list (newest first) and the bell's unread count.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
create index if not exists feedback_unread_idx
  on public.feedback (created_at desc)
  where is_read = false;

alter table public.feedback enable row level security;

-- No anon access of any kind; the API uses the service role.
revoke all on public.feedback from anon;
-- The admin session only needs to SELECT (for Realtime); writes go via the API.
revoke all on public.feedback from authenticated;
grant select on public.feedback to authenticated;

drop policy if exists "Admin can read feedback" on public.feedback;
create policy "Admin can read feedback" on public.feedback
  for select to authenticated
  using ((select auth.uid()) = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::uuid);

-- Live updates for the admin notification bell.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table public.feedback;
  end if;
end $$;
