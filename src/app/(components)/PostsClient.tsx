"use client";

import { useState } from "react";
import Image from "next/image";
import PostModal from "@/components/reader/PostModal"
import { toast } from "sonner";

type Post = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string | null;
  created_at: string | null;
};


function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Props = {
  initialPosts: Post[];
  /** Where "Load more" continues from; null when the first page was all. */
  initialCursor: string | null;
  activeType?: string;
};

export default function PostsClient({ initialPosts, initialCursor, activeType }: Props) {
  // No realtime on purpose (free plan 200 connection cap, refetch burst on
  // every admin save). Post data is cached and admin saves purge it, so a
  // reload shows new posts. See docs/caching.md.
  // The first page (POSTS_PAGE_SIZE) comes from the cached server render;
  // "Load more" appends the next page from GET /api/posts. The parent keys
  // this component by type, so a filter change starts over from props.
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ before: cursor });
      if (activeType) params.set("type", activeType);
      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load more posts.");
      const json = await res.json() as { data: Post[]; nextCursor: string | null };
      setPosts(prev => {
        // Skip anything already shown (e.g. if posts shifted between loads).
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...json.data.filter(p => !seen.has(p.id))];
      });
      setCursor(json.nextCursor);
    } catch {
      toast.error("Couldn't load more illustrations. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      {/* ── Empty state ──────────────────────────────────────────── */}
      {posts.length === 0 && (
        <div className="max-w-400 mx-auto px-12 py-24 text-center">
          <p className="text-sm" style={{ color: 'var(--ryu-text-muted)' }}>
            No illustrations yet.
          </p>
          {activeType && (
            <a
              href="/posts"
              className="mt-3 inline-block text-xs underline"
              style={{ color: 'var(--ryu-primary)' }}
            >
              Clear filter
            </a>
          )}
        </div>
      )}

      {/* ── Masonry grid ─────────────────────────────────────────── */}
      {posts.length > 0 && (
        <div className="max-w-400 mx-auto px-12 py-6">
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {posts.map((post, index) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="break-inside-avoid rounded-xl overflow-hidden transition-all duration-200 cursor-pointer"
                style={{
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-1)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ryu-border-hover)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ryu-border)';
                }}
              >
                {/* Image */}
                <div className="relative w-full" style={{ background: 'var(--ryu-surface-2)' }}>
                  <Image
                    src={post.image_url}
                    alt={post.title ?? "Illustration"}
                    width={600}
                    height={600}
                    className="w-full h-auto block"
                    loading={index === 0 ? "eager" : "lazy"}
                    priority={index === 0}
                  />
                </div>

                {/* Body */}
                <div className="p-3.5 flex flex-col gap-2">
                  {/* Date */}
                  {post.created_at && (
                    <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--ryu-text-muted)' }}>
                      {formatDate(post.created_at)}
                    </span>
                  )}

                  {/* Title */}
                  {post.title && (
                    <p
                      className="text-sm font-semibold leading-snug line-clamp-2"
                      style={{
                        color: 'var(--ryu-text)',
                        fontFamily: "var(--font-fredoka), sans-serif",
                      }}
                    >
                      {post.title}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="flex justify-center pt-8">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-full px-5 py-2 text-xs transition-opacity duration-150 disabled:opacity-50"
                style={{
                  fontFamily: "var(--font-fredoka), sans-serif",
                  fontWeight: 600,
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-1)',
                  color: 'var(--ryu-text)',
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  );
}