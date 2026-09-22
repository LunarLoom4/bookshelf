import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, BookOpen, MessageSquare, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { userCommentsApi } from "@/api";
import type { CommentFeedEdition, CommentFeedItem } from "@/api";
import { timeAgo } from "@/utils/time";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

const SORT_OPTIONS = [
  { value: "newest",    label: "Most Recent" },
  { value: "oldest",    label: "Oldest First" },
  { value: "upvotes",   label: "Most Upvotes" },
  { value: "downvotes", label: "Most Downvotes" },
  { value: "replies",   label: "Most Replies" },
  { value: "page",      label: "By Page Number" },
];

function CommentCard({ comment }: { comment: CommentFeedItem }) {
  return (
    <Link
      to={`/read/${comment.edition_id}${comment.page_number ? `?page=${comment.page_number}` : ""}`}
      className="block group"
    >
      <div className="px-4 py-4 hover:bg-ink-50/40 dark:hover:bg-white/5 transition-colors">
        <p className="text-sm leading-relaxed text-ink-900 dark:text-gray-100 line-clamp-3 mb-2.5 group-hover:text-ink-600 dark:group-hover:text-indigo-300 transition-colors">
          {comment.body}
        </p>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {comment.page_number != null && (
            <span className="page-badge">p. {comment.page_number}</span>
          )}
          {comment.vote_score !== 0 && (
            <span className={`flex items-center gap-0.5 font-medium ${comment.vote_score > 0 ? "text-emerald-500" : "text-red-400"}`}>
              {comment.vote_score > 0
                ? <ThumbsUp className="w-3 h-3" />
                : <ThumbsDown className="w-3 h-3" />
              }
              {Math.abs(comment.vote_score)}
            </span>
          )}
          <span className="text-gray-400 dark:text-gray-500">{timeAgo(comment.created_at)}</span>
          {comment.edited_at && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 tracking-wide">
              EDITED
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function EditionAccordion({
  edition,
  defaultOpen,
}: {
  edition: CommentFeedEdition;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-ink-600 dark:text-indigo-300">E{edition.edition_number}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-gray-100">
              Edition {edition.edition_number}
              {edition.year && <span className="font-normal text-gray-400 dark:text-gray-500 ml-1.5">· {edition.year}</span>}
            </p>
            {edition.publisher && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{edition.publisher}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-900/40 text-ink-600 dark:text-indigo-300">
            <MessageSquare className="w-3 h-3" />
            {edition.comment_count}
          </span>
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {open && edition.comments.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {edition.comments.map(c => <CommentCard key={c.id} comment={c} />)}
        </div>
      )}
      {open && edition.comments.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-400 border-t border-gray-100 dark:border-gray-800">
          No comments match this filter.
        </div>
      )}
    </div>
  );
}

export default function UserCommentsFeed() {
  const { username, bookId } = useParams<{ username: string; bookId: string }>();
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["user-comments-feed", username, bookId, sort, debouncedSearch],
    queryFn: ({ pageParam = 1 }) =>
      userCommentsApi
        .feed(username!, Number(bookId), { sort, q: debouncedSearch, page: pageParam as number, limit: 30 })
        .then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.page + 1 : undefined,
    enabled: !!username && !!bookId,
    staleTime: 60 * 1000,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const allEditions = (() => {
    if (!data) return [];
    const map = new Map<number, CommentFeedEdition>();
    for (const page of data.pages) {
      for (const ed of page.editions) {
        if (!map.has(ed.edition_id)) {
          map.set(ed.edition_id, { ...ed, comments: [] });
        }
        map.get(ed.edition_id)!.comments.push(...ed.comments);
        map.get(ed.edition_id)!.comment_count = ed.comment_count;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.edition_number - a.edition_number);
  })();

  const meta = data?.pages[0];
  const total = meta?.total ?? 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !meta) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-400 text-sm">
        Could not load comments.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <ScrollToTop />

      {/* Back link -- (e) more visible, username highlighted */}
      <Link
        to={`/u/${username}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-ink-700 dark:hover:text-gray-100 mb-6 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to{" "}
        <span className="text-ink-600 dark:text-indigo-400 font-semibold">{username}</span>
      </Link>

      {/* Book header -- (b) comment count darker */}
      <div className="flex items-start gap-4 mb-8 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="w-14 h-20 rounded-md overflow-hidden bg-paper-100 dark:bg-gray-800 flex-shrink-0">
          {meta.book_cover_url ? (
            <img src={meta.book_cover_url} alt={meta.book_title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-gray-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to={`/books/${meta.book_id}`}
            className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100 hover:text-ink-600 hover:underline line-clamp-2"
          >
            {meta.book_title}
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{meta.book_author}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-1.5 font-medium">
            <MessageSquare className="w-3.5 h-3.5 text-ink-400" />
            {total} comment{total !== 1 ? "s" : ""} by{" "}
            <span className="text-ink-600 dark:text-indigo-400">{username}</span>
          </p>
        </div>
      </div>

      {/* Search + sort bar -- (c) custom select to center text */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search comments..."
            className="input pl-9 text-sm w-full"
          />
        </div>
        {/* Custom select wrapper for centered text + visible arrow */}
        <div className="relative flex-shrink-0 sm:w-44">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="appearance-none w-full input text-sm text-center pr-8 bg-white dark:bg-gray-900 cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Edition accordions */}
      {allEditions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No comments found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {allEditions.map((ed, i) => (
            <EditionAccordion
              key={ed.edition_id}
              edition={ed}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-500 rounded-full animate-spin" />
        </div>
      )}

      {!hasNextPage && total > 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 py-6">
          All {total} comment{total !== 1 ? "s" : ""} loaded
        </p>
      )}
    </div>
  );
}
