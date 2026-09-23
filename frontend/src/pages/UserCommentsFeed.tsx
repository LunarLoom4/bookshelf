import React, { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, X, BookOpen, MessageSquare, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { userCommentsApi } from "@/api";
import type { CommentFeedEdition, CommentFeedItem } from "@/api";
import { timeAgo } from "@/utils/time";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useDebounce } from "@/hooks/useDebounce";

const SORT_OPTIONS = [
  { value: "newest",    label: "Most Recent" },
  { value: "oldest",    label: "Oldest First" },
  { value: "upvotes",   label: "Most Upvotes" },
  { value: "downvotes", label: "Most Downvotes" },
  { value: "replies",   label: "Most Replies" },
];

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Numbered comment row: number side not clickable, content side navigates
function BodyWithMentions({ body }: { body: string }) {
  const parts = body.split(/(@\w+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^@\w+$/.test(part)) {
          const uname = part.slice(1);
          return (
            <Link
              key={i}
              to={`/u/${uname}`}
              onClick={e => e.stopPropagation()}
              className="text-ink-600 dark:text-indigo-400 font-medium hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function CommentCard({ comment, index }: { comment: CommentFeedItem; index: number }) {
  const isReply = comment.parent_id !== null;
  return (
    <div className="relative flex">
      <div className="absolute left-12 top-[10%] bottom-[10%] w-px bg-gray-300 dark:bg-gray-600 pointer-events-none" />
      <div className="flex-shrink-0 w-12 flex items-center justify-center pl-1">
        <span className="text-sm font-semibold text-ink-400 dark:text-indigo-400 tabular-nums">
          {index + 1}
        </span>
      </div>
      <Link
        to={`/read/${comment.edition_id}${comment.page_number ? `?page=${comment.page_number}` : ""}`}
        className="flex-1 group min-w-0"
      >
        <div className="px-4 py-2.5 hover:bg-ink-50/60 dark:hover:bg-white/5 transition-colors">
          {isReply && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1">
              <span className="text-gray-300 dark:text-gray-600">↩</span> reply
            </span>
          )}
          <p className="text-sm leading-relaxed text-ink-900 dark:text-gray-100 line-clamp-3 mb-1.5 group-hover:text-ink-600 dark:group-hover:text-indigo-300 transition-colors">
            <BodyWithMentions body={comment.body} />
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
    </div>
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
          {/* (c + d) E-badge like in the concept, matching BookDetail style */}
          <div className="w-9 h-9 rounded-lg bg-ink-100 dark:bg-ink-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-ink-600 dark:text-indigo-300">E{edition.edition_number}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-ink-900 dark:text-gray-100">
                Edition {edition.edition_number}
              </p>
              {edition.year && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 leading-none">
                  {edition.year}
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap mt-1 text-xs">
              {(() => {
                const items: React.ReactNode[] = [];
                if (edition.publisher) items.push(
                  <span key="pub" className="font-medium text-gray-500 dark:text-gray-400">{edition.publisher}</span>
                );
                if (edition.file_size_bytes != null) items.push(
                  <span key="size" className="text-gray-400 dark:text-gray-500">{formatBytes(edition.file_size_bytes)}</span>
                );
                if (edition.page_count != null) items.push(
                  <span key="pages" className="text-gray-400 dark:text-gray-500">
                    <span className="font-medium text-gray-500 dark:text-gray-400">{edition.page_count.toLocaleString()}</span> pp
                  </span>
                );
                return items.map((item, i) => (
                  <span key={i} className="flex items-center">
                    {i > 0 && <span className="text-gray-300 dark:text-gray-600 mx-1.5">·</span>}
                    {item}
                  </span>
                ));
              })()}
            </div>
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

      {/* (a) Dividers: border-t on first comment, divide-y between rest -- gray-200 for clear visibility */}
      {open && edition.comments.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {edition.comments.map((c, i) => (
            <CommentCard key={c.id} comment={c} index={i} />
          ))}
        </div>
      )}
      {open && edition.comments.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-400 border-t border-gray-200 dark:border-gray-700">
          No comments match this filter.
        </div>
      )}
    </div>
  );
}

export default function UserCommentsFeed() {
  const { username, bookId } = useParams<{ username: string; bookId: string }>();
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["user-comments-feed", username, bookId, sort, debouncedQuery],
    queryFn: ({ pageParam = 1 }) =>
      userCommentsApi
        .feed(username!, Number(bookId), { sort, q: debouncedQuery, page: pageParam as number, limit: 30 })
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

      {/* (d) Back link: only username is colored, "Back to" stays gray on hover */}
      <Link
        to={`/u/${username}`}
        className="inline-flex items-center gap-1.5 mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:-translate-x-0.5 transition-all" />
        <span className="text-sm font-medium text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
          Back to
        </span>
        <span className="text-sm font-semibold text-ink-600 dark:text-indigo-400 group-hover:text-ink-800 dark:group-hover:text-indigo-300 transition-colors">
          {username}
        </span>
      </Link>

      {/* Book header -- (e) remove username, smaller comment count */}
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
          {/* (e) just "N comments", smaller, no username */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {total} comment{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search comments..."
            className="input pl-9 pr-8 text-sm w-full"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* (b) Select matches .input height exactly: py-2 = 8px top/bottom */}
        <div className="relative flex-shrink-0 sm:w-44">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="appearance-none w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-ink-900 dark:text-gray-100 cursor-pointer transition-colors hover:border-gray-400 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-ink-500 focus:border-transparent"
            style={{ padding: "8px 36px 8px 12px", fontWeight: 400 }}
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

      {/* (f) Remove "All N comments loaded" -- spinner only while fetching */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
