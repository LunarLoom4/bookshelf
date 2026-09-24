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

    // Optimistic update: add the new comment to the cache immediately
    // so it appears in the UI before the server responds
    onMutate: async ({ body, pageNumber, parentId }) => {
      await qc.cancelQueries({ queryKey: [COMMENTS_KEY, editionId] });
      const previousData = qc.getQueriesData({ queryKey: [COMMENTS_KEY, editionId] });

      // Build a temporary comment object
      const tempComment: Comment = {
        id: -Date.now(), // negative temp id to avoid conflicts
        body,
        page_number: pageNumber ?? null,
        parent_id: parentId ?? null,
        user_id: 0,
        edition_id: editionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vote_score: 0,
        user_vote: null,
        is_deleted: false,
        edited_at: null,
        author: null,
        reply_count: 0,
      };

      // Add to the correct query cache (top-level or replies)
      const queryKey = parentId
        ? [COMMENTS_KEY, editionId, "replies", parentId]
        : [COMMENTS_KEY, editionId, "newest"];

      qc.setQueryData(queryKey, (old: Comment[] | undefined) =>
        old ? [...old, tempComment] : [tempComment]
      );

      return { previousData };
    },

    // On error, roll back optimistic update
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
    },

    // Always refetch to sync with server (replaces temp comment with real one)
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
    onMutate: async ({ commentId, value }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: [COMMENTS_KEY, editionId] });

      // Snapshot the current cache for rollback
      const previousData = qc.getQueriesData({ queryKey: [COMMENTS_KEY, editionId] });

      // Apply optimistic update to all matching cache entries (top-level + replies)
      qc.setQueriesData(
        { queryKey: [COMMENTS_KEY, editionId], exact: false },
        (old: Comment[] | undefined) => {
          if (!old) return old;
          return old.map((c) => {
            if (c.id !== commentId) return c;
            const prevVote = c.user_vote;
            // Toggle: same value = remove vote; different value = change vote
            const newVote = prevVote === value ? null : value;
            const scoreDelta = newVote === null
              ? -(prevVote ?? 0)          // removing vote
              : prevVote === null
                ? value                   // new vote
                : value * 2;              // switching vote direction
            return { ...c, user_vote: newVote, vote_score: c.vote_score + scoreDelta };
          });
        }
      );

      return { previousData };
    },

    // On server error, roll back to snapshot
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
    },

    // Always refetch after mutation settles to sync with server truth
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
