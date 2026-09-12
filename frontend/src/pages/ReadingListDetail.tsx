import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { readingListsApi } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { BookCard } from "@/components/ui/BookCard";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { Globe, Lock, Trash2, ArrowLeft, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import type { BookListItem, ReadingListDetail } from "@/types";

export default function ReadingListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: list, isLoading, error } = useQuery<ReadingListDetail>({
    queryKey: ["lists", Number(listId)],
    queryFn: () => readingListsApi.get(Number(listId)).then((r) => r.data),
    enabled: !!listId,
  });

  const removeBook = useMutation({
    mutationFn: (bookId: number) =>
      readingListsApi.removeBook(Number(listId), bookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists", Number(listId)] });
      qc.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Book removed from list");
    },
    onError: () => toast.error("Failed to remove book"),
  });

  const deleteList = useMutation({
    mutationFn: () => readingListsApi.delete(Number(listId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      toast.success("List deleted");
      navigate(-1);
    },
    onError: () => toast.error("Failed to delete list"),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-8" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-400">
        <p>List not found or is private.</p>
        <Link to="/browse" className="text-ink-600 text-sm hover:underline mt-2 inline-block">
          Back to browse
        </Link>
      </div>
    );
  }

  const isOwner = isAuthenticated && user?.id === list.user_id;
  // Build BookListItem shapes from the list items (they have book embedded from API)
  const books: BookListItem[] = (list.items as any[]).map((item) => item.book).filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-ink-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {list.is_public
              ? <Globe className="w-4 h-4 text-gray-400" />
              : <Lock className="w-4 h-4 text-gray-400" />
            }
            <h1 className="font-serif text-3xl font-semibold text-ink-900">{list.name}</h1>
          </div>
          <p className="text-sm text-gray-400">
            {books.length} {books.length === 1 ? "book" : "books"} ·{" "}
            updated {formatDistanceToNow(new Date(list.updated_at), { addSuffix: true })}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              if (window.confirm("Delete this reading list? This cannot be undone.")) {
                deleteList.mutate();
              }
            }}
            disabled={deleteList.isPending}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-md px-3 py-1.5 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Delete list
          </button>
        )}
      </div>

      {/* Books grid */}
      {books.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No books in this list yet.</p>
          <Link to="/browse" className="text-ink-600 text-sm hover:underline mt-2 inline-block">
            Browse books to add
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {books.map((book) => (
            <div key={book.id} className="relative group">
              <BookCard book={book} />
              {isOwner && (
                <button
                  onClick={() => removeBook.mutate(book.id)}
                  disabled={removeBook.isPending}
                  title="Remove from list"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow text-gray-400
                             hover:text-red-500 hover:bg-white flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-all duration-150 z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
