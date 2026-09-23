import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessageSquare, List, LockKeyhole, Globe2, Trash2, Plus, BookMarked, Pencil, Check, X, ChevronLeft, ChevronRight, MoreVertical, ChevronRight as ViewAll } from "lucide-react";
import { format } from "date-fns";
import { timeAgo } from "@/utils/time";
import { usersApi, progressApi, userCommentsApi } from "@/api";
import type { CommentedBook } from "@/api";
import toast from "react-hot-toast";
import { BookCard } from "@/components/ui/BookCard";
import {
  useUserReadingLists,
  useMyReadingLists,
  useCreateReadingList,
  useDeleteReadingList,
  useUpdateReadingList,
} from "@/hooks/useBooks";
import { useAuthStore } from "@/stores/authStore";
import { Avatar } from "@/components/ui/Avatar";
import type { User, BookListItem, Comment, ReadingList, CurrentlyReadingItem } from "@/types";

interface UserProfileData {
  user: User;
  books_uploaded: BookListItem[];
  recent_comments: (Comment & { book_title: string; book_id: number; edition_number: number })[];
  currently_reading?: CurrentlyReadingItem[];
}

// ── Cover collage for reading list card ──────────────────────────────────────
function CoverCollage({ urls, size = 48 }: { urls: string[]; size?: number }) {
  const imgs = urls.filter(Boolean).slice(0, 4);
  const n = imgs.length;
  const cls = "w-full h-full object-cover";

  if (n === 0) return <div className="w-full h-full bg-paper-200 dark:bg-gray-700" />;
  if (n === 1) return <img src={imgs[0]} alt="" loading="lazy" className={cls} />;
  if (n === 2) return (
    <div className="flex gap-px w-full h-full">
      {imgs.map((u, i) => <div key={i} className="flex-1 overflow-hidden"><img src={u} alt="" loading="lazy" className={cls} /></div>)}
    </div>
  );
  if (n === 3) return (
    <div className="flex flex-col gap-px w-full h-full">
      <div className="flex gap-px flex-1">{[imgs[0], imgs[1]].map((u, i) => <div key={i} className="flex-1 overflow-hidden"><img src={u} alt="" loading="lazy" className={cls} /></div>)}</div>
      <div className="flex justify-center flex-1"><div className="w-1/2 overflow-hidden"><img src={imgs[2]} alt="" loading="lazy" className={cls} /></div></div>
    </div>
  );
  return (
    <div className="relative w-full h-full">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="absolute w-1/2 h-1/2 overflow-hidden" style={{ top: i < 2 ? 0 : "50%", left: i % 2 === 0 ? 0 : "50%" }}>
          <img src={imgs[i]} alt="" loading="lazy" className={cls} />
        </div>
      ))}
    </div>
  );
}

// ── Reading Lists section ─────────────────────────────────────────────────────
function ReadingListsSection({ username }: { username: string }) {
  const { user: currentUser } = useAuthStore();
  const isOwnProfile = currentUser?.username === username;

  const { data: publicLists = [], isLoading: loadingPublic } = useUserReadingLists(
    isOwnProfile ? "" : username
  );
  const { data: myLists = [], isLoading: loadingMine } = useMyReadingLists();
  const createList = useCreateReadingList();
  const deleteList = useDeleteReadingList();
  const updateList = useUpdateReadingList();
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(true);

  const allLists: ReadingList[] = isOwnProfile ? myLists : publicLists;
  const loading = isOwnProfile ? loadingMine : loadingPublic;

  // Show only first 6, rest hidden with "+N more" link
  const VISIBLE = 6;
  const lists = allLists.slice(0, VISIBLE);
  const overflow = allLists.length - VISIBLE;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createList.mutateAsync({ name, isPublic: newPublic });
    setNewName("");
    setShowCreate(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-semibold text-ink-900 flex items-center gap-2">
          <List className="w-5 h-5 text-ink-400" />
          Reading Lists <span className="font-serif text-black-400 dark:text-white-500">[{allLists.length}]</span>
        </h2>
        {isOwnProfile && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="btn-secondary py-1.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New List
          </button>
        )}
      </div>

      {isOwnProfile && showCreate && (
        <div className="card p-4 mb-4 flex flex-col gap-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="List name (e.g. Want to Read)"
            className="input"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={newPublic}
              onChange={(e) => setNewPublic(e.target.checked)}
              className="w-4 h-4"
            />
            Public (visible on your profile)
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createList.isPending || !newName.trim()} className="btn-primary py-1.5 text-sm">
              {createList.isPending ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        </div>
      ) : lists.length === 0 ? (
        <p className="text-sm text-gray-400">{isOwnProfile ? "No reading lists yet." : "No public reading lists."}</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lists.map((list) => (
              <div key={list.id} className="card p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-paper-100">
                    <CoverCollage urls={list.cover_urls ?? []} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {editingListId === list.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingName.trim()) { updateList.mutate({ listId: list.id, name: editingName.trim() }); setEditingListId(null); }
                              if (e.key === "Escape") setEditingListId(null);
                            }}
                            className="input py-0.5 text-sm w-36" maxLength={100}
                          />
                          <button onClick={() => { if (editingName.trim()) { updateList.mutate({ listId: list.id, name: editingName.trim() }); } setEditingListId(null); }} className="text-green-600 hover:text-green-700" title="Save"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingListId(null)} className="text-gray-400 hover:text-gray-600" title="Cancel"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <Link to={`/lists/${list.id}`} className="font-medium text-sm text-ink-900 truncate hover:text-ink-600 hover:underline">
                          {list.name}
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{list.item_count} {list.item_count === 1 ? "book" : "books"} · Updated {timeAgo(list.updated_at, true)}</p>
                  </div>
                </div>
                {isOwnProfile && (
                  <div className="flex items-center gap-2 flex-shrink-0 self-center" ref={openMenuId === list.id ? menuRef : undefined}>
                    {list.is_public ? <Globe2 className="w-4 h-4 text-ink-500 dark:text-indigo-400 flex-shrink-0" title="Public" /> : <LockKeyhole className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" title="Private" />}
                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === list.id ? null : list.id)} className="p-1 rounded-md text-gray-400 hover:text-ink-700 hover:bg-paper-100 dark:hover:bg-gray-700 transition-colors" title="More options">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === list.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden py-1">
                          {confirmDeleteId === list.id ? (
                            <div className="px-3 py-2.5">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Delete this list?</p>
                              <div className="flex gap-2">
                                <button onClick={() => { deleteList.mutate(list.id); setOpenMenuId(null); setConfirmDeleteId(null); }} disabled={deleteList.isPending} className="flex-1 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">Delete</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => { setEditingListId(list.id); setEditingName(list.name); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-paper-100 dark:hover:bg-gray-800 transition-colors">
                                <Pencil className="w-3.5 h-3.5 text-gray-400" />Rename
                              </button>
                              <button onClick={() => { updateList.mutate({ listId: list.id, isPublic: !list.is_public }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-paper-100 dark:hover:bg-gray-800 transition-colors">
                                {list.is_public ? <LockKeyhole className="w-3.5 h-3.5 text-amber-500" /> : <Globe2 className="w-3.5 h-3.5 text-ink-500" />}
                                {list.is_public ? "Make Private" : "Make Public"}
                              </button>
                              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                              <button onClick={() => setConfirmDeleteId(list.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />Delete List
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* +N more link */}
          {overflow > 0 && (
            <div className="flex justify-end mt-3">
              <Link to={`/u/${username}/lists`} className="text-sm text-ink-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                +{overflow} more {overflow === 1 ? "list" : "lists"}
                <ViewAll className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Horizontal scroll row ─────────────────────────────────────────────────────
const CARD_W = 140;
const CARD_GAP = 12;

function HorizontalScrollRow({ children, itemCount }: { children: React.ReactNode; itemCount: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateArrows); ro.disconnect(); };
  }, [updateArrows, itemCount]);

  const scroll = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth - (CARD_W + CARD_GAP), CARD_W + CARD_GAP);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button onClick={() => scroll("left")} aria-label="Scroll left"
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600 flex items-center justify-center text-ink-700 dark:text-gray-200 transition-opacity duration-200 ${canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <style>{`[data-hsr-track]::-webkit-scrollbar{display:none}`}</style>
      <div ref={trackRef} data-hsr-track="" className="flex overflow-x-auto pb-1" style={{ gap: CARD_GAP, scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {children}
      </div>
      <button onClick={() => scroll("right")} aria-label="Scroll right"
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600 flex items-center justify-center text-ink-700 dark:text-gray-200 transition-opacity duration-200 ${canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Section header with "View all" link ───────────────────────────────────────
function SectionHeader({ icon, title, count, viewAllHref, viewAllLabel }: {
  icon: React.ReactNode; title: string; count: number; viewAllHref?: string; viewAllLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-serif text-xl font-semibold text-ink-900 flex items-center gap-2">
        {icon}
        {title} <span className="font-serif text-black-400 dark:text-white-500">[{count}]</span>
      </h2>
      {viewAllHref && count > 0 && (
        <Link to={viewAllHref} className="text-sm text-ink-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
          {viewAllLabel ?? "View all"}
          <ViewAll className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

// ── Uniform portrait card (used for both Currently Reading and Comments) ──────
// Width: CARD_W (140px). Aspect ratio 3:4 (portrait book cover). Same card, different data.
function PortraitCard({ coverUrl, title, subtitle, badge, footer, href, onRemove }: {
  coverUrl?: string | null; title: string; subtitle?: string;
  badge?: React.ReactNode; footer?: React.ReactNode;
  href: string; onRemove?: () => void;
}) {
  return (
    <div className="group relative flex flex-col gap-1.5 flex-shrink-0" style={{ width: CARD_W }}>
      <Link to={href} className="flex flex-col gap-1.5">
        <div className="rounded-md overflow-hidden bg-paper-100 dark:bg-gray-800 relative" style={{ width: CARD_W, height: Math.round(CARD_W * 4 / 3) }}>
          {coverUrl ? (
            <img src={coverUrl} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-gray-300 dark:text-gray-600" />
            </div>
          )}
          {badge && (
            <div className="absolute bottom-1.5 right-1.5">{badge}</div>
          )}
        </div>
        <p className="text-xs font-medium text-ink-900 dark:text-gray-100 line-clamp-2 leading-tight">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">{subtitle}</p>}
        {footer && <div className="mt-0.5">{footer}</div>}
      </Link>
      {onRemove && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          title="Remove"
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main UserProfile ──────────────────────────────────────────────────────────
export default function UserProfile() {
  const { username } = useParams<{ username: string }>();

  const { data, isLoading, error } = useQuery<UserProfileData>({
    queryKey: ["user", username],
    queryFn: () => usersApi.profile(username!).then((r) => r.data),
    enabled: !!username,
    staleTime: 0,
  });

  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();

  const { data: commentedBooks = [] } = useQuery<CommentedBook[]>({
    queryKey: ["commented-books", username],
    queryFn: () => userCommentsApi.commentedBooks(username!).then(r => r.data),
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const removeProgress = useMutation({
    mutationFn: (editionId: number) => progressApi.delete(editionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", username] });
      toast.success("Removed from currently reading");
    },
    onError: () => toast.error("Failed to remove"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" /></div>;
  }

  if (error || !data) {
    return <div className="text-center py-20 text-gray-400 text-sm">User not found.</div>;
  }

  const { user, books_uploaded, currently_reading = [] } = data;
  const isOwnProfile = currentUser?.username === username;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-10">
      {/* Header */}
      <div className="flex items-center gap-5">
        <Avatar username={user.username} avatarUrl={user.avatar_url} size="lg" />
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">{user.username}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Member since {format(new Date(user.created_at), "MMMM yyyy")}</p>
        </div>
      </div>

      {/* 1. Reading Lists */}
      <ReadingListsSection username={username!} />

      {/* 2. Currently Reading */}
      {currently_reading.length > 0 && (
        <section>
          <SectionHeader
            icon={<BookMarked className="w-5 h-5 text-ink-400" />}
            title="Currently Reading"
            count={currently_reading.length}
            viewAllHref={`/u/${username}/reading`}
            viewAllLabel="View all"
          />
          <HorizontalScrollRow itemCount={currently_reading.length}>
            {currently_reading.map((item: CurrentlyReadingItem) => (
              <PortraitCard
                key={item.edition_id}
                href={`/read/${item.edition_id}`}
                coverUrl={item.book_cover_url}
                title={item.book_title}
                badge={
                  <span className="bg-black/65 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    p.{item.last_page}
                  </span>
                }
                onRemove={isOwnProfile ? () => removeProgress.mutate(item.edition_id) : undefined}
              />
            ))}
          </HorizontalScrollRow>
        </section>
      )}

      {/* 3. Comments */}
      {commentedBooks.length > 0 && (
        <section>
          <SectionHeader
            icon={<MessageSquare className="w-5 h-5 text-ink-400" />}
            title="Comments"
            count={commentedBooks.length}
            viewAllHref={`/u/${username}/comments`}
            viewAllLabel="View all"
          />
          <HorizontalScrollRow itemCount={commentedBooks.length}>
            {commentedBooks.map((book: CommentedBook) => (
              <PortraitCard
                key={book.book_id}
                href={`/u/${username}/comments/${book.book_id}`}
                coverUrl={book.cover_url}
                title={book.title}
                subtitle={book.author}
                badge={
                  <div className="flex items-center gap-1 bg-black/65 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    <MessageSquare className="w-2.5 h-2.5" />
                    {book.total_comments}
                  </div>
                }
                footer={
                  book.editions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {book.editions.slice(0, 2).map(ed => (
                        <span key={ed.edition_id} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 dark:bg-ink-900/30 text-ink-500 dark:text-indigo-300 whitespace-nowrap">
                          E{ed.edition_number}·{ed.comment_count}
                        </span>
                      ))}
                      {book.editions.length > 2 && (
                        <span className="text-[10px] text-gray-400 px-0.5 py-0.5">+{book.editions.length - 2}</span>
                      )}
                    </div>
                  ) : null
                }
              />
            ))}
          </HorizontalScrollRow>
        </section>
      )}

      {/* 4. Books Uploaded */}
      <section>
        <SectionHeader
          icon={<BookOpen className="w-5 h-5 text-ink-400" />}
          title="Books Uploaded"
          count={books_uploaded.length}
        />
        {books_uploaded.length === 0 ? (
          <p className="text-sm text-gray-400">No books uploaded yet.</p>
        ) : (
          <HorizontalScrollRow itemCount={books_uploaded.length}>
            {books_uploaded.map((book) => (
              <div key={book.id} className="flex-shrink-0" style={{ width: 200 }}>
                <BookCard book={book} />
              </div>
            ))}
          </HorizontalScrollRow>
        )}
      </section>

      <ScrollToTop />
    </div>
  );
}
