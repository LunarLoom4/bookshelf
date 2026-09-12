export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
  has_password: boolean;
}

export interface Edition {
  id: number;
  book_id: number;
  edition_number: number;
  year: number | null;
  publisher: string | null;
  language: string;
  pdf_url: string;
  file_size_bytes: number | null;
  page_count: number | null;
  created_at: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  uploader_id: number | null;
  uploader_username: string | null;
  created_at: string;
  editions: Edition[];
}

export interface BookListItem {
  id: number;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  uploader_id: number | null;
  created_at: string;
  edition_count: number;
}

export interface CommentAuthor {
  id: number;
  username: string;
  avatar_url: string | null;
}

export interface Comment {
  id: number;
  edition_id: number;
  body: string;
  page_number: number | null;
  parent_id: number | null;
  author: CommentAuthor;
  vote_score: number;
  user_vote: number | null;
  reply_count: number;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_new_user: boolean;
}

export interface ApiError {
  detail: string;
}

// ── Phase 3 ───────────────────────────────────────────────────────────────────
export interface ReadingProgress {
  edition_id: number;
  last_page: number;
  updated_at: string;
}

export interface Bookmark {
  id: number;
  edition_id: number;
  page_number: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingList {
  id: number;
  user_id: number;
  name: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface ReadingListItem {
  id: number;
  book_id: number;
  added_at: string;
  book?: BookListItem | null;
}

export interface ReadingListDetail extends Omit<ReadingList, 'item_count'> {
  user_id: number;
  items: ReadingListItem[];
}
