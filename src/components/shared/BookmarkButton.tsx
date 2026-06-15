"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ryu.bookmarks.series";  // ← same key as BookmarkedSeriesDrawer

function getBookmarkMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

interface Props {
  seriesId: string;
  className?: string;
}

export default function BookmarkButton({ seriesId, className = "" }: Props) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(getBookmarkMap()[seriesId] === true);
  }, [seriesId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const map = getBookmarkMap();
    const next = !bookmarked;

    if (next) {
      map[seriesId] = true;
    } else {
      delete map[seriesId];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    setBookmarked(next);

    // Notify BookmarkedSeriesDrawer on the same page
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <button
      onClick={toggle}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this series"}
      className={`
        group flex items-center justify-center
        w-9 h-9 rounded-lg
        transition-all duration-200
        ${bookmarked
          ? "bg-[var(--ryu-primary)] text-white shadow-md"
          : "bg-black/40 text-white hover:bg-[var(--ryu-primary)] backdrop-blur-sm"
        }
        ${className}
      `}
    >
      <Bookmark
        size={16}
        className="transition-transform duration-200 group-hover:scale-110"
        fill={bookmarked ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}