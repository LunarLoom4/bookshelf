import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { booksApi, commentsApi, progressApi, bookmarksApi, readingListsApi } from "@/api";
import type { Comment } from "@/types";

export const BOOKS_KEY = "books";
export const COMMENTS_KEY = "comments";

// ── Books ──────────────────────────────────────────────────────────────────────
export function useBooks(skip = 0, limit = 20, sort = "newest") {
  return useQuery({
    queryKey: [BOOKS_KEY, "list", skip, limit, sort],
    queryFn: () => booksApi.list(skip, limit, sort).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,  // keep previous results visible while new sort/page loads
  });
}

export function useBookSearch(q: string) {
  return useQuery({
    queryKey: [BOOKS_KEY, "search", q],
    queryFn: () => booksApi.search(q).then((r) => r.data),
    enabled: q.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,  // keep previous search results while new query loads
  });
}

export function useBook(bookId: number) {
  return useQuery({
    queryKey: [BOOKS_KEY, bookId],
    queryFn: () => booksApi.get(bookId).then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes -- mutations invalidate cache explicitly
  });
}

export function useUploadBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => booksApi.upload(formData).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BOOKS_KEY] }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) => booksApi.delete(bookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BOOKS_KEY] });
    },
  });
}

export function useUploadCover(bookId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => booksApi.uploadCover(bookId, formData).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BOOKS_KEY, bookId] }),
  });
}

export function useAddEdition(bookId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => booksApi.addEdition(bookId, formData).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BOOKS_KEY, bookId] }),
  });
}

// ── Comments ───────────────────────────────────────────────────────────────────
const COMMENTS_PAGE_SIZE = 30;

export function useComments(editionId: number, sort: "newest" | "top" = "newest") {
  return useInfiniteQuery({
    queryKey: [COMMENTS_KEY, editionId, sort],
    queryFn: ({ pageParam = 0 }) =>
      commentsApi.list(editionId, sort, undefined, pageParam as number, COMMENTS_PAGE_SIZE)
        .then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === COMMENTS_PAGE_SIZE ? allPages.length * COMMENTS_PAGE_SIZE : undefined,
    staleTime: 0,
  });
}

export function useReplies(editionId: number, parentId: number, enabled: boolean) {
  return useQuery({
    queryKey: [COMMENTS_KEY, editionId, "replies", parentId],
    queryFn: () => commentsApi.list(editionId, "newest", parentId).then((r) => r.data),
    staleTime: 0,
    enabled,
  });
}

export function useCreateComment(editionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      body,
      pageNumber,
      parentId,
    }: {
      body: string;
      pageNumber?: number;
      parentId?: number;
    }) => commentsApi.create(editionId, body, pageNumber, parentId).then((r) => r.data),

    onSettled: () => {
      qc.invalidateQueries({ queryKey: [COMMENTS_KEY, editionId] });
    },
  });
}

export function useVoteComment(editionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, value }: { commentId: number; value: 1 | -1 }) =>
      commentsApi.vote(editionId, commentId, value).then((r) => r.data),

    // Optimistic update: change score and user_vote INSTANTLY in cache before
    // the server responds. If the server fails, roll back to previous state.
    onSettled: () => qc.invalidateQueries({ queryKey: [COMMENTS_KEY, editionId] }),
  });
}

// ── Reading Progress ───────────────────────────────────────────────────────────
export function useReadingProgress(editionId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["progress", editionId],
    queryFn: () => progressApi.get(editionId).then((r) => r.data),
    enabled,
  });
}

export function useSaveProgress(editionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lastPage: number) => progressApi.save(editionId, lastPage).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", editionId] }),
  });
}

// ── Bookmarks ──────────────────────────────────────────────────────────────────
export function useBookmarks(editionId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["bookmarks", editionId],
    queryFn: () => bookmarksApi.list(editionId).then((r) => r.data),
    enabled,
  });
}

export function useCreateBookmark(editionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pageNumber, note }: { pageNumber: number; note?: string }) =>
      bookmarksApi.create(editionId, pageNumber, note).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks", editionId] }),
  });
}

export function useUpdateBookmark(editionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookmarkId, note }: { bookmarkId: number; note: string | null }) =>
      bookmarksApi.update(editionId, bookmarkId, note).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks", editionId] }),
  });
}

export function useDeleteBookmark(editionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookmarkId: number) =>
      bookmarksApi.delete(editionId, bookmarkId).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks", editionId] }),
  });
}

// ── Reading Lists ──────────────────────────────────────────────────────────────
export function useMyReadingLists() {
  return useQuery({
    queryKey: ["lists", "mine"],
    queryFn: () => readingListsApi.mine().then((r) => r.data),
  });
}

export function useCreateReadingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, isPublic }: { name: string; isPublic: boolean }) =>
      readingListsApi.create(name, isPublic).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
}

export function useUpdateReadingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name, isPublic }: { listId: number; name?: string; isPublic?: boolean }) =>
      readingListsApi.update(listId, name, isPublic).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export function useDeleteReadingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: number) => readingListsApi.delete(listId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
}

export function useAddToReadingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, bookId }: { listId: number; bookId: number }) =>
      readingListsApi.addBook(listId, bookId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
}

export function useRemoveFromReadingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, bookId }: { listId: number; bookId: number }) =>
      readingListsApi.removeBook(listId, bookId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
}

export function useUserReadingLists(username: string) {
  return useQuery({
    queryKey: ["lists", "user", username],
    queryFn: () => readingListsApi.byUser(username).then((r) => r.data),
    enabled: !!username,
  });
}
