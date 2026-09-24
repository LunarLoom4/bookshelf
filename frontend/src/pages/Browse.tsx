import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, BookOpen, ChevronDown } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useBookSearch } from "@/hooks/useBooks";
import { booksApi } from "@/api";
import { OverlayBookCard } from "@/components/ui/OverlayBookCard";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "react-router-dom";

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "newest",        label: "Most Recent" },
  { value: "oldest",        label: "Oldest First" },
  { value: "most_discussed", label: "Most Discussed" },
  { value: "most_editions", label: "Most Editions" },
  { value: "most_liked",    label: "Most Liked" },
];

export default function Browse() {
  const { isAuthenticated } = useAuthStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const debouncedQuery = useDebounce(query, 500);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data: infiniteData,
    isLoading: loadingAll,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["books", "browse", sort],
    queryFn: ({ pageParam = 0 }) =>
      booksApi.list(pageParam as number, PAGE_SIZE, sort).then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    staleTime: 60 * 1000,
  });

  const { data: searchResults, isLoading: loadingSearch } = useBookSearch(debouncedQuery);

  const isSearching = debouncedQuery.length > 0;
  const allBooks = infiniteData?.pages.flat() ?? [];
  const books = isSearching ? (searchResults ?? allBooks) : allBooks;
  const loading = isSearching ? loadingSearch : loadingAll;

  const subtitle = (() => {
    if (isSearching) {
      if (loading) return "Searching...";
      if (!books) return "";
      return `${books.length} ${books.length === 1 ? "book" : "books"} found`;
    }
    if (!allBooks) return "";
    return `${allBooks.length} ${allBooks.length === 1 ? "book" : "books"} uploaded`;
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header + search + sort */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900">Browse Books</h1>
          <p className="text-sm text-gray-500 mt-1 h-5">{subtitle}</p>
        </div>

        <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title or author..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-9 pr-8 w-full"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort dropdown -- always visible */}
          <div className="relative flex-shrink-0">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="appearance-none rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-ink-900 dark:text-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink-500 focus:border-transparent transition-colors hover:border-gray-400 dark:hover:border-gray-600"
              style={{ padding: "8px 36px 8px 12px", fontWeight: 400 }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading && books.length === 0 ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : books.length > 0 ? (
        <div className="min-h-[400px]">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {books.map((book) => <OverlayBookCard key={book.id} book={book} />)}
          </div>
          {!isSearching && (
            <div
              ref={(el) => {
                if (!el || !hasNextPage) return;
                const obs = new IntersectionObserver(
                  ([entry]) => { if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage(); },
                  { rootMargin: "200px" }
                );
                obs.observe(el);
              }}
              className="h-10 flex items-center justify-center mt-6"
            >
              {isFetchingNextPage && (
                <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-24 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          {isSearching ? (
            <p className="text-sm">No results for &ldquo;{debouncedQuery}&rdquo;</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-500 mb-1">No books here yet.</p>
              <p className="text-xs text-gray-400 mb-4">Be the first to share a book with the community.</p>
              {isAuthenticated && <Link to="/upload" className="btn-primary py-2 text-sm inline-flex">Upload the first book</Link>}
            </>
          )}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
}
