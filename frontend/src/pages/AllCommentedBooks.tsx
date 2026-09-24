import { useRef, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, BookOpen } from "lucide-react";
import { userCommentsApi } from "@/api";
import type { CommentedBook } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

const PAGE = 30;

export default function AllCommentedBooks() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.username === username;
  const sentinelCbRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["all-commented-books", username],
    queryFn: async ({ pageParam = 1 }) => {
      const all = await userCommentsApi.commentedBooks(username!).then(r => r.data);
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
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-medium mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Back
      </button>
      <h1 className="font-serif text-2xl font-semibold text-ink-900 dark:text-gray-100 flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-ink-400" />
        {isSelf ? "My Comments" : `${username}'s Comments`}
      </h1>

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
              className="group block relative rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200 aspect-[3/4]"
            >
              {/* Cover */}
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full bg-paper-200 dark:bg-gray-800 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
              )}
              {/* Comment count badge top-right */}
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                <MessageSquare className="w-2.5 h-2.5" />
                {book.total_comments}
              </div>
              {/* Gradient scrim + text + edition pills */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-10 px-2.5 pb-2.5">
                <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-0.5">
                  {book.title}
                </p>
                <p className="text-[10px] text-white/70 line-clamp-1 mb-1.5">{book.author}</p>
                {book.editions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {book.editions.slice(0, 2).map(ed => (
                      <span key={ed.edition_id} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white whitespace-nowrap">
                        E{ed.edition_number}&nbsp;·&nbsp;{ed.comment_count}
                      </span>
                    ))}
                    {book.editions.length > 2 && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold whitespace-nowrap ml-0.5">
                        +{book.editions.length - 2}
                      </span>
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
