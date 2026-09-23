import { useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, BookOpen } from "lucide-react";
import { userCommentsApi } from "@/api";
import type { CommentedBook } from "@/api";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

const PAGE = 30;

export default function AllCommentedBooks() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const _dup =<{ username: string }>();
  const sentinelCbRef = useRef<IntersectionObserver | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["all-commented-books", username],
    queryFn: async ({ pageParam = 1 }) => {
      const all = await userCommentsApi.commentedBooks(username!).then(r => r.data);
      // commentedBooks returns all at once -- slice for virtual pagination
      const start = ((pageParam as number) - 1) * PAGE;
      return all.slice(start, start + PAGE);
    },
    initialPageParam: 1,
    getNextPageParam: (last, all) => last.length === PAGE ? all.length + 1 : undefined,
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sentinelCb = useCallback((el: HTMLDivElement | null) => {
    if (sentinelCbRef.current) sentinelCbRef.current.disconnect();
    if (!el) return;
    const obs = new IntersectionObserver(handleIntersect, { threshold: 0.8 });
    obs.observe(el);
    sentinelCbRef.current = obs;
  }, [handleIntersect]);

  const books: CommentedBook[] = data?.pages.flat() ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="font-serif text-2xl font-semibold text-ink-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-ink-400" />
          {username}'s Comments
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" /></div>
      ) : books.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">No comments yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {books.map(book => (
            <Link
              key={book.book_id}
              to={`/u/${username}/comments/${book.book_id}`}
              className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md hover:border-ink-300 dark:hover:border-indigo-700 transition-all duration-200"
            >
              <div className="aspect-[3/4] overflow-hidden bg-paper-100 dark:bg-gray-800 relative">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/65 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  <MessageSquare className="w-2.5 h-2.5" />
                  {book.total_comments}
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-ink-900 dark:text-gray-100 line-clamp-2 leading-snug mb-0.5">
                  {book.title}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">{book.author}</p>
                {book.editions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {book.editions.slice(0, 3).map(ed => (
                      <span key={ed.edition_id} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 dark:bg-ink-900/30 text-ink-500 dark:text-indigo-300 whitespace-nowrap">
                        E{ed.edition_number} · {ed.comment_count}
                      </span>
                    ))}
                    {book.editions.length > 3 && (
                      <span className="text-[10px] text-gray-400 px-1 py-0.5">+{book.editions.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div ref={sentinelCb} className="h-12 flex items-center justify-center mt-4">
        {isFetchingNextPage && <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />}
      </div>
      <ScrollToTop />
    </div>
  );
}
