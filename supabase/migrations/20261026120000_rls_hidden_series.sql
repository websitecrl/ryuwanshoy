-- anon reads -> only published, non-draft chapters of a published series (same rule as the reader pages)
-- admin policies and the service role are unaffected
begin;

drop policy if exists "anon can read published chapters" on public.chapters;
create policy "anon can read published chapters" on public.chapters
  for select to anon
  using (
    is_published = true
    and is_draft = false
    and exists (
      select 1 from public.series s
      where s.id = chapters.series_id and s.is_published = true
    )
  );

drop policy if exists "anon can read pages" on public.pages;
create policy "anon can read pages" on public.pages
  for select to anon
  using (
    exists (
      select 1
      from public.chapters c
      join public.series s on s.id = c.series_id
      where c.id = pages.chapter_id
        and c.is_published = true
        and c.is_draft = false
        and s.is_published = true
    )
  );

commit;
