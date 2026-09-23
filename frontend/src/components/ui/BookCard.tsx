import { Link } from "react-router-dom";
import { BookOpen, Layers, MessageSquare, Heart } from "lucide-react";
import type { BookListItem } from "@/types";
import { timeAgo } from "@/utils/time";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip } from "@/components/ui/Tooltip";
import { booksApi } from "@/api";
import { BOOKS_KEY } from "@/hooks/useBooks";

interface Props {
  book: BookListItem;
}

export function BookCard({ book }: Props) {
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
    <Link
      to={`/books/${book.id}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-900
                 shadow-sm hover:shadow-lg transition-shadow duration-200 border
                 border-gray-200 dark:border-gray-700 hover:border-ink-300 dark:hover:border-indigo-700"
      onMouseEnter={handleMouseEnter}
    >
      {/* ── Cover image with overlay badges ── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-paper-100 dark:bg-gray-800 flex-shrink-0">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-paper-400 w-full h-full">
            <BookOpen className="w-12 h-12" />
            <span className="text-xs">No cover</span>
          </div>
        )}

        {/* Gradient scrim -- makes corner badges legible over any cover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 pointer-events-none" />

        {/* Top-right: likes */}
        {likeCount > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1
                          bg-black/60 backdrop-blur-sm text-white text-[10px]
                          px-1.5 py-0.5 rounded-full font-medium">
            <Heart className="w-2.5 h-2.5 fill-rose-400 text-rose-400" />
            {likeCount}
          </div>
        )}

        {/* Bottom-left: edition count */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1
                        bg-black/60 backdrop-blur-sm text-white text-[10px]
                        px-1.5 py-0.5 rounded-full font-medium">
          <Layers className="w-2.5 h-2.5" />
          {book.edition_count}
        </div>

        {/* Bottom-right: comment count */}
        {book.comment_count > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1
                          bg-black/60 backdrop-blur-sm text-white text-[10px]
                          px-1.5 py-0.5 rounded-full font-medium">
            <MessageSquare className="w-2.5 h-2.5" />
            {book.comment_count}
          </div>
        )}
      </div>

      {/* ── Info panel below cover ── */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="font-serif text-sm font-semibold text-ink-900 dark:text-gray-100
                       line-clamp-2 leading-snug">
          {book.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{book.author}</p>
        {book.description && (
          <Tooltip content={book.description} title={book.title}>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
              {book.description}
            </p>
          </Tooltip>
        )}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-auto pt-2">
          {timeAgo(book.created_at)}
        </p>
      </div>
    </Link>
  );
}
