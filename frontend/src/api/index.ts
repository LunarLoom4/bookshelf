import api from "./client";
import type { Book, BookListItem, Comment, TokenResponse, User,
              ReadingProgress, Bookmark, ReadingList, ReadingListDetail } from "@/types";

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authApi = {
  googleLogin: (credential: string) =>
    api.post<TokenResponse>("/auth/google", { credential }),

  register: (email: string, username: string, password: string) =>
    api.post<TokenResponse>("/auth/register", { email, username, password }),

  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>("/auth/refresh", { refresh_token }),

  me: () => api.get<User>("/auth/me"),
};

// ── Books ──────────────────────────────────────────────────────────────────────
export const booksApi = {
  list: (skip = 0, limit = 20) =>
    api.get<BookListItem[]>("/books/", { params: { skip, limit } }),
  popular: (days = 7, limit = 6) =>
    api.get<BookListItem[]>("/books/popular", { params: { days, limit } }),

  search: (q: string, skip = 0, limit = 20) =>
    api.get<BookListItem[]>("/books/search", { params: { q, skip, limit } }),

  get: (bookId: number) => api.get<Book>(`/books/${bookId}`),

  upload: (formData: FormData) =>
    api.post<Book>("/books/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Upload with progress tracking via XMLHttpRequest.
  // onProgress receives 0-100 percentage as upload bytes are sent.
  uploadWithProgress: (
    formData: FormData,
    onProgress: (pct: number) => void,
    token: string,
  ): Promise<Book> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/v1/books/");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText) as Book);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject({ response: { status: xhr.status, data: err } });
          } catch {
            reject({ response: { status: xhr.status, data: { detail: "Upload failed" } } });
          }
        }
      };
      xhr.onerror = () => reject({ response: { status: 0, data: { detail: "Network error" } } });
      xhr.send(formData);
    }),

  delete: (bookId: number) => api.delete(`/books/${bookId}`),

  uploadCover: (bookId: number, formData: FormData) =>
    api.post<Book>(`/books/${bookId}/cover`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  pdfProxyUrl: (bookId: number, editionId: number) =>
    `/api/v1/books/${bookId}/editions/${editionId}/pdf`,

  addEdition: (bookId: number, formData: FormData) =>
    api.post<Book>(`/books/${bookId}/editions`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ── Comments ───────────────────────────────────────────────────────────────────
export const commentsApi = {
  edit: (editionId: number, commentId: number, body: string) =>
    api.patch(`/editions/${editionId}/comments/${commentId}`, { body }),
  delete: (editionId: number, commentId: number) =>
    api.delete(`/editions/${editionId}/comments/${commentId}`),

  list: (editionId: number, sort: "newest" | "top" = "newest", parentId?: number) =>
    api.get<Comment[]>(`/editions/${editionId}/comments/`, {
      params: { sort, ...(parentId !== undefined ? { parent_id: parentId } : {}) },
    }),

  create: (editionId: number, body: string, pageNumber?: number, parentId?: number) =>
    api.post<Comment>(`/editions/${editionId}/comments/`, {
      body,
      page_number: pageNumber ?? null,
      parent_id: parentId ?? null,
    }),

  vote: (editionId: number, commentId: number, value: 1 | -1) =>
    api.post<Comment>(`/editions/${editionId}/comments/${commentId}/vote`, { value }),
};

// ── Users ──────────────────────────────────────────────────────────────────────
export interface NotificationEvent {
  id: number;
  type: string;
  message: string;
  detail: string | null;
  link: string;
  actor: string;
  read_at: string | null;   // null = unread
  created_at: string;
}

export const notificationsApi = {
  get: () => api.get<NotificationEvent[]>("/notifications/"),

  // ids = undefined/[] -> mark ALL as read. ids = [1,2,3] -> mark those IDs.
  markRead: (ids?: number[]) =>
    api.post("/notifications/mark-read", { ids: ids ?? null }),
};

export const usersApi = {
  profile: (username: string) => api.get(`/users/${username}`),
};

// ── Reading Progress ───────────────────────────────────────────────────────────
export const progressApi = {
  get: (editionId: number) =>
    api.get<ReadingProgress | null>(`/editions/${editionId}/progress/`),

  save: (editionId: number, lastPage: number) =>
    api.post<ReadingProgress>(`/editions/${editionId}/progress/`, { last_page: lastPage }),

  // Removes progress row entirely -- removes book from "Currently reading"
  delete: (editionId: number) =>
    api.delete(`/editions/${editionId}/progress/`),
};

// ── Bookmarks ──────────────────────────────────────────────────────────────────
export const bookmarksApi = {
  list: (editionId: number) =>
    api.get<Bookmark[]>(`/editions/${editionId}/bookmarks/`),

  create: (editionId: number, pageNumber: number, note?: string) =>
    api.post<Bookmark>(`/editions/${editionId}/bookmarks/`, {
      page_number: pageNumber,
      note: note ?? null,
    }),

  update: (editionId: number, bookmarkId: number, note: string | null) =>
    api.patch<Bookmark>(`/editions/${editionId}/bookmarks/${bookmarkId}`, { note }),

  delete: (editionId: number, bookmarkId: number) =>
    api.delete(`/editions/${editionId}/bookmarks/${bookmarkId}`),
};

// ── Reading Lists ──────────────────────────────────────────────────────────────
export const readingListsApi = {
  mine: () => api.get<ReadingList[]>("/lists/mine"),

  create: (name: string, isPublic: boolean) =>
    api.post<ReadingList>("/lists/", { name, is_public: isPublic }),

  get: (listId: number) => api.get<ReadingListDetail>(`/lists/${listId}`),

  update: (listId: number, name?: string, isPublic?: boolean) =>
    api.patch<ReadingList>(`/lists/${listId}`, {
      ...(name !== undefined ? { name } : {}),
      ...(isPublic !== undefined ? { is_public: isPublic } : {}),
    }),

  delete: (listId: number) => api.delete(`/lists/${listId}`),

  addBook: (listId: number, bookId: number) =>
    api.post(`/lists/${listId}/books/${bookId}`),

  removeBook: (listId: number, bookId: number) =>
    api.delete(`/lists/${listId}/books/${bookId}`),

  byUser: (username: string) =>
    api.get<ReadingList[]>(`/lists/by-user/${username}`),
};

// ── Account Settings ───────────────────────────────────────────────────────────
export const accountApi = {
  updateUsername: (username: string) =>
    api.patch<User>("/account/username", { username }),

  updatePassword: (currentPassword: string, newPassword: string) =>
    api.patch<User>("/account/password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  setPassword: (newPassword: string) =>
    api.post<User>("/account/password", { new_password: newPassword }),

  uploadAvatar: (formData: FormData) =>
    api.post<User>("/account/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  removeAvatar: () => api.delete<User>("/account/avatar"),

  deleteAccount: () => api.delete("/account"),
};

// ── User comment feed ──────────────────────────────────────────────────────────
export interface CommentedBook {
  book_id: number;
  title: string;
  author: string;
  cover_url: string | null;
  total_comments: number;
  editions: { edition_id: number; edition_number: number; comment_count: number }[];
}

export interface CommentFeedItem {
  id: number;
  body: string;
  page_number: number | null;
  edition_id: number;
  edition_number: number;
  parent_id: number | null;
  vote_score: number;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
}

export interface CommentFeedEdition {
  edition_id: number;
  edition_number: number;
  year: number | null;
  publisher: string | null;
  file_size_bytes: number | null;
  page_count: number | null;
  comment_count: number;
  comments: CommentFeedItem[];
}

export interface CommentFeedResponse {
  book_id: number;
  book_title: string;
  book_author: string;
  book_cover_url: string | null;
  editions: CommentFeedEdition[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export const userCommentsApi = {
  commentedBooks: (username: string) =>
    api.get<CommentedBook[]>(`/users/${username}/commented-books`),

  feed: (
    username: string,
    bookId: number,
    params: { sort?: string; q?: string; page?: number; limit?: number }
  ) =>
    api.get<CommentFeedResponse>(`/users/${username}/comments`, {
      params: { book_id: bookId, ...params },
    }),
};
