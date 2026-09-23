import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "react-router-dom";

interface Props {
  onSubmit: (body: string, pageNumber?: number, parentId?: number) => Promise<void>;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  parentId?: number;
  currentPage?: number;
  placeholder?: string;
  autoFocusPage?: boolean;
}

export function CommentBox({ onSubmit, onCancel, parentId, currentPage, placeholder, autoFocusPage, onChange }: Props) {
  const { isAuthenticated } = useAuthStore();
  const [body, setBody] = useState("");
  const [pageEnabled, setPageEnabled] = useState(false);
  const [pageNumber, setPageNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const pageFieldDirty = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When page checkbox is first enabled, pre-fill with current page
  useEffect(() => {
    if (pageEnabled && !pageFieldDirty.current && currentPage) {
      setPageNumber(String(currentPage));
    }
    if (!pageEnabled) {
      setPageNumber("");
      pageFieldDirty.current = false;
    }
  }, [pageEnabled, currentPage]);

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        <Link to="/login" className="text-ink-600 hover:underline">Sign in</Link>{" "}
        to leave a comment.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      const pn = pageEnabled && pageNumber ? parseInt(pageNumber, 10) : undefined;
      await onSubmit(body.trim(), isNaN(pn!) ? undefined : pn, parentId);
      onChange?.("");
      setBody("");
      setPageEnabled(false);
      setPageNumber("");
      pageFieldDirty.current = false;
    } finally {
      setLoading(false);
    }
  };

  const suggestedMention = placeholder?.startsWith("@") ? placeholder.trim() : null;
  const isReply = !!suggestedMention;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => { setBody(e.target.value); onChange?.(e.target.value); }}
        onKeyDown={(e) => {
          // Escape: blur the textarea (defocus), text stays intact
          if (e.key === "Escape") {
            e.preventDefault();
            textareaRef.current?.blur();
            return;
          }
          // Tab autocomplete: if body is empty and there's a suggested @mention, insert it
          if (e.key === "Tab" && suggestedMention && !body) {
            e.preventDefault();
            setBody(suggestedMention + " ");
            onChange?.(suggestedMention + " ");
            return;
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (body.trim() && !loading) handleSubmit(e as any);
          }
        }}
        placeholder={isReply ? `Reply to ${suggestedMention}... (Tab to mention)` : "Write a comment..."}
        rows={3}
        className="input resize-none text-sm"
      />

      <div className="flex items-center justify-between">
        {/* Page number -- gated behind a checkbox */}
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-400 hover:text-gray-600">
            <input
              type="checkbox"
              checked={pageEnabled}
              onChange={(e) => setPageEnabled(e.target.checked)}
              className="w-3.5 h-3.5 accent-ink-600 cursor-pointer"
            />
            Page
          </label>
          {pageEnabled && (
            <input
              type="number"
              min={1}
              value={pageNumber}
              onChange={(e) => { pageFieldDirty.current = true; setPageNumber(e.target.value); }}
              placeholder={currentPage ? String(currentPage) : "—"}
              autoFocus={autoFocusPage}
              className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-xs
                         text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900
                         placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-ink-400"
            />
          )}
        </div>

        {/* Cancel (reply only) + Post */}
        <div className="flex items-center gap-2">
          {isReply && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="btn-primary py-1.5 text-xs"
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
