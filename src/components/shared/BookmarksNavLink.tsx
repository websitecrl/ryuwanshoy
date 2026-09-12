"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Database } from "@/types/database";

type Series = Database["public"]["Tables"]["series"]["Row"];

const STORAGE_KEY = "ryu.bookmarks.series";

function getBookmarkMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

interface Props {
  allSeries: Series[];
}

export default function BookmarksNavLink({ allSeries }: Props) {
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setBookmarkMap(getBookmarkMap());

    function refresh() {
      setBookmarkMap(getBookmarkMap());
    }
    // Sync when a SeriesCard on the same page toggles a bookmark
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const count = allSeries.filter((s) => bookmarkMap[s.id] === true).length;

  // Don't render the count badge until localStorage is read (avoids hydration flash)
  if (!mounted) return null;

  return (
    <Link
      href="/bookmarks"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 outline-none"
      style={{
        fontFamily: "'Quicksand', system-ui, sans-serif",
        background: "color-mix(in srgb, var(--ryu-primary) 15%, transparent)",
        borderColor: "var(--ryu-primary)",
        color: "var(--ryu-primary)",
      }}
    >
      <Bookmark size={13} fill="currentColor" strokeWidth={2} />
      Bookmarks
      {count > 0 && (
        <span
          className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
          style={{
            background: "var(--ryu-primary)",
            color: "#fff",
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
