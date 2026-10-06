# Admin UUID in RLS policies — handoff note

23 RLS policies hardcode the admin's auth user id (the same value as the
`ADMIN_USER_ID` env var) in `auth.uid() = '<uuid>'`. If the admin account
changes — handoff, or a new Supabase user — every one of these must be
updated together with `ADMIN_USER_ID`, or the new admin's RLS-checked reads and
writes fail silently.

Most admin writes go through the service role (`requireAdmin()` + `supabaseAdmin`),
which bypasses RLS, so a stale UUID mainly breaks the admin's own session reads
(e.g. the realtime NotificationBell, unpublished rows via the SSR client).

Checked against the live DB on 2026-10-04. All are `TO authenticated`.

| Table | Policies |
|-------|----------|
| `chapters` | Admin can read all chapters (SELECT), insert (INSERT), update (UPDATE), delete (DELETE) |
| `pages` | Admin can read all pages (SELECT), insert, update, delete |
| `series` | Admin can read all series (SELECT), insert, update, delete |
| `posts` | Admin can insert / update / delete posts |
| `hero_slides` | Admin can insert / update / delete hero_slides |
| `settings` | Admin can insert / update settings |
| `early_access` | Admin can read / delete early_access |
| `comments` | Admin can delete comments |

## Re-check the list

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || coalesce(with_check, ''))
      ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
order by tablename, policyname;
```

## At handoff

Write a new migration (never edit an applied one) that drops and recreates
each policy above with the new id. Better: replace the literal with a single
`is_admin()` SQL function (or an `admins` table) so the next change is one
line. Then update `ADMIN_USER_ID`, re-dump `supabase/schema.sql`, and test
admin login, publishing and the notification bell.
