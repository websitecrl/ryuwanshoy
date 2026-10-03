-- Rewrite stored public R2 image URLs from the r2.dev origin to the custom
-- domain img.ryuwanshoy.com.
--
-- Same bucket, same object keys — only the public origin changes, so this is
-- a prefix swap. The "?v=..." cache-busting suffix is kept as-is.
--
-- Run ONLY after:
--   1. img.ryuwanshoy.com is connected to the public bucket (R2 → bucket →
--      Settings → Custom Domains) and an existing object loads over it, and
--   2. the Worker that allows img.ryuwanshoy.com in CSP img-src is deployed.
-- Running earlier points every image at a host that either doesn't serve
-- the bucket yet or is blocked by the CSP.
--
-- Untouched by design:
--   - pages.image_url values starting with "ea:" (private Early Access keys,
--     not URLs — the LIKE filter below never matches them)
--   - any non-R2 URL (e.g. leftover Cloudinary links)
--
-- Idempotent: rows already on the new origin don't match the WHERE clause.
-- No schema change, so src/types/database.ts does not need regenerating.

UPDATE public.pages
SET    image_url = 'https://img.ryuwanshoy.com/' || substr(image_url, length('https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/') + 1)
WHERE  image_url LIKE 'https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/%';

UPDATE public.posts
SET    image_url = 'https://img.ryuwanshoy.com/' || substr(image_url, length('https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/') + 1)
WHERE  image_url LIKE 'https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/%';

UPDATE public.series
SET    cover_image = 'https://img.ryuwanshoy.com/' || substr(cover_image, length('https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/') + 1)
WHERE  cover_image LIKE 'https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/%';

UPDATE public.series
SET    banner_image = 'https://img.ryuwanshoy.com/' || substr(banner_image, length('https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/') + 1)
WHERE  banner_image LIKE 'https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/%';

UPDATE public.hero_slides
SET    banner_image = 'https://img.ryuwanshoy.com/' || substr(banner_image, length('https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/') + 1)
WHERE  banner_image LIKE 'https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/%';

UPDATE public.settings
SET    logo_url = 'https://img.ryuwanshoy.com/' || substr(logo_url, length('https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/') + 1)
WHERE  logo_url LIKE 'https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev/%';
