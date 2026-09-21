import { useState } from "react";
import { List, Plus, Check, Loader2, Lock, Globe } from "lucide-react";
import { useMyReadingLists, useCreateReadingList, useAddToReadingList, useRemoveFromReadingList } from "@/hooks/useBooks";
import { useAuthStore } from "@/stores/authStore";
import type { ReadingList } from "@/types";

interface Props {
  bookId: number;
}

export function AddToListPanel({ bookId }: Props) {
  const { isAuthenticated } = useAuthStore();
  const { data: lists = [], isLoading } = useMyReadingLists();
  const createList = useCreateReadingList();
  const addBook = useAddToReadingList();
  const removeBook = useRemoveFromReadingList();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;

  // Which lists already contain this book (we don't have per-list book membership
  // from the API in this view, so we optimistically track via mutation state)
  // For simplicity: all list manipulation is tracked locally via React Query cache

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createList.mutateAsync({ name, isPublic: newPublic });
    setNewName("");
    setShowCreate(false);
  };

  const handleAddToList = async (list: ReadingList) => {
    await addBook.mutateAsync({ listId: list.id, bookId });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary py-1.5 text-xs flex items-center gap-1.5"
      >
        <List className="w-3.5 h-3.5" />
        Add to List
      </button>
    );
  }

  return (
    <div className="card p-3 w-56 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-900">Add to reading list</span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      ) : lists.length === 0 ? (
        <p className="text-xs text-gray-400">No lists yet.</p>
      ) : (
        <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => handleAddToList(list)}
              disabled={addBook.isPending}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-paper-100 transition-colors text-left w-full"
            >
              {list.is_public ? (
                <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
              ) : (
                <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
              )}
              <span className="text-xs text-gray-700 truncate flex-1">{list.name}</span>
              <span className="text-xs text-gray-400">{list.item_count}</span>
            </button>
          ))}
        </div>
      )}

      {showCreate ? (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-paper-200">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="List name"
            className="input text-xs py-1"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={newPublic}
              onChange={(e) => setNewPublic(e.target.checked)}
              className="w-3 h-3"
            />
            Public
          </label>
          <button
            onClick={handleCreate}
            disabled={createList.isPending || !newName.trim()}
            className="btn-primary py-1 text-xs justify-center"
          >
            {createList.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs text-ink-600 hover:text-ink-800 transition-colors pt-1 border-t border-paper-200"
        >
          <Plus className="w-3.5 h-3.5" />
          New list
        </button>
      )}
    </div>
  );
}
