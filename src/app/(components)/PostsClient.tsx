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

  return (
    <>
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