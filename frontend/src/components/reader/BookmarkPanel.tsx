import { useState } from "react";
import { Bookmark, Trash2, Edit2, Check, X, Plus } from "lucide-react";
import { timeAgo } from "@/utils/time";
import type { Bookmark as BookmarkType } from "@/types";
import {
  useBookmarks,
  useCreateBookmark,
  useUpdateBookmark,
  useDeleteBookmark,
} from "@/hooks/useBooks";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  editionId: number;
  currentPage: number;
  onJumpToPage: (page: number) => void;
}

function BookmarkRow({
  bookmark,
  editionId,
  onJumpToPage,
}: {
  bookmark: BookmarkType;
  editionId: number;
  onJumpToPage: (page: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(bookmark.note ?? "");
  const updateBookmark = useUpdateBookmark(editionId);
  const deleteBookmark = useDeleteBookmark(editionId);

  const handleSave = async () => {
    await updateBookmark.mutateAsync({ bookmarkId: bookmark.id, note: note.trim() || null });
    setEditing(false);
  };

  const handleCancel = () => {
    setNote(bookmark.note ?? "");
    setEditing(false);
  };

  return (
    <div className="py-2.5 border-b border-paper-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onJumpToPage(bookmark.page_number)}
          className="page-badge flex-shrink-0 mt-0.5" title="Jump to this page"
        >
          p. {bookmark.page_number}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full text-xs input py-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
          ) : (
            <p className="text-xs text-gray-500 truncate">
              {bookmark.note || (
                <span className="text-gray-300 italic">No note</span>
              )}
            </p>
          )}
          <p className="text-xs text-gray-300 mt-0.5">
            {timeAgo(bookmark.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={updateBookmark.isPending}
                className="text-ink-600 hover:text-ink-800 transition-colors"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-gray-400 hover:text-ink-600 transition-colors"
                title="Edit note"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteBookmark.mutate(bookmark.id)}
                disabled={deleteBookmark.isPending}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Delete bookmark"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function BookmarkPanel({ editionId, currentPage, onJumpToPage }: Props) {
  const { isAuthenticated } = useAuthStore();
  const { data: bookmarks = [], isLoading } = useBookmarks(editionId, isAuthenticated);
  const createBookmark = useCreateBookmark(editionId);
  const [addNote, setAddNote] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">
        Sign in to use bookmarks.
      </div>
    );
  }

  const alreadyBookmarked = bookmarks.some((b) => b.page_number === currentPage);

  const handleAdd = async () => {
    await createBookmark.mutateAsync({
      pageNumber: currentPage,
      note: addNote.trim() || undefined,
    });
    setAddNote("");
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Add bookmark for current page */}
      {!alreadyBookmarked && (
        <div>
          {showAdd ? (
            <div className="flex gap-1.5 items-center">
              <input
                autoFocus
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder={`Bookmark p.${currentPage} (add a note, optional)`}
                className="input text-xs py-1.5 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setShowAdd(false);
                }}
              />
              <button
                onClick={handleAdd}
                disabled={createBookmark.isPending}
                className="btn-primary py-1.5 px-2 text-xs"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 w-full justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Bookmark page {currentPage}
            </button>
          )}
        </div>
      )}
      {alreadyBookmarked && (
        <p className="text-xs text-ink-600 text-center py-1 flex items-center justify-center gap-1">
          <Bookmark className="w-3.5 h-3.5 fill-ink-600" />
          Page {currentPage} is bookmarked
        </p>
      )}

      {/* Bookmark list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-ink-200 border-t-ink-500 rounded-full animate-spin" />
        </div>
      ) : bookmarks.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">No bookmarks yet.</p>
      ) : (
        <div>
          {bookmarks.map((bm) => (
            <BookmarkRow
              key={bm.id}
              bookmark={bm}
              editionId={editionId}
              onJumpToPage={onJumpToPage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
