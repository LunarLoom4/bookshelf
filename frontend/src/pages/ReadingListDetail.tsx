import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useUpdateReadingList } from "@/hooks/useBooks";
import { readingListsApi } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { OverlayBookCard } from "@/components/ui/OverlayBookCard";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { Lock, Trash2, ArrowLeft, BookOpen, Pencil, Check, X } from "lucide-react";
import { timeAgo } from "@/utils/time";
import toast from "react-hot-toast";
import type { ReadingListDetail } from "@/types";

const PAGE_SIZE = 20;

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

  const updateList = useUpdateReadingList();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

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

  // MUST be before any early return (Rules of Hooks)
  const {
    data: booksData,
    isLoading: loadingBooks,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["list-books", Number(listId)],
    queryFn: ({ pageParam = 0 }) =>
      readingListsApi.books(Number(listId), pageParam as number, PAGE_SIZE).then(r => r.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!listId && !!list,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-8" />
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

  const books = booksData?.pages.flat() ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-medium mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {!list.is_public && <Lock className="w-4 h-4 text-gray-400" />}
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameValue.trim()) {
                      updateList.mutate({ listId: list.id, name: nameValue.trim() });
                      setEditingName(false);
                    }
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="input font-serif text-2xl py-0.5 w-64"
                  maxLength={100}
                />
                <button
                  onClick={() => { if (nameValue.trim()) updateList.mutate({ listId: list.id, name: nameValue.trim() }); setEditingName(false); }}
                  className="text-green-600 hover:text-green-700"
                  title="Save"
                ><Check className="w-5 h-5" /></button>
                <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600" title="Cancel">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-3xl font-semibold text-ink-900">{list.name}</h1>
                {isOwner && (
                  <button
                    onClick={() => { setNameValue(list.name); setEditingName(true); }}
                    className="text-gray-400 hover:text-ink-600 transition-colors mt-1"
                    title="Rename list"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {books.length} {books.length === 1 ? "book" : "books"} ·{" "}
            Updated {timeAgo(list.updated_at, true)}
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
            Delete List
          </button>
        )}
      </div>

      {/* Books grid */}
      {loadingBooks ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No books in this list yet.</p>
          <Link to="/browse" className="text-ink-600 text-sm hover:underline mt-2 inline-block">
            Browse books to add
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {books.map((book) => (
            <div key={book.id} className="h-full">
              <OverlayBookCard
                book={book as any}
                onRemove={isOwner ? () => removeBook.mutate(book.id) : undefined}
                removeIcon={<Trash2 className="w-3.5 h-3.5" />}
              />
            </div>
          ))}
        </div>
      )}
      {/* Infinite scroll sentinel */}
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
    </div>
  );
}
