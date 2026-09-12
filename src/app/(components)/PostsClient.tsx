"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import PostModal from "@/components/reader/PostModal"
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

type Post = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string | null;
  created_at: string | null;
};

const POST_TYPES = ["sketch", "drawing", "meme", "other"];

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
  activeType?: string;
};

export default function PostsClient({ initialPosts, activeType }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  const fetchPosts = useCallback(async () => {
    const url = activeType ? `/api/posts?type=${activeType}` : "/api/posts";
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json() as { data: Post[] };
    setPosts(json.data ?? []);
  }, [activeType]);

  useRealtimeSubscription({
    channelName: "posts-realtime",
    tables: ["posts"],
    onChange: fetchPosts,
  });

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
        </div>
      )}

      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  );
}