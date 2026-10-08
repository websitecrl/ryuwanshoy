-- Plan.md item 3: indexes for the queries that currently scan whole tables.
--
-- Each index matches a real query (filter columns first, then the ORDER BY
-- column), so Postgres can find the rows AND return them already sorted.
-- Indexes only add speed; they change no data, columns or RLS, so
-- src/types/database.ts does not need regenerating.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Plain CREATE INDEX (not CONCURRENTLY): the Supabase SQL editor runs the
-- script as one transaction, where CONCURRENTLY is not allowed, and these
-- tables are small enough that the brief write lock is unnoticeable.
--
-- Before running, check for an equivalent index added by hand in the
-- dashboard (IF NOT EXISTS only matches by name):
--   select tablename, indexname, indexdef from pg_indexes
--   where schemaname = 'public' and tablename in ('pages','comments','chapters')
--   order by tablename, indexname;

-- ─── pages ──────────────────────────────────────────────────────────────────
-- Reader: .eq('chapter_id').order('page_number'); series page pages(count);
-- the anon RLS EXISTS check on pages; renumbering after a page delete; and
-- the ON DELETE CASCADE from chapters.
create index if not exists pages_chapter_id_page_number_idx
  on public.pages (chapter_id, page_number);

-- ─── comments ───────────────────────────────────────────────────────────────
-- GET /api/comments filters by exactly one of series_id / post_id /
-- chapter_id and orders by created_at. Partial (WHERE ... IS NOT NULL)
-- because each comment belongs to only one of them, so each index stays small.
-- They also serve the ON DELETE CASCADE from series / posts / chapters.
create index if not exists comments_series_id_created_at_idx
  on public.comments (series_id, created_at)
  where series_id is not null;

create index if not exists comments_post_id_created_at_idx
  on public.comments (post_id, created_at)
  where post_id is not null;

create index if not exists comments_chapter_id_created_at_idx
  on public.comments (chapter_id, created_at)
  where chapter_id is not null;

-- Replies: ON DELETE CASCADE on parent_id must find a comment's replies.
create index if not exists comments_parent_id_idx
  on public.comments (parent_id)
  where parent_id is not null;

-- Admin notification bell: latest 15 comments, newest first.
create index if not exists comments_created_at_idx
  on public.comments (created_at desc);

-- ─── chapters ───────────────────────────────────────────────────────────────
-- Home "latest releases": published, non-draft chapters, newest first.
-- Partial so it only holds the rows that query can return.
create index if not exists chapters_latest_published_idx
  on public.chapters (published_at desc)
  where is_published = true and is_draft = false;

-- Refresh planner statistics so the new indexes are used right away.
analyze public.pages;
analyze public.comments;
analyze public.chapters;
