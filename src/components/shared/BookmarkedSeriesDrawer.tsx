"use client";

import { Bookmark, BookmarkX, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export default function BookmarkedSeriesDrawer({ allSeries }: Props) {
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  function refresh() {
    setBookmarkMap(getBookmarkMap());
  }

  useEffect(() => {
    setMounted(true);
    refresh();

    // Sync when SeriesCard toggles a bookmark on the same page
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const bookmarked = allSeries.filter((s) => bookmarkMap[s.id] === true);
  const count = bookmarked.length;

  // Don't render the count badge until localStorage is read (avoids hydration flash)
  if (!mounted) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                border transition-all duration-200 outline-none
            `}
            style={{
                fontFamily: "'Quicksand', system-ui, sans-serif",
                background: "color-mix(in srgb, var(--ryu-primary) 15%, transparent)",
                borderColor: "var(--ryu-primary)",
                color: "var(--ryu-primary)",
            }}
            >
            <Bookmark
                size={13}
                fill="currentColor"
                strokeWidth={2}
            />
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
        </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[320px] sm:w-[380px] p-0 flex flex-col"
        style={{
          background: "var(--ryu-surface-1)",
          borderColor: "var(--ryu-border)",
        }}
      >
        {/* Header */}
        <SheetHeader
          className="px-5 pt-5 pb-4 border-b"
          style={{ borderColor: "var(--ryu-border)" }}
        >
          <SheetTitle
            className="flex items-center gap-2 text-xl tracking-wide"
            style={{
              fontFamily: "'Bangers', cursive",
              color: "var(--ryu-text)",
            }}
          >
            <Bookmark size={18} style={{ color: "var(--ryu-primary)" }} fill="currentColor" />
            Your Bookmarks
          </SheetTitle>
          <p
            className="text-xs"
            style={{
              color: "var(--ryu-text-muted)",
              fontFamily: "'Quicksand', system-ui, sans-serif",
            }}
          >
            {count === 0 ? "No bookmarks yet" : `${count} series saved`}
          </p>
        </SheetHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {count === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-48 gap-3"
              style={{ color: "var(--ryu-text-muted)" }}
            >
              <BookmarkX size={36} strokeWidth={1.5} />
              <p
                className="text-sm text-center"
                style={{ fontFamily: "'Quicksand', system-ui, sans-serif" }}
              >
                Tap the bookmark icon on any series to save it here.
              </p>
            </div>
          ) : (
            bookmarked.map((s) => (
              <Link
                key={s.id}
                href={`/comics/${s.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl border group transition-colors"
                style={{
                  background: "var(--ryu-surface-2)",
                  borderColor: "var(--ryu-border)",
                }}
              >
                {/* Cover */}
                <div
                  className="relative w-10 h-14 rounded-lg overflow-hidden shrink-0"
                  style={{ background: "var(--ryu-surface-1)" }}
                >
                  {s.cover_image ? (
                    <Image
                      src={s.cover_image}
                      alt={s.title}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ color: "var(--ryu-text-muted)" }}
                    >
                      <Bookmark size={14} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate leading-snug"
                    style={{
                      fontFamily: "'Quicksand', system-ui, sans-serif",
                      color: "var(--ryu-text)",
                    }}
                  >
                    {s.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {s.genre && (
                      <span
                        className="text-[10px] uppercase rounded-full px-2 py-0.5"
                        style={{
                          fontFamily: "'Bangers', cursive",
                          letterSpacing: "0.06em",
                          background: "var(--ryu-surface-1)",
                          color: "var(--ryu-text-secondary)",
                        }}
                      >
                        {s.genre}
                      </span>
                    )}
                    {s.status && (
                      <span
                        className="text-[10px] uppercase rounded-full px-2 py-0.5"
                        style={{
                          fontFamily: "'Bangers', cursive",
                          letterSpacing: "0.06em",
                          background: s.status === "completed"
                            ? "var(--ryu-surface-1)"
                            : "color-mix(in srgb, var(--ryu-primary) 15%, transparent)",
                          color: s.status === "completed"
                            ? "var(--ryu-text-secondary)"
                            : "var(--ryu-primary)",
                        }}
                      >
                        {s.status}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Clear all footer */}
        {count > 0 && (
          <div
            className="px-5 py-4 border-t"
            style={{ borderColor: "var(--ryu-border)" }}
          >
            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                refresh();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition-colors"
              style={{
                fontFamily: "'Quicksand', system-ui, sans-serif",
                borderColor: "var(--ryu-border)",
                color: "var(--ryu-text-muted)",
              }}
            >
              <X size={13} />
              Clear all bookmarks
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}