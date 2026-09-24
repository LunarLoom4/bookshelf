/**
 * OverlayBookCard -- the premium overlay-style book card used on all list pages.
 * Cover image fills the entire card. Title, author, edition/comment/like badges
 * are overlaid over a gradient scrim at the bottom.
 * Likes badge sits top-right. Delete/remove button (if provided) top-left.
 */
import { Link } from "react-router-dom";
import { BookOpen, Layers, MessageSquare, Heart } from "lucide-react";
import type { BookListItem } from "@/types";
import { timeAgo } from "@/utils/time";
import { useQueryClient } from "@tanstack/react-query";
import { booksApi } from "@/api";
import { BOOKS_KEY } from "@/hooks/useBooks";

interface Props {
  book: BookListItem;
  /** Optional remove button (e.g. in Reading List). Shown top-left on hover. */
  onRemove?: () => void;
  removeIcon?: React.ReactNode;
}

export function OverlayBookCard({ book, onRemove, removeIcon }: Props) {
  const queryClient = useQueryClient();
  const likeCount = (book as any).like_count ?? 0;

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: [BOOKS_KEY, book.id],
      queryFn: () => booksApi.get(book.id).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    });
  };

  return (
    <div className="group relative h-full" onMouseEnter={handleMouseEnter}>
      <Link to={`/books/${book.id}`} className="block h-full">
        <div className="relative rounded-xl overflow-hidden aspect-[3/4] shadow-sm hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-gray-700 hover:border-ink-300 dark:hover:border-indigo-700">

          {/* Cover */}
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-paper-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-2 text-paper-400">
              <BookOpen className="w-10 h-10" />
              <span className="text-xs">No cover</span>
            </div>
          )}

          {/* Top-right: likes */}
          {likeCount > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/65 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full font-medium z-10">
              <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
              {likeCount}
            </div>
          )}

          {/* Gradient scrim + text overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 via-black/55 to-transparent pt-12 px-3 pb-3">
            <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 mb-0.5">
              {book.title}
            </h3>
            <p className="text-white/70 text-[11px] line-clamp-1 mb-2">{book.author}</p>

            {/* Bottom badges row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  <Layers className="w-2.5 h-2.5" />
                  {book.edition_count}
                </span>
                {book.comment_count > 0 && (
                  <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                    <MessageSquare className="w-2.5 h-2.5" />
                    {book.comment_count}
                  </span>
                )}
              </div>
              <span className="text-white/50 text-[10px]">{timeAgo(book.created_at)}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Optional remove button -- top-left, shown on hover */}
      {onRemove && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          title="Remove from list"
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-white/90 shadow text-gray-400
                     hover:text-red-500 hover:bg-white flex items-center justify-center
                     opacity-0 group-hover:opacity-100 transition-all duration-150 z-10"
        >
          {removeIcon}
        </button>
      )}
    </div>
  );
}
