import { Link } from "react-router-dom";
import { BookOpen, Layers, MessageSquare } from "lucide-react";
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

  const handleMouseEnter = () => {
    // Prefetch the book detail when the user hovers the card.
    // If data is already cached and fresh, this is a no-op.
    queryClient.prefetchQuery({
      queryKey: [BOOKS_KEY, book.id],
      queryFn: () => booksApi.get(book.id).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    });
  };

  return (
    <Link
      to={`/books/${book.id}`}
      className="card group flex flex-col hover:shadow-md transition-shadow duration-200 overflow-hidden"
      onMouseEnter={handleMouseEnter}
    >
      {/* Cover */}
      <div className="aspect-[4/5] bg-paper-100 flex items-center justify-center overflow-hidden">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-paper-400">
            <BookOpen className="w-12 h-12" />
            <span className="text-xs">No cover</span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="p-4 flex flex-col gap-1 flex-1">
        <h3 className="font-serif text-base font-semibold text-ink-900 line-clamp-2 leading-snug">
          {book.title}
        </h3>
        <p className="text-sm text-gray-500">{book.author}</p>
        {book.description && (
          <Tooltip content={book.description}>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {book.description}
            </p>
          </Tooltip>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {book.edition_count}
            </span>
            {book.comment_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {book.comment_count}
              </span>
            )}
          </div>
          <span>{timeAgo(book.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
