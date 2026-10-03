-- Turn Postgres Changes (Realtime) back on for every table the app listens to.
--
-- Checked against the live DB on 2026-10-04:
--   - supabase_realtime published only public.pages, which nothing subscribes
--     to. series, chapters, hero_slides, posts (HomeClient, PostsClient,
--     admin Sidebar) and comments, likes (admin NotificationBell) got no events.
--   - comments and likes had no SELECT for anon/authenticated. Realtime checks
--     each change against the subscriber's own privileges + RLS, so even once
--     published, the admin bell would still receive nothing.
--
-- comments/likes: SELECT is granted to authenticated only (the bell runs in
-- the admin session; public reads go through supabaseAdmin in /api/comments
-- and /api/likes). The grant is per column and leaves out the secrets:
--   - comments.edit_token  (lets the holder edit/delete the comment)
--   - comments.ip_hash
--   - likes.like_token     (lets the holder unlike)
-- Realtime drops columns the subscriber can't SELECT, so these never appear in
-- an event payload. anon gets no read access to either table.
--
-- Unchanged: series/chapters/hero_slides/posts already have anon SELECT and
-- RLS, so anon only gets events for published rows; drafts don't leak.
--
-- HOW TO APPLY: do NOT use `supabase db push`. No migration is recorded as
-- applied on the remote yet, so push would also run
-- 20261003130000_rewrite_r2_public_urls.sql, which must wait for the custom
-- domain. Run this file on its own:
--   npx supabase db query --linked -f supabase/migrations/20261004120000_enable_realtime.sql
--
-- Idempotent: tables already in the publication are skipped; GRANT is a no-op
-- when the privilege already exists.
-- No column changes, so src/types/database.ts does not need regenerating.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['series', 'chapters', 'hero_slides', 'posts', 'comments', 'likes']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

GRANT SELECT (id, chapter_id, series_id, post_id, parent_id, name, content, is_read, created_at, updated_at)
  ON TABLE public.comments TO authenticated;

GRANT SELECT (id, post_id, created_at)
  ON TABLE public.likes TO authenticated;
