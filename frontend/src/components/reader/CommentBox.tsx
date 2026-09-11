import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "react-router-dom";
import { Hash } from "lucide-react";

interface Props {
  onSubmit: (body: string, pageNumber?: number, parentId?: number) => Promise<void>;
  parentId?: number;
  currentPage?: number;
  placeholder?: string;
  autoFocusPage?: boolean;
}

export function CommentBox({ onSubmit, parentId, currentPage, placeholder, autoFocusPage }: Props) {
  const { isAuthenticated } = useAuthStore();
  const [body, setBody] = useState("");
  const [pageNumber, setPageNumber] = useState<string>(currentPage ? String(currentPage) : "");
  const [loading, setLoading] = useState(false);
  // Track whether the user has manually edited the page field so we don't
  // overwrite their input when the viewer scrolls to a new page
  const pageFieldDirty = useRef(false);

  useEffect(() => {
    if (!pageFieldDirty.current) {
      setPageNumber(currentPage ? String(currentPage) : "");
    }
  }, [currentPage]);

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
      const pn = pageNumber ? parseInt(pageNumber, 10) : undefined;
      await onSubmit(body.trim(), isNaN(pn!) ? undefined : pn, parentId);
      setBody("");
      setPageNumber("");
      pageFieldDirty.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder || "Write a comment..."}
        rows={3}
        className="input resize-none text-sm"
      />

      <div className="flex items-center justify-between">
        {/* Page number input */}
        <div className="flex items-center gap-1.5 text-sm">
          <Hash className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="number"
            min={1}
            value={pageNumber}
            onChange={(e) => { pageFieldDirty.current = true; setPageNumber(e.target.value); }}
            placeholder="Page"
            autoFocus={autoFocusPage}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-xs text-gray-600
                       placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-ink-400"
          />
          <span className="text-xs text-gray-400">optional</span>
        </div>

        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="btn-primary py-1.5 text-xs"
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
