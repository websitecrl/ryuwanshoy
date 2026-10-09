# Review, feat/crash-report-feedback, 2026-10-09

**Reviewed by**: Sonnet 5.5 (author on Opus 5.5)
**Scope**: 23 files, branch vs origin/main
**Verdict**: Changes requested

## Summary
Adds reader crash reports (error.tsx, new global-error.tsx), a public /feedback form, a service-role-only `POST /api/feedback`, an admin inbox, and a bell unread count with Realtime. The security model is sound: no anon grants, an admin-only SELECT policy, a rate limit, length limits mirrored in the DB, and React-escaped rendering. The headline issue is that the "same-site path only" check is bypassable, so an attacker can plant an external link in the admin inbox. There is no test runner (none-yet); the admin flows and Realtime were never exercised, so the points below rest on code reading.

## Major
### 🟠 Same-site path check is bypassable, external link rendered in admin inbox, `src/app/api/feedback/route.ts:80` (also `src/app/feedback/FeedbackForm.tsx:349`)
**Problem**: `page.startsWith('/') && !page.startsWith('//')` accepts `/\t/evil.com` (tab or newline after the first slash) and `/\evil.com`. `cleanText` only trims the ends. The URL parser strips tab and newline, so `new URL('/\t/evil.com', base)` resolves to `https://evil.com/` (verified in node). The stored value is then rendered by the admin page as `<a href={item.page_url} target="_blank">` at `src/app/admin/feedback/page.tsx:129`. The same weak check is in the form's `sourcePage()` (`?from=` is attacker-controllable via a crafted link).
**Why it matters**: Anyone can plant an external link, shown as a "page the reader was on", in the admin's inbox. The admin is the one privileged user, so this is a phishing or credential-harvesting vector. `rel=noopener` limits tab-nabbing but not the click itself. It also contradicts the code comment and the "never a full URL" claim. The author's test of "external pageUrl dropped" only covered `https://...`.
**Suggested fix**: Validate server-side with a strict allowlist, for example `/^\/(?![\/\\])[^\s\\]*$/` (no whitespace or control characters, no backslash, no second slash), or parse with `new URL(p, 'https://x.invalid')` and require the origin to be unchanged and `href` to equal the input. Apply the same helper in `sourcePage()`. In the admin page, render page_url as plain text, or build the link from the site's own origin. Do not use the raw value as an `href`.

### 🟠 Reports beyond the newest 100 are invisible, and "Mark all read" silently clears them, `src/app/api/feedback/route.ts:11,144` / `src/app/admin/feedback/page.tsx:20-22`
**Problem**: GET returns only the newest 100 rows with no pagination, but `PATCH /api/feedback` marks every unread row read. The endpoint is public, unauthenticated, and has no CAPTCHA. The rate limit is 3 per minute per IP, and the table has no cap or retention.
**Why it matters**: A trivial rotating-IP spammer, or just volume, pushes real reports off the list. The admin never sees them, and one "Mark all read" click flips them to read. Deleting spam is one row at a time. This quietly defeats the feature's purpose (AC-6).
**Suggested fix**: Add paging or "Load older". At minimum make "Mark all read" apply only to the ids shown, or show a "N older reports not shown" notice. Consider a bulk delete (for example delete read rows older than X days), or a cheap abuse control such as a max message length for crash rows or a honeypot field.

## Minor
### 🟡 Admin page does not follow Realtime, count can drift from the bell, `src/app/admin/feedback/page.tsx:43`
The bell subscribes to the feedback table, but the inbox loads once. New reports do not appear and `unread` goes stale. Local `setUnread(±1)` also assumes the row's server state matched the client's. Refetch on a Realtime event, or on window focus, or re-sync after each action by using the count returned by the API.

### 🟡 `mailto:` built from a loosely validated email, `src/app/admin/feedback/page.tsx:170`, `src/lib/feedback.ts:230`
`EMAIL_RE` allows `,`, `?`, `&`, `%` and `;`. A value like `a@b.co?bcc=x@y.z` or `a@b.co,c@d.ee` becomes a mailto with injected headers or extra recipients, so the admin's reply could go to more people. It is escaped as text and is not XSS. Tighten the regex (no `,;?&%<>"'`), or `encodeURIComponent` the address in the href.

### 🟡 Crash flow privacy copy overstates, `src/components/shared/CrashReport.tsx:114,35`
It says "No personal data", but it sends `location.search` (which can carry arbitrary query values) and `error.message` (client-side errors can embed user content). It also stores the UA. Either drop the query string or soften the copy. The stated no-IP-stored claim is accurate.

### 🟡 `error_message` and `message` fields accept unfiltered text for crash rows, `src/app/api/feedback/route.ts:89`
`error_message` and `error_digest` are not run through the profanity filter. They are escaped on render, so this is only an abuse or spam surface. Combined with the 100-row cap above, it is a cheap way to bury real rows. Gate the crash fields more tightly: require an `error_digest` shape, or truncate to 300 characters.

### 🟡 Radiogroup semantics are incomplete, `src/app/feedback/FeedbackForm.tsx:415-439`
A `<fieldset>` plus `role="radiogroup"` with button `role="radio"`: all three are tab stops, with no roving tabindex or arrow-key handling, and the radiogroup has no `aria-labelledby` (the legend is on the fieldset). A native `<input type="radio">` group or `aria-labelledby` plus arrow keys would fix it. Labels, `aria-invalid` and `aria-describedby` on the email field are good.

### 🟡 global-error does not carry the theme, `src/app/global-error.tsx:169`
It renders `<html lang="en">` without the theme class or attribute that the root layout sets. Dark-mode readers get a light error screen, or the wrong tokens, depending on how the theme is applied. It is a last-resort screen, so this is acceptable. Please confirm the `--background` and `--ryu-*` tokens resolve with no `.dark` class (they do in `:root`, but not the dark set).

### 🟡 Three new surfaces are untested in the live app (AC-6, AC-7)
The admin inbox actions, the bell count and Realtime delivery, and the pages themselves (AgeGate blocks SSR) were not exercised. The Realtime path depends on the `authenticated` SELECT grant and the policy uid. Run `/check verify` on these before relying on them.

## Nits
- ⚪ `src/components/shared/Footer.tsx:84`, the Feedback `<Link>` prefetches a distinct `?from=` URL per page. Use `prefetch={false}` (the page is static).
- ⚪ `src/app/feedback/FeedbackForm.tsx:382,391`, success shows both a toast and the thank-you panel. One is enough.
- ⚪ `src/lib/time.ts:2`, `HAS_ZONE` does not match a bare `+00` offset (Postgres text format). Not what PostgREST returns (`+00:00`), so this is fine today. The date-only string `2026-10-09` still yields '' as before.
- ⚪ `src/app/api/feedback/route.ts:88`, the UA comes from a client-controlled header and is not authoritative. The spec wording "from request header, not body" is fine, but admin copy should not imply it is trustworthy.
- ⚪ `src/app/api/feedback/route.ts:103`, GET relies on `requireAdmin` using cookies for dynamism. The notifications route sets `force-dynamic` explicitly. Be consistent.
- ⚪ `src/lib/feedback.ts:241`, `FeedbackPayload.userAgent` is declared but never sent or read. Remove it, or it suggests the UA is trusted from the body.

## Strengths
- Strong data-access model: both migrations are idempotent and minimal. anon has no access, `authenticated` has SELECT only, filtered to the admin uid, and `service_role` has exactly the four grants the routes use. DB CHECK limits mirror the API limits (UTF-16 `slice` is always within `char_length`), and `src/lib/feedback.ts` is shared between the form, the crash box and the API.
- API validation order is right: the rate limit runs first, then JSON parsing, kind, message type, length, profanity and email. The UUID regex guards the `[id]` routes, and every admin route calls `requireAdmin()`. Admin PATCH and DELETE cannot be CSRF'd cross-site (non-simple methods).
- All admin-rendered text (message, error_message, user_agent) goes through React escaping. Design tokens in the new files are all defined (removed uses of `--ryu-bg`, `--ryu-text-muted` and `--ryu-text-secondary` were not reintroduced).
- Good rule keeping: opening the bell does not touch feedback (`handleOpen` only calls the comment `markAllRead`, and the notifications POST only touches `comments`). The unread count is a separate `head` count query, parallelised, and the notifications route now logs query errors.
- global-error.tsx follows the Next requirements (client component, own html and body, imports globals.css, no layout dependencies), and the status is inline instead of a toast because the Toaster is not mounted there. `timeAgo` handles `+00:00` and `Z`.

## Test coverage
No test runner (none-yet), which is why the points above rest on code reading and the author's live-DB script. The author's 21 live checks cover the public API well but skip admin flows, the bell, Realtime and any browser rendering. The bypass in the first Major finding would be caught by a test with a tab-prefixed path.

## Author follow-up (same branch)
- Fixed (major): one strict same-site check, `isSafeSitePath` in `src/lib/feedback.ts` (pattern: no whitespace, control characters or backslash, no second slash; plus a URL parse that must keep the origin). Used by the form (`?from=`), the API and the admin page, which also renders a non-matching value as text only. Verified: `/\t/evil.com`, `/\n/evil.com`, `/\evil.com` rejected in a 24-case unit check, and stored as null on the live DB.
- Fixed (major): inbox paging (50 per page, "Load older", "Showing X of Y"); `PATCH /api/feedback` now takes `{ ids }` and the button is "Mark shown as read", so unseen reports are never marked read.
- Fixed (minors): stricter email (no `, ; ? & % < > " ' ( ) \`), reply link only for a valid email; crash report sends the path only (no query string) and the copy no longer says "No personal data"; `error_digest` must match `[\w-]{1,100}`; native radio inputs in the form; every admin action returns the server's unread count (no local math); global-error runs the theme script (dark mode).
- Fixed (nits): footer Feedback link `prefetch={false}`; single success confirmation in the form; `FeedbackPayload.userAgent` removed and the UA is labelled "as reported" in the inbox; `force-dynamic` on the feedback route; shared `countUnreadFeedback` in `src/lib/feedback-server.ts`.
- Not changed: inbox Realtime (the bell already updates live; the inbox count re-syncs on every action and on reload); a bare `+00` offset in `timeAgo` (PostgREST never returns it).
- Re-verified against the live DB through `next dev`: 24/24 checks (4 new: tab path, backslash path, mailto injection email, PATCH `{ids}` admin only), stored rows inspected, test rows deleted. Admin login flows and browser rendering still untested.
