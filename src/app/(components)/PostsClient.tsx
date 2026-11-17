"use client";

import { useState } from "react";
import Image from "next/image";
import PostModal from "@/components/reader/PostModal"
import { toast } from "sonner";
import { formatDate } from "@/lib/time";

type Post = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string | null;
  created_at: string | null;
};


type Props = {
  initialPosts: Post[];
  /** null -> no more pages */
  initialCursor: string | null;
  activeType?: string;
};

export default function PostsClient({ initialPosts, initialCursor, activeType }: Props) {
  // no realtime. first page: cached render -> "Load more" -> GET /api/posts
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
        // skip already shown
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

  // Columns follow the screen and the number of posts: one full width column
  // on a phone (the art is the point, so it gets the whole width), then 2, 3
  // and 4 as the screen grows. With one or two posts the grid is capped so a
  // lone image isn't left small in the first of four columns.
  const columnClasses =
    posts.length === 1 ? 'columns-1 max-w-xl'
    : posts.length === 2 ? 'columns-1 sm:columns-2 max-w-4xl'
    : 'columns-1 sm:columns-2 lg:columns-3 2xl:columns-4'

  return (
    <>
      {posts.length === 0 && (
        <div className="max-w-400 mx-auto px-4 sm:px-12 py-24 text-center">
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

      {posts.length > 0 && (
        <div className="max-w-400 mx-auto px-4 sm:px-12 py-6">
          {/* mb-4 on each card, not space-y on the list: a top margin would push down the first card of every column */}
          <div className={`${columnClasses} gap-4`}>
            {posts.map((post, index) => (
              <div
                key={post.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${post.title ?? 'illustration'}`}
                onClick={() => setSelectedPost(post)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPost(post) }
                }}
                className="motion-card motion-rise mb-4 break-inside-avoid rounded-xl overflow-hidden cursor-pointer"
                style={{
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-1)',
                  // cards rise in one after another; the delay repeats every 8 so "Load more" doesn't wait long
                  '--rise-i': index % 8,
                } as React.CSSProperties}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ryu-border-hover)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ryu-border)';
                }}
              >
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

                <div className="p-3.5 flex flex-col gap-2">
                  {post.created_at && (
                    <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--ryu-text-muted)' }}>
                      {formatDate(post.created_at)}
                    </span>
                  )}

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