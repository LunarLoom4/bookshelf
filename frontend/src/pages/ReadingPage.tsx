import { useParams, Link } from "react-router-dom";
import { useRef, useState, useCallback, useEffect } from "react";
import { ArrowLeft, SortAsc, TrendingUp, Bookmark, Maximize, Minimize } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import PDFViewer, { type PDFViewerHandle } from "@/components/reader/PDFViewer";
import { CommentBox } from "@/components/reader/CommentBox";
import { CommentThread } from "@/components/reader/CommentThread";
import { BookmarkPanel } from "@/components/reader/BookmarkPanel";
import {
  useComments, COMMENTS_KEY, useCreateComment, useVoteComment,
  useReadingProgress, useSaveProgress,
} from "@/hooks/useBooks";
import { useAuthStore } from "@/stores/authStore";
import api from "@/api/client";
import { booksApi } from "@/api";
import type { Edition, Book } from "@/types";

function useEdition(editionId: number) {
  return useQuery({
    queryKey: ["edition", editionId],
    queryFn: () =>
      api.get<{ edition: Edition; book: Book }>(`/editions/${editionId}`).then((r) => r.data),
  });
}

type SortMode = "newest" | "top";

const MIN_PDF_PCT = 30;   // PDF panel minimum width %
const MAX_PDF_PCT = 80;   // PDF panel maximum width %
const DEFAULT_PDF_PCT = 62;
type PanelTab = "discussion" | "bookmarks";

// Save progress at most every 3 seconds while the user is reading
const PROGRESS_DEBOUNCE_MS = 3000;

export default function ReadingPage() {
  const { editionId: editionIdStr } = useParams<{ editionId: string }>();
  const editionId = Number(editionIdStr);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const { isAuthenticated } = useAuthStore();
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1); // ref so we can read it in event listeners without stale closure
  const [sort, setSort] = useState<SortMode>("newest");
  const [activeTab, setActiveTab] = useState<PanelTab>("discussion");
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pdfWidthPct, setPdfWidthPct] = useState(DEFAULT_PDF_PCT);
  const [isPdfFullscreen, setIsPdfFullscreen] = useState(false);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPct = useRef(DEFAULT_PDF_PCT);

  // Sync fullscreen state on Escape key
  useEffect(() => {
    const handler = () => setIsPdfFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Refs for direct DOM manipulation during drag -- avoids React re-renders and iframe flicker
  const pdfPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPct = pdfWidthPct;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    // Cover the iframe with a transparent overlay so mouse events aren't captured by it
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;cursor:col-resize;";
    document.body.appendChild(overlay);

    const onMove = (ev: MouseEvent) => {
      const totalW = document.documentElement.clientWidth;
      const delta = ((ev.clientX - startX) / totalW) * 100;
      const next = Math.max(MIN_PDF_PCT, Math.min(MAX_PDF_PCT, startPct + delta));
      // Apply directly to DOM -- no React state, no re-render, no iframe reload
      if (pdfPanelRef.current) pdfPanelRef.current.style.width = `${next}%`;
      if (rightPanelRef.current) rightPanelRef.current.style.width = `${100 - next}%`;
    };

    const onUp = (ev: MouseEvent) => {
      const totalW = document.documentElement.clientWidth;
      const delta = ((ev.clientX - startX) / totalW) * 100;
      const next = Math.max(MIN_PDF_PCT, Math.min(MAX_PDF_PCT, startPct + delta));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.removeChild(overlay);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // Commit final value to React state only once on release
      setPdfWidthPct(next);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pdfWidthPct]);

  const { data, isLoading: loadingEdition, error: editionError } = useEdition(editionId);
  const { data: comments = [], isLoading: loadingComments } = useComments(editionId, sort);
  const { data: savedProgress } = useReadingProgress(editionId, isAuthenticated);
  const saveProgress = useSaveProgress(editionId);
  const createComment = useCreateComment(editionId);
  const voteComment = useVoteComment(editionId);

  // Restore saved progress once PDF iframe loads
  // We use a ref to ensure we only restore once (not on every re-render)
  const progressRestoredRef = useRef(false);
  useEffect(() => {
    if (progressRestoredRef.current) return;
    if (!savedProgress?.last_page || savedProgress.last_page <= 1) return;
    if (!viewerRef.current) return;
    // Small delay to ensure iframe is mounted and ready
    const t = setTimeout(() => {
      viewerRef.current?.goToPage(savedProgress.last_page);
      currentPageRef.current = savedProgress.last_page;
      setCurrentPage(savedProgress.last_page);
      progressRestoredRef.current = true;
    }, 800);
    return () => clearTimeout(t);
  }, [savedProgress?.last_page]);

  // Save progress immediately when called with a page number
  const saveProgressMutate = saveProgress.mutate;

  const saveCurrentProgress = useCallback((page: number) => {
    if (!isAuthenticated || page < 1) return;
    currentPageRef.current = page;
    setCurrentPage(page);
    saveProgressMutate(page);
  }, [isAuthenticated, saveProgressMutate]);

  // handlePageChange: called when user manually sets a page (kept for CommentBox)
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      currentPageRef.current = page;
      if (!isAuthenticated) return;
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      progressTimerRef.current = setTimeout(() => {
        saveProgressMutate(page);
      }, PROGRESS_DEBOUNCE_MS);
    },
    [isAuthenticated, saveProgressMutate]
  );

  // Save progress when the user leaves the page (back button, tab close, navigate away)
  useEffect(() => {
    const saveOnLeave = () => {
      if (isAuthenticated && currentPageRef.current > 0) {
        saveProgressMutate(currentPageRef.current);
      }
    };
    // visibilitychange covers: switching tabs, minimizing, pressing Back
    document.addEventListener("visibilitychange", saveOnLeave);
    // beforeunload covers: closing the tab
    window.addEventListener("beforeunload", saveOnLeave);
    return () => {
      document.removeEventListener("visibilitychange", saveOnLeave);
      window.removeEventListener("beforeunload", saveOnLeave);
      saveOnLeave(); // also save on React unmount (navigating within the SPA)
    };
  }, [isAuthenticated, saveProgressMutate]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  // Keyboard navigation handled natively by the browser PDF viewer

  const handleJumpToPage = useCallback((page: number) => {
    if (!data) return;
    // Save progress immediately when user jumps to a specific page
    saveCurrentProgress(page);
    // Reload the iframe at the target page using #page=N fragment.
    // This reloads the PDF but lands directly on the correct page.
    // Chrome/Edge/Firefox all honour the #page=N fragment on load.
    viewerRef.current?.goToPage(page);
  }, [data, saveCurrentProgress]);

  const handleCommentDeleted = useCallback(() => {
    // Invalidate ALL comment queries for this edition including nested reply queries
    queryClient.invalidateQueries({
      queryKey: [COMMENTS_KEY, editionId],
      exact: false,
      refetchType: "all",  // refetch even inactive (hidden) queries
    });
  }, [editionId]);

  const handleCommentEdited = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [COMMENTS_KEY, editionId],
      exact: false,
      refetchType: "all",
    });
  }, [editionId]);

  const handleNewComment = async (body: string, pageNumber?: number, parentId?: number) => {
    try {
      await createComment.mutateAsync({ body, pageNumber, parentId });
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to post comment");
      throw e;
    }
  };

  const handleVote = (commentId: number, value: 1 | -1) => {
    voteComment.mutate({ commentId, value });
  };

  if (loadingEdition) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (editionError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-4">
        <p className="text-gray-400 text-sm">Edition not found.</p>
        <Link to="/browse" className="text-ink-600 text-sm hover:underline">
          Back to browse
        </Link>
      </div>
    );
  }

  const { edition, book } = data;
  const topLevelComments = comments.filter((c) => c.parent_id === null);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Left: PDF viewer (draggable) ──────────────────────────────────── */}
      <div
        ref={pdfPanelRef}
        className="flex flex-col min-h-0"
        style={{
          // On desktop: use percentage width from drag handle
          // On mobile: full width, fixed height (60vh for PDF, rest for comments)
          width: window.innerWidth >= 768 ? `${pdfWidthPct}%` : "100%",
          height: window.innerWidth < 768 ? "60vh" : undefined,
          minWidth: 0,
          flexShrink: window.innerWidth >= 768 ? undefined : 0,
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-gray-300 text-xs border-b border-gray-700 flex-shrink-0">
          <Link
            to={`/books/${book.id}`}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="truncate max-w-[160px]">{book.title}</span>
          </Link>
          <span className="text-gray-600">/</span>
          <span>Edition {edition.edition_number}</span>
          {edition.year && <span className="text-gray-500">· {edition.year}</span>}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                const el = pdfPanelRef.current;
                if (!el) return;
                if (!document.fullscreenElement) {
                  el.requestFullscreen();
                  setIsPdfFullscreen(true);
                } else {
                  document.exitFullscreen();
                  setIsPdfFullscreen(false);
                }
              }}
              title="Fullscreen PDF (F)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              {isPdfFullscreen
                ? <Minimize className="w-3.5 h-3.5" />
                : <Maximize className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <PDFViewer
            ref={viewerRef}
            url={booksApi.pdfProxyUrl(book.id, edition.id)}
            downloadFilename={`${book.title} - Edition ${edition.edition_number}.pdf`}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* ── Drag handle ───────────────────────────────────────────────────────── */}
      <div
        ref={dragHandleRef}
        onMouseDown={handleDragStart}
        className="hidden md:block w-1.5 flex-shrink-0 bg-gray-300 hover:bg-ink-500 active:bg-ink-600 cursor-col-resize transition-colors duration-100"
        title="Drag to resize panels"
      />

      {/* ── Right: Discussion + Bookmarks panel ────────────────────────────── */}
      <div
        ref={rightPanelRef}
        className="flex flex-col border-t md:border-t-0 md:border-l border-paper-200 bg-white discussion-panel flex-1 min-h-0"
        style={{ width: `${100 - pdfWidthPct}%`, minWidth: 0 }}
      >
        {/* Tab bar */}
        <div className="flex-shrink-0 border-b border-paper-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab("discussion")}
              className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "discussion"
                  ? "text-ink-700 border-b-2 border-ink-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <SortAsc className="w-3.5 h-3.5" />
              Discussion
              {comments.length > 0 && (
                <span className="ml-1 text-gray-400 font-normal">{comments.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "bookmarks"
                  ? "text-ink-700 border-b-2 border-ink-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Bookmarks
            </button>
          </div>
        </div>

        {/* ── Discussion tab ── */}
        {activeTab === "discussion" && (
          <>
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-paper-200 flex items-center justify-end gap-1 discussion-panel">
              <button
                onClick={() => setSort("newest")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  sort === "newest" ? "bg-ink-100 text-ink-700" : "text-gray-400 hover:text-ink-600"
                }`}
              >
                <SortAsc className="w-3.5 h-3.5" />
                Newest
              </button>
              <button
                onClick={() => setSort("top")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  sort === "top" ? "bg-ink-100 text-ink-700" : "text-gray-400 hover:text-ink-600"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Top
              </button>
            </div>
            <div className="flex-shrink-0 px-4 py-3 border-b border-paper-200 bg-paper-50">
              <CommentBox onSubmit={handleNewComment} currentPage={currentPage} />
            </div>
            <div className="flex-1 overflow-y-auto px-4 divide-y divide-paper-100">
              {loadingComments ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-4 border-ink-100 border-t-ink-500 rounded-full animate-spin" />
                </div>
              ) : topLevelComments.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No comments yet. Be the first to start the discussion.
                </div>
              ) : (
                topLevelComments.map((comment) => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    editionId={editionId}
                    onVote={handleVote}
                    onReply={handleNewComment}
                    onJumpToPage={handleJumpToPage}
                    onCommentDeleted={handleCommentDeleted}
                    onCommentEdited={handleCommentEdited}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ── Bookmarks tab ── */}
        {activeTab === "bookmarks" && (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <BookmarkPanel
              editionId={editionId}
              currentPage={currentPage}
              onJumpToPage={handleJumpToPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
