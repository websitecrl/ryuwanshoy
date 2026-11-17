-- renumber_pages(chapter, ordered page ids): renumber a chapter's pages in ONE call.
--
-- Why: the reorder route and the renumber after a page delete sent one UPDATE
-- per page. On Cloudflare Workers every Supabase call is a subrequest and the
-- free plan allows 50 per request, so a chapter with ~45+ pages failed
-- halfway and was left half renumbered (each UPDATE was its own transaction).
-- A function body runs in a single transaction: every page gets its new
-- number or none does, and the cost is 1 subrequest for any chapter size.
--
-- Result: the chapter's pages are numbered 1..N with no gaps or duplicates.
--   - pages listed in p_page_ids come first, in the order given
--   - pages of the chapter that are NOT listed keep their current order and
--     follow the listed ones (a page uploaded from another tab is never left
--     with a duplicate number)
--   - an empty array therefore just closes the gaps (used after a page delete)
--
-- Validation: every listed id must be a page of p_chapter_id, listed once.
-- A page of another chapter, an unknown id, a duplicate or a NULL raises
-- SQLSTATE 22023 and nothing is changed.
--
-- Access: service role only. The admin API routes call it with
-- supabaseAdmin.rpc(); anon and authenticated cannot execute it.
--
-- HOW TO APPLY: do NOT use `supabase db push`. Run this file on its own, in
-- the Supabase SQL editor or with:
--   npx supabase db query --linked -f supabase/migrations/20261117120000_renumber_pages_fn.sql
-- Apply it BEFORE deploying the code that calls it (the routes get a
-- "function not found" error until it exists). Safe to re-run.
-- Then regenerate the types:
--   npx supabase gen types typescript --linked --schema public > src/types/database.ts

begin;

create or replace function public.renumber_pages(p_chapter_id uuid, p_page_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_listed  integer := coalesce(cardinality(p_page_ids), 0);
  v_matched integer;
begin
  if p_chapter_id is null then
    raise exception 'renumber_pages: chapter id is required'
      using errcode = '22023';
  end if;

  -- Lock the chapter's pages first, always in id order. Two renumbers of the
  -- same chapter (two quick drags) then run one after the other instead of
  -- interleaving, and the fixed order means they cannot deadlock.
  perform 1
     from public.pages
    where chapter_id = p_chapter_id
    order by id
      for update;

  -- Each listed id must match exactly one page of this chapter. A page of
  -- another chapter, an unknown id, a duplicate or a NULL all leave
  -- v_matched below v_listed.
  select count(*)
    into v_matched
    from public.pages
   where chapter_id = p_chapter_id
     and id = any (p_page_ids);

  if v_matched <> v_listed then
    raise exception 'renumber_pages: % of the % page ids are not distinct pages of chapter %',
      v_listed - v_matched, v_listed, p_chapter_id
      using errcode = '22023';
  end if;

  -- One statement numbers the whole chapter: listed pages by their position
  -- in the array, then the unlisted ones (ord is NULL) by their current
  -- number. Rows that already hold the right number are not rewritten.
  update public.pages p
     set page_number = n.new_number
    from (
      select pg.id,
             (row_number() over (order by o.ord nulls last, pg.page_number, pg.id))::integer as new_number
        from public.pages pg
        left join unnest(p_page_ids) with ordinality as o(id, ord) on o.id = pg.id
       where pg.chapter_id = p_chapter_id
    ) n
   where p.id = n.id
     and p.page_number is distinct from n.new_number;
end;
$$;

comment on function public.renumber_pages(uuid, uuid[]) is
  'Renumbers a chapter''s pages 1..N in one transaction: listed ids first, in array order; unlisted pages keep their order after them. Raises 22023 if a listed id is not a distinct page of the chapter.';

-- Functions are executable by PUBLIC by default, and Supabase also grants
-- them to anon and authenticated. Only the service role may call this one.
revoke all on function public.renumber_pages(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.renumber_pages(uuid, uuid[]) to service_role;

commit;

-- PostgREST caches the schema; tell it about the new function right away.
notify pgrst, 'reload schema';
