"use client";

import { useState, useCallback, useEffect } from "react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import HeroBanner from "@/components/admin/reader/HeroBanner";
import ContinueReading from "@/components/admin/reader/ContinueReading";
import LatestReleases from "@/components/admin/reader/LatestReleases";
import SketchbookPreview from "@/components/admin/reader/SketchbookPreview";
import Link from "next/link";
import { SiKofi } from "react-icons/si";

type HeroSlide = {
  id: string;
  headline: string | null;
  banner_image: string | null;
  is_visible: boolean | null;
  order_index: number;
  series: { title: string; slug: string; min_age: number | null } | null;
  chapter: { id: string; chapter_number: number } | null;
};

type Chapter = {
  id: string;
  title: string | null;
  chapter_number: number;
  is_early_access: boolean | null;
  published_at: string | null;
  series: { title: string; slug: string; cover_image: string | null; min_age: number | null } | null;
};

type Post = {
  id: string;
  title: string | null;
  image_url: string;
  post_type: string | null;
  created_at: string | null;
};

type Settings = {
  site_title: string | null;
  creator_name: string | null;
  site_description: string | null;
  logo_url: string | null;
} | null;

type Props = {
  initialHeroSlides: HeroSlide[];
  initialChapters: Chapter[];
  initialPosts: Post[];
  settings: Settings;
};

export default function HomeClient({
  initialHeroSlides,
  initialChapters,
  initialPosts,
  settings,
}: Props) {
  const [heroSlides, setHeroSlides] = useState(initialHeroSlides);
  const [chapters, setChapters] = useState(initialChapters);
  const [posts, setPosts] = useState(initialPosts);
  const [maxAge, setMaxAge] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('ryu-age')
    setMaxAge (stored !== null ? Number(stored) : 18)
  }, [])

  const fetchHeroSlides = useCallback(async () => {
    const res = await fetch("/api/hero-slides");
    if (!res.ok) return;
    const json = await res.json() as { slides: HeroSlide[] };
    setHeroSlides(json.slides ?? []);
  }, []);

  const fetchChapters = useCallback(async () => {
    const res = await fetch("/api/chapters?limit=6");
    if (!res.ok) return;
    const json = await res.json() as { chapters: Chapter[] };
    setChapters(json.chapters ?? []);
  }, []);

  const fetchPosts = useCallback(async () => {
    const res = await fetch("/api/posts?limit=4");
    if (!res.ok) return;
    const json = await res.json() as { posts: Post[] };
    setPosts(json.posts ?? []);
  }, []);

  const handleComicsChange = useCallback(() => {
    void fetchHeroSlides();
    void fetchChapters();
  }, [fetchHeroSlides, fetchChapters]);

  const handlePostsChange = useCallback(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useRealtimeSubscription({
    channelName: "home-comics",
    tables: ["chapters", "series", "hero_slides"],
    onChange: handleComicsChange,
  });

  useRealtimeSubscription({
    channelName: "home-posts",
    tables: ["posts"],
    onChange: handlePostsChange,
  });

  const creatorName = settings?.creator_name ?? "Ryu"
  const siteDescription = settings?.site_description ?? "Original comics and art by a Filipino creator."
  const visibleChapters = maxAge === null ? [] 
    : chapters.filter(ch => {
      const age = ch.series?.min_age ?? 13
      return age <= maxAge
    })

  return (
    <>
    <div
        className="flex flex-col gap-10 pb-16"
        style={{ maxWidth: 1600, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)', width: '100%' }}
    >
        {/* Hero — inside container with rounded corners */}
        <section style={{ paddingTop: 16 }}>
        <HeroBanner
            slides={heroSlides}
            siteName={settings?.site_title ?? 'RyuwanShoy'}
        />
        </section>

        <ContinueReading />
        <LatestReleases chapters={visibleChapters} />
        <SketchbookPreview posts={posts} />

        {/* About section */}
        <section style={{ paddingBottom: 24 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 5, height: 26, background: 'var(--ryu-primary)', borderRadius: 2, flexShrink: 0 }} />
            <span className="font-comic" style={{ fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ryu-text)' }}>
            About {creatorName}
            </span>
        </div>

        <div className="grid gap-5 grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
            {/* Creator card */}
            <div
            className="flex gap-4 items-start"
            style={{
                background: 'var(--ryu-surface-2)',
                border: '0.5px solid var(--ryu-border)',
                borderRadius: 12,
                padding: '20px 22px',
            }}
            >
            <div
                className="font-comic shrink-0 flex items-center justify-center overflow-hidden"
                style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'var(--ryu-primary-soft)',
                    color: 'var(--ryu-primary-deep)',
                    fontSize: 22, letterSpacing: '0.06em',
                }}
                >
                {settings?.logo_url ? (
                    <img src={settings.logo_url} alt={creatorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    creatorName.charAt(0).toUpperCase()
                )}
            </div>
            <div className="min-w-0">
                <h3
                className="font-comic"
                style={{ fontSize: 18, letterSpacing: '0.04em', marginBottom: 3, color: 'var(--ryu-text)' }}
                >
                {creatorName}
                </h3>
                <p className="font-reader" style={{ fontSize: 11, color: 'var(--ryu-text-3)', marginBottom: 8 }}>
                Writer · Artist · Letterer
                </p>
                <p className="font-reader" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ryu-text-2)', margin: 0 }}>
                {siteDescription}
                </p>
            </div>
            </div>

            {/* Support card */}
            <div
            style={{
                border: '0.5px solid var(--ryu-border)',
                borderRadius: 12,
                overflow: 'hidden',
            }}
            >
            <div style={{ background: 'var(--ryu-primary-soft)', padding: '14px 16px' }}>
                <div
                className="font-comic"
                style={{ fontSize: 16, letterSpacing: '0.04em', color: 'var(--ryu-primary-deep)' }}
                >
                Support the work
                </div>
                <p className="font-reader" style={{ fontSize: 11, color: 'var(--ryu-primary-deep)', opacity: 0.8, marginTop: 3 }}>
                Every coffee buys another evening at the drawing board.
                </p>
            </div>
            <div className="flex flex-col gap-3" style={{ padding: '12px 16px 16px' }}>
              <Link
                href="/donate"
                className="font-comic flex items-center justify-center gap-2"
                style={{
                  height: 36, borderRadius: 8,
                  background: '#D4537E', color: '#fff',
                  border: '2.5px solid #1E1E1E',
                  fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase',
                  boxShadow: '4px 4px 0 #1E1E1E',
                }}
              >
                <SiKofi size={14} color="#fff" /> Buy me a Ko-fi
              </Link>
                <Link
                  href="/donate"
                  className="font-comic flex items-center justify-center gap-2"
                  style={{
                    height: 36, borderRadius: 8,
                    background: '#E85B46', color: '#fff',
                    border: '2.5px solid #1E1E1E',
                    fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase',
                    boxShadow: '4px 4px 0 #1E1E1E',
                  }}                 
                >
                  🅿 Become a Patreon
                </Link>
            </div>
            </div>
        </div>
        </section>
      </div>
    </>
  )
}