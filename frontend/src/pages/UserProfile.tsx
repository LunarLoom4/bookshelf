import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, MessageSquare, Calendar, List, Lock, Globe, Trash2, Plus, BookMarked, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { timeAgo } from "@/utils/time";
import { usersApi } from "@/api";
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
  recent_comments: Comment[];
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
          Reading lists
          <span className="text-sm font-normal font-sans text-gray-400">({lists.length})</span>
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
                <div className="grid grid-cols-2 gap-0.5 w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-paper-100">
                  {(list.cover_urls ?? []).slice(0, 4).map((url: string, i: number) => (
                    <img key={i} src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ))}
                  {Array.from({ length: Math.max(0, 4 - (list.cover_urls?.length ?? 0)) }).map((_, i) => (
                    <div key={`pad-${i}`} className="bg-paper-200" />
                  ))}
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
            Currently reading
            <span className="text-sm font-normal font-sans text-gray-400">({currently_reading.length})</span>
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {currently_reading.map((item: CurrentlyReadingItem) => (
              <Link
                key={item.edition_id}
                to={`/read/${item.edition_id}`}
                className="group flex flex-col gap-1.5"
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
            ))}
          </div>
        </section>
      )}

      {/* Books uploaded */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-ink-400" />
          Books uploaded
          <span className="text-sm font-normal font-sans text-gray-400">({books_uploaded.length})</span>
        </h2>
        {books_uploaded.length === 0 ? (
          <p className="text-sm text-gray-400">No books uploaded yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {books_uploaded.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>

      {/* Recent comments */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-ink-400" />
          Recent comments
          <span className="text-sm font-normal font-sans text-gray-400">
            ({recent_comments.filter(c => !c.is_deleted).length})
          </span>
        </h2>
        {recent_comments.filter(c => !c.is_deleted).length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recent_comments.filter(c => !c.is_deleted).map((comment) => (
              <Link
                key={comment.id}
                to={`/read/${comment.edition_id}`}
                className="card p-4 hover:shadow-md hover:border-ink-200 transition-all block"
              >
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-2 mb-2">
                  {comment.body}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {comment.page_number != null && (
                    <span className="page-badge">{`p. ${comment.page_number}`}</span>
                  )}
                  <span>{timeAgo(comment.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <ScrollToTop />
    </div>
  );
}
