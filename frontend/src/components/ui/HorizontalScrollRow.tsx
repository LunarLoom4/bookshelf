/**
 * Shared HorizontalScrollRow -- a horizontally scrollable row with
 * left/right chevron buttons. Chevron click scrolls exactly 4 card widths.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const SCROLL_CARD_W = 160;   // px -- overlay card width
export const SCROLL_CARD_GAP = 12;  // px -- gap between cards
const CARDS_PER_CLICK = 4;

interface Props {
  children: React.ReactNode;
  itemCount: number;
}

export function HorizontalScrollRow({ children, itemCount }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateArrows); ro.disconnect(); };
  }, [updateArrows, itemCount]);

  const scroll = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    // Scroll exactly 4 cards per click, staying within bounds automatically
    const amount = CARDS_PER_CLICK * (SCROLL_CARD_W + SCROLL_CARD_GAP);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 rounded-full
                    bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600
                    flex items-center justify-center text-ink-700 dark:text-gray-200
                    transition-opacity duration-200
                    ${canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <style>{`[data-hsr-track]::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={trackRef}
        data-hsr-track=""
        className="flex overflow-x-auto pb-1"
        style={{ gap: SCROLL_CARD_GAP, scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>

      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 rounded-full
                    bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600
                    flex items-center justify-center text-ink-700 dark:text-gray-200
                    transition-opacity duration-200
                    ${canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
