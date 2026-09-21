import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessageSquare, Calendar, List, Lock, Globe, Trash2, Plus, BookMarked, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { timeAgo } from "@/utils/time";
import { usersApi, progressApi } from "@/api";
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

function ReadingListsSection({ username }: { username: string }) {
  const { user: currentUser } = useAuthStore();
  const isOwnProfile = currentUser?.username === username;

  // Own profile: use mine (includes private). Other: use by-user (public only).
  const { data: publicLists = [], isLoading: loadingPublic } = useUserReadingLists(
    isOwnProfile ? "" : username  // disabled for own profile
  );
  const { data: myLists = [], isLoading: loadingMine } = useMyReadingLists();
  const createList = useCreateReadingList();
  const deleteList = useDeleteReadingList();
  const updateList = useUpdateReadingList();
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(true);

  const lists: ReadingList[] = isOwnProfile ? myLists : publicLists;
  const loading = isOwnProfile ? loadingMine : loadingPublic;

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
          Reading lists <span className="font-normal text-gray-400 dark:text-gray-500">[{lists.length}]</span>
        </h2>
        {isOwnProfile && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="btn-secondary py-1.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New list
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
            <button
              onClick={handleCreate}
              disabled={createList.isPending || !newName.trim()}
              className="btn-primary py-1.5 text-sm"
            >
              {createList.isPending ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        </div>
      ) : lists.length === 0 ? (
        <p className="text-sm text-gray-400">
          {isOwnProfile ? "No reading lists yet." : "No public reading lists."}
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {lists.map((list) => (
            <div key={list.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* 24: Cover collage -- 2x2 grid of up to 4 book covers */}
                <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-paper-100 relative">
                  {[0, 1, 2, 3].map((i) => {
                    const url = (list.cover_urls ?? [])[i];
                    return (
                      <div
                        key={i}
                        className="absolute w-1/2 h-1/2 overflow-hidden"
                        style={{
                          top: i < 2 ? 0 : "50%",
                          left: i % 2 === 0 ? 0 : "50%",
                        }}
                      >
                        {url
                          ? <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-paper-200" />
                        }
                      </div>
                    );
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {list.is_public ? (
                      <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    {editingListId === list.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingName.trim()) {
                                updateList.mutate({ listId: list.id, name: editingName.trim() });
                                setEditingListId(null);
                              }
                              if (e.key === "Escape") setEditingListId(null);
                            }}
                            className="input py-0.5 text-sm w-36"
                            maxLength={100}
                          />
                          <button
                            onClick={() => { if (editingName.trim()) { updateList.mutate({ listId: list.id, name: editingName.trim() }); } setEditingListId(null); }}
                            className="text-green-600 hover:text-green-700"
                            title="Save"
                          ><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingListId(null)} className="text-gray-400 hover:text-gray-600" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Link
                          to={`/lists/${list.id}`}
                          className="font-medium text-sm text-ink-900 truncate hover:text-ink-600 hover:underline"
                        >
                          {list.name}
                        </Link>
                      )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {list.item_count} {list.item_count === 1 ? "book" : "books"} ·{" "}
                    updated {timeAgo(list.updated_at)}
                  </p>
                </div>
              </div>
              {isOwnProfile && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Pencil: rename list */}
                  <button
                    onClick={() => { setEditingListId(list.id); setEditingName(list.name); }}
                    className="text-gray-300 hover:text-ink-600 transition-colors p-0.5"
                    title="Rename list"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteList.mutate(list.id)}
                    disabled={deleteList.isPending}
                    className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
                    title="Delete list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// useState is used inside ReadingListsSection -- needs to be imported

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();

  const { data, isLoading, error } = useQuery<UserProfileData>({
    queryKey: ["user", username],
    queryFn: () => usersApi.profile(username!).then((r) => r.data),
    enabled: !!username,
    staleTime: 0,  // always refetch on mount so avatar is never stale
  });

  // ALL hooks must be declared before any early return -- Rules of Hooks
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();

  const removeProgress = useMutation({
    mutationFn: (editionId: number) => progressApi.delete(editionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", username] });
      toast.success("Removed from currently reading");
    },
    onError: () => toast.error("Failed to remove"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-gray-400 text-sm">User not found.</div>
    );
  }

  const { user, books_uploaded, recent_comments, currently_reading = [] } = data;
  const isOwnProfile = currentUser?.username === username;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-10">
      {/* Header */}
      <div className="flex items-center gap-5">
        <Avatar username={user.username} avatarUrl={user.avatar_url} size="lg" />
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">{user.username}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Member since {format(new Date(user.created_at), "MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Reading lists */}
      <ReadingListsSection username={username!} />

      {/* 17: Currently reading */}
      {currently_reading.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-ink-400" />
            Currently reading <span className="font-normal text-gray-400 dark:text-gray-500">[{currently_reading.length}]</span>
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {currently_reading.map((item: CurrentlyReadingItem) => (
              // Outer div is relative so the X button can be positioned top-right
              // without being inside the Link (clicking X must NOT navigate)
              <div key={item.edition_id} className="group relative flex flex-col gap-1.5">
                <Link
                  to={`/read/${item.edition_id}`}
                  className="flex flex-col gap-1.5"
                  title={`${item.book_title} — last read p.${item.last_page}`}
                >
                  <div className="aspect-[3/4] rounded-md overflow-hidden bg-paper-100 relative">
                    {item.book_cover_url ? (
                      <img
                        src={item.book_cover_url}
                        alt={item.book_title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-paper-400">
                        <BookOpen className="w-6 h-6" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      p.{item.last_page}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-tight">{item.book_title}</p>
                </Link>
                {/* X button: only on own profile, positioned top-right of cover, shown on group hover */}
                {isOwnProfile && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeProgress.mutate(item.edition_id);
                    }}
                    disabled={removeProgress.isPending}
                    title="Remove from currently reading"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Books uploaded */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-ink-400" />
          Books uploaded <span className="font-normal text-gray-400 dark:text-gray-500">[{books_uploaded.length}]</span>
        </h2>
        {books_uploaded.length === 0 ? (
          <p className="text-sm text-gray-400">No books uploaded yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {books_uploaded.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>

      {/* Recent comments -- grouped by book */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-ink-400" />
          Recent comments <span className="font-normal text-gray-400 dark:text-gray-500">[{recent_comments.filter(c => !c.is_deleted).length}]</span>
        </h2>
        {recent_comments.filter(c => !c.is_deleted).length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet.</p>
        ) : (() => {
          // Group comments by book
          const activeComments = recent_comments.filter(c => !c.is_deleted);
          const groups = new Map<number, typeof activeComments>();
          activeComments.forEach(c => {
            const key = c.book_id ?? c.edition_id;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(c);
          });
          return (
            <div className="flex flex-col gap-5">
              {Array.from(groups.entries()).map(([bookId, groupComments]) => (
                <div key={bookId} className="card p-0 overflow-hidden">
                  {/* Book header */}
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between" style={{backgroundColor:"#e8edf5"}}>
                    <Link
                      to={`/books/${groupComments[0].book_id}`}
                      className="text-sm font-semibold hover:underline truncate max-w-xs dark:text-gray-100" style={{color:"#1c3089"}}
                    >
                      {groupComments[0].book_title ?? "Unknown book"}
                    </Link>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {groupComments.length} {groupComments.length === 1 ? "comment" : "comments"}
                    </span>
                  </div>
                  {/* Comments in this book */}
                  <div className="divide-y divide-paper-100 dark:divide-gray-700/50">
                    {groupComments.map((comment) => (
                      <Link
                        key={comment.id}
                        to={`/read/${comment.edition_id}`}
                        className="block px-4 py-3 hover:bg-paper-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <p className="text-sm leading-relaxed line-clamp-2 mb-1.5 dark:text-gray-200" style={{color:"#1f2937"}}>
                          {comment.body}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {comment.edition_number != null && (
                            <span className="dark:text-gray-400" style={{color:"#6b7280"}}>Ed. {comment.edition_number}</span>
                          )}
                          {comment.page_number != null && (
                            <span className="page-badge">{`p. ${comment.page_number}`}</span>
                          )}
                          <span>{timeAgo(comment.created_at)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>
      <ScrollToTop />
    </div>
  );
}
