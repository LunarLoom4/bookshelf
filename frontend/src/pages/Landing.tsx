import { usePostLoginToast } from "@/hooks/usePostLoginToast";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useCallback, useEffect } from "react";
import { booksApi } from "@/api";
import { BookCard } from "@/components/ui/BookCard";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { BookOpen, MessageSquare, Layers, Download, Bookmark, List, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

// ── Horizontal scroll row (same as UserProfile) ───────────────────────────────
const BOOK_CARD_W = 200;
const BOOK_CARD_GAP = 20;

function HorizontalScrollRow({ children, itemCount }: { children: React.ReactNode; itemCount: number }) {
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
    const amount = Math.max(el.clientWidth - (BOOK_CARD_W + BOOK_CARD_GAP), BOOK_CARD_W + BOOK_CARD_GAP);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10
                   w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600
                   flex items-center justify-center text-ink-700 dark:text-gray-200
                   transition-opacity duration-200
                   ${canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <style>{`[data-hsr-landing]::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={trackRef}
        data-hsr-landing=""
        className="flex overflow-x-auto pb-1"
        style={{ gap: BOOK_CARD_GAP, scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10
                   w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600
                   flex items-center justify-center text-ink-700 dark:text-gray-200
                   transition-opacity duration-200
                   ${canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Landing() {
  usePostLoginToast();
  const { isAuthenticated } = useAuthStore();
  const { data: popularBooks = [] } = useQuery({
    queryKey: ["books", "popular"],
    queryFn: () => booksApi.popular(7, 6).then((r) => r.data),
    staleTime: 10 * 60 * 1000, // 10 min -- popular list changes slowly
  });

  return (
    <div>
      {/* Hero */}
      <section className="bg-ink-950 text-white py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-ink-400 text-xs font-mono tracking-widest uppercase mb-5">
            Read · Discuss · Share
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl font-semibold leading-tight mb-6">
            Books live longer when readers talk back.
          </h1>
          <p className="text-ink-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            A home for PDFs worth reading twice. Upload a book, read it in your browser,
            and leave comments pinned to specific pages, so the conversation stays
            exactly where it belongs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/browse"
              className="btn-primary bg-amber-500 hover:bg-amber-600 text-ink-950 font-semibold px-7 py-3 text-base"
            >
              Browse Books
            </Link>
            <Link
              to={isAuthenticated ? "/upload" : "/register?next=/upload"}
              className="inline-flex items-center gap-2 px-7 py-3 text-base font-semibold border-2 border-white text-white rounded-md hover:bg-white/20 hover:border-white transition-colors duration-150"
            >
              Upload a Book
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-paper-100 landing-section-alt">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-2xl font-semibold text-ink-900 text-center mb-12">
            Key Features
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: BookOpen,
                title: "Read in Browser",
                body: "No downloads, no plugins. Open any PDF and navigate to any page instantly.",
              },
              {
                icon: MessageSquare,
                title: "Interact on Any Page",
                body: "Comments attach to specific pages. Readers click a badge and arrive exactly where the discussion started.",
              },
              {
                icon: Layers,
                title: "Multiple Editions",
                body: "Each edition gets its own PDF and discussion thread. No cross-contamination between versions.",
              },
              {
                icon: Download,
                title: "Download Anytime",
                body: "Every book you can read here, you can also save locally. No paywalls or download limits.",
              },
              {
                icon: Bookmark,
                title: "Personal Bookmarks",
                body: "Mark pages with private notes. Only you can see them.",
              },
              {
                icon: List,
                title: "Reading Lists",
                body: "Group books into named collections. Keep them private or share with anyone.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(99,102,241,0.15)" }}>
                  <Icon className="w-5 h-5 text-ink-600" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-ink-900">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20 px-4 bg-white landing-section-main">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-12">
            Quick Start
          </h2>
          <div className="grid sm:grid-cols-3 gap-10">
            {[
              { step: "1", title: "Upload", body: "Add a PDF with its title and author. Done in under a minute." },
              { step: "2", title: "Read", body: "Open the built-in reader. Jump to any page, zoom in, and set bookmarks as you go." },
              { step: "3", title: "Discuss", body: "Post a comment tied to a specific page. Everyone reading that edition sees it in context." },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-serif text-lg font-semibold" style={{ backgroundColor: "#312e81" }}>
                  {step}
                </div>
                <h3 className="font-serif text-lg font-semibold text-ink-900">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 25: Popular this week */}
      {popularBooks.length > 0 && (
        <section className="py-16 px-4 landing-section-alt">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-2xl font-semibold text-ink-900 text-center mb-2">
              Popular This Week
            </h2>
            <p className="text-sm text-gray-500 text-center mb-8">
              Most Discussed in the Last 7 Days
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {popularBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        </section>
      )}

      <ScrollToTop />
    </div>
  );
}
