"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Database } from "@/types/database";
import { getBookmarkMap } from "@/lib/bookmarks";
import { useMaxAge } from "@/hooks/useSavedAge";
import { fitsAge } from "@/lib/age";

type Series = Database["public"]["Tables"]["series"]["Row"];

interface Props {
  allSeries: Series[];
  className?: string;
}

export default function BookmarksNavLink({ allSeries, className = "" }: Props) {
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const maxAge = useMaxAge();

  useEffect(() => {
    setMounted(true);
    setBookmarkMap(getBookmarkMap());

    function refresh() {
      setBookmarkMap(getBookmarkMap());
    }
    // same-page bookmark toggles
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  // same rule as /bookmarks
  const count = allSeries.filter((s) => bookmarkMap[s.id] === true && fitsAge(s.min_age, maxAge)).length;

  // no badge until localStorage is read
  if (!mounted) return null;

  return (
    <Link
      href="/bookmarks"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 outline-none ${className}`}
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
