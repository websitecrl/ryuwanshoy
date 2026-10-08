import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// Caching setup, see https://opennext.js.org/cloudflare/caching
// - incrementalCache (R2): stores the cached pages and query results.
// - queue (Durable Object): runs the background refresh when a page is
//   older than its `revalidate` (60s). Without it, time based refresh doesn't
//   happen in production.
// - tagCache (D1): records revalidatePath/revalidateTag purges from admin
//   writes. Without it those calls do nothing. D1 over the Durable Object tag
//   cache because every cached page view checks it, and the D1 free tier
//   (5M row reads/day) is far roomier than Durable Object requests.
// No regional cache: on Next 16 it still refreshes from R2 on every hit, so
// it adds complexity without cutting R2 reads.
// The D1 `revalidations` table is created by `opennextjs-cloudflare deploy`.
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
	queue: doQueue,
	tagCache: d1NextTagCache,
});
