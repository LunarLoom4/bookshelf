import React, { useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { progressApi, likesApi, bookLikesApi, reportsApi } from "@/api";
import api from "@/api/client";
import { RichTextEditor, type RichTextEditorRef } from "@/components/ui/RichTextEditor";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { useAuthStore } from "@/stores/authStore";
import { BookDetailSkeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { useRef, useState, useEffect } from "react";
import {
  BookOpen, Layers, User, Globe,
  Upload, Plus, X, CheckCircle, Link2, Download, Table2,
  Heart, MoreVertical, Trash2, MessageSquare, Pencil, Info,
} from "lucide-react";
import { useBook, useUploadCover, useAddEdition, BOOKS_KEY } from "@/hooks/useBooks";
import { format } from "date-fns";
import { timeAgo } from "@/utils/time";
import toast from "react-hot-toast";
import type { Edition } from "@/types";
import { AddToListPanel } from "@/components/ui/AddToListPanel";
import { booksApi } from "@/api";

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TotalLikesBadge({ bookId }: { bookId: number }) {
  const { data: total } = useQuery({
    queryKey: ["book-likes", bookId],
    queryFn: () => bookLikesApi.total(bookId).then(r => r.data),
    staleTime: 60 * 1000,
  });
  if (!total) return null;
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
      <Heart className="w-3 h-3 fill-red-400 text-red-400" />
      {total}
    </div>
  );
}

function EditionRow({ edition, bookId, isOwner, onDelete, onEditInfo, totalEditions }: {
  edition: Edition;
  bookId: number;
  isOwner: boolean;
  onDelete: () => void;
  onEditInfo: () => void;
  totalEditions: number;
}) {
  const [showEditionDeleteModal, setShowEditionDeleteModal] = useState(false);
  const [showBookDeleteModal, setShowBookDeleteModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [reportSubject, setReportSubject] = useState("");
  const [reportHtml, setReportHtml] = useState("");
  const editorRef = useRef<RichTextEditorRef>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const sendReport = useMutation({
    mutationFn: () => reportsApi.send(bookId, edition.id, reportSubject, reportHtml),
    onSuccess: () => {
      closeNotifyModal();
      toast.success("Report sent to the uploader");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed to send report"),
  });

  const closeNotifyModal = () => {
    setShowNotifyModal(false);
    setReportSubject("");
    setReportHtml("");
    editorRef.current?.clear();
  };
  const menuRef = useRef<HTMLDivElement>(null);
  const isLastEdition = totalEditions === 1;
  const navigate = useNavigate();

  const deleteEdition = useMutation({
    mutationFn: () => booksApi.deleteEdition(bookId, edition.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BOOKS_KEY, bookId] });
      qc.invalidateQueries({ queryKey: [BOOKS_KEY] });
      onDelete();
      toast.success("Edition deleted");
    },
    onError: () => toast.error("Failed to delete edition"),
  });

  const deleteBook = useMutation({
    mutationFn: () => booksApi.delete(bookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BOOKS_KEY] });
      toast.success("Book deleted");
      navigate("/browse");
    },
    onError: () => toast.error("Failed to delete book"),
  });
  const qc = useQueryClient();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const { data: progress } = useQuery({
    queryKey: ["progress", edition.id],
    queryFn: () => progressApi.get(edition.id).then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const lastPage = progress?.last_page;

  const { data: likeStatus } = useQuery({
    queryKey: ["like", edition.id],
    queryFn: () => likesApi.status(edition.id).then((r) => r.data),
    staleTime: 60 * 1000,
  });

  const toggleLike = useMutation({
    mutationFn: () => likesApi.toggle(edition.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["like", edition.id] });
      const prev = qc.getQueryData(["like", edition.id]);
      qc.setQueryData(["like", edition.id], (old: any) =>
        old ? { liked: !old.liked, count: old.liked ? old.count - 1 : old.count + 1 } : old
      );
      return { prev };
    },
    onError: (_e: any, _v: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["like", edition.id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["like", edition.id] });
      qc.invalidateQueries({ queryKey: ["book-likes", bookId] });
    },
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLastEdition) {
      deleteBook.mutate();
    } else {
      deleteEdition.mutate();
    }
  };

  const liked = likeStatus?.liked ?? false;
  const likeCount = likeStatus?.count ?? 0;

  return (
    <>
    <div className="card flex items-center justify-between p-4 hover:shadow-md hover:border-ink-200 transition-all duration-150">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-9 h-9 bg-ink-50 dark:bg-ink-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-ink-600 dark:text-indigo-300">E{edition.edition_number}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-ink-900 dark:text-gray-100">Edition {edition.edition_number}</p>
            {edition.year && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 leading-none">
                {edition.year}
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap mt-1 text-xs">
            {(() => {
              const items: React.ReactNode[] = [];
              if (edition.publisher) items.push(
                <span key="pub" className="font-medium text-gray-500 dark:text-gray-400">{edition.publisher}</span>
              );
              if (edition.file_size_bytes != null) items.push(
                <span key="size" className="text-gray-400 dark:text-gray-500">{formatBytes(edition.file_size_bytes)}</span>
              );
              if (edition.page_count != null) items.push(
                <span key="pages" className="text-gray-400 dark:text-gray-500">
                  <span className="font-medium text-gray-500 dark:text-gray-400">{edition.page_count.toLocaleString()}</span> pp
                </span>
              );
              if (edition.language !== "en") items.push(
                <span key="lang" className="text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px]">{edition.language}</span>
              );
              items.push(
                <span key="age" className="text-gray-400 dark:text-gray-500">{timeAgo(edition.created_at)}</span>
              );
              if ((edition as any).comment_count > 0) items.push(
                <span key="comments" className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                  <MessageSquare className="w-3 h-3" />
                  {(edition as any).comment_count}
                </span>
              );
              return items.map((item, i) => (
                <span key={i} className="flex items-center">
                  {i > 0 && <span className="text-gray-300 dark:text-gray-600 mx-1.5">·</span>}
                  {item}
                </span>
              ));
            })()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {lastPage && lastPage > 1 ? (
          <Link to={`/read/${edition.id}`} className="btn-primary py-1.5 text-xs" title={`Continue from page ${lastPage}`}>p.{lastPage} ▶</Link>
        ) : (
          <Link to={`/read/${edition.id}`} className="btn-primary py-1.5 text-xs">Read</Link>
        )}

        <button
          onClick={() => { if (!isAuthenticated) { toast.error("Sign in to like"); return; } toggleLike.mutate(); }}
          disabled={toggleLike.isPending}
          title={liked ? "Unlike" : "Like this edition"}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-all
            ${liked
              ? "bg-red-50 border-red-200 text-red-500 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
              : "border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-400 dark:border-gray-700 dark:text-gray-400"
            }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} />
          {likeCount > 0 && <span className="font-medium">{likeCount}</span>}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-gray-400 hover:text-ink-700 rounded-md hover:bg-paper-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
              <>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => { setMenuOpen(false); onEditInfo(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-paper-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                        Edit Info
                      </button>
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    </>
                  )}
                  <a
                    href={`/api/v1/books/${bookId}/editions/${edition.id}/pdf?download=1`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-paper-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-400" />
                    Download PDF
                  </a>
                  {!isOwner && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          if (!isAuthenticated) {
                            setShowAuthPrompt(true);
                          } else {
                            setShowNotifyModal(true);
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-600 dark:text-indigo-300 hover:bg-paper-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Info className="w-3.5 h-3.5" />
                        Notify Uploader
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                      <button onClick={() => {
                          setMenuOpen(false);
                          if (isLastEdition) {
                            setShowBookDeleteModal(true);
                          } else {
                            setShowEditionDeleteModal(true);
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Edition
                      </button>
                    </>
                  )}
                </>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Auth prompt modal -- shown when non-logged-in user clicks Notify Uploader */}
    {showAuthPrompt && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowAuthPrompt(false)}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-6 relative"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => setShowAuthPrompt(false)}
            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100 mb-2">
            Sign in to notify the uploader
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            You need an account to send a report. It only takes a minute.
          </p>
          <div className="flex flex-col gap-2">
            <a href="/login"
              className="flex items-center justify-center py-2 px-4 rounded-md bg-ink-700 text-white text-sm font-medium hover:bg-ink-800 transition-colors text-center">
              Sign In
            </a>
            <a href="/register"
              className="flex items-center justify-center py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center">
              Create Account
            </a>
          </div>
        </div>
      </div>
    )}

    {/* Notify Uploader modal -- rich text report form */}
    {showNotifyModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={closeNotifyModal}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100">
                Notify Uploader
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Edition {edition.edition_number} · Sent to email</p>
            </div>
            <button onClick={closeNotifyModal}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={reportSubject}
                onChange={e => setReportSubject(e.target.value)}
                maxLength={200}
                placeholder="e.g. Wrong author name / Incorrect edition year / Missing publisher"
                className="input w-full text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">{reportSubject.length}/200</p>
            </div>

            {/* Rich text message */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Details <span className="text-red-400">*</span>
              </label>
              <RichTextEditor
                ref={editorRef}
                placeholder="Describe the issue clearly. You can attach screenshots, paste links, use bold for emphasis, or add bullet points."
                onHtmlChange={setReportHtml}
                minHeight={180}
                maxHeight={280}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Supports bold, italic, lists, links, and inline images (max 2 MB each).
              </p>
            </div>

            {/* What happens note */}
            <div className="flex gap-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg px-3 py-2.5">
              <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                Your report is sent directly to the uploader. Your username will be included.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={closeNotifyModal}
              className="btn-secondary py-2 px-4 text-sm w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              disabled={!reportSubject.trim() || !reportHtml.trim() || sendReport.isPending}
              onClick={() => sendReport.mutate()}
              className="py-2 px-4 text-sm font-medium rounded-md bg-ink-700 hover:bg-ink-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Info className="w-3.5 h-3.5" />
              {sendReport.isPending ? "Sending..." : "Send Report"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Centered modal: delete one edition (book has multiple) */}
    {showEditionDeleteModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowEditionDeleteModal(false)}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 relative"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setShowEditionDeleteModal(false)}
            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="mb-5">
            <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100 mb-2">
              Delete Edition {edition.edition_number}?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will permanently delete this edition and its PDF. Comments and reading history for this edition will also be removed.
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-medium">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              onClick={() => setShowEditionDeleteModal(false)}
              className="btn-secondary py-2 px-4 text-sm w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              disabled={deleteEdition.isPending}
              onClick={() => deleteEdition.mutate()}
              className="py-2 px-4 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              {deleteEdition.isPending ? "Deleting..." : "Delete Edition"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Full-screen modal for deleting the last edition (= deletes the entire book) */}
    {showBookDeleteModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowBookDeleteModal(false)}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 relative"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setShowBookDeleteModal(false)}
            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="mb-5">
            <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100 mb-2">
              Delete this book?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This is the only edition. Deleting it will permanently remove the entire book, its PDF, all comments, and all reading history.
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-medium">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              onClick={() => setShowBookDeleteModal(false)}
              className="btn-secondary py-2 px-4 text-sm w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              disabled={deleteBook.isPending}
              onClick={() => deleteBook.mutate()}
              className="py-2 px-4 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              {deleteBook.isPending ? "Deleting..." : "Delete Book"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Cover upload panel ─────────────────────────────────────────────────────────
function CoverUploadPanel({ bookId }: { bookId: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const uploadCover = useUploadCover(bookId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("cover_file", file);
    try {
      await uploadCover.mutateAsync(fd);
      toast.success("Cover updated");
      setFile(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Cover upload failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <span className="text-xs text-ink-700 truncate max-w-[140px]">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-gray-400 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="submit"
            disabled={uploadCover.isPending}
            className="btn-primary py-1 px-2 text-xs flex items-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {uploadCover.isPending ? "Saving…" : "Save"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload cover
        </button>
      )}
    </form>
  );
}

// ── Add edition panel ─────────────────────────────────────────────────────────
function AddEditionPanel({ bookId, existingNums }: { bookId: number; existingNums: number[] }) {
  const [open, setOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [editionNumber, setEditionNumber] = useState("");
  const [year, setYear] = useState("");
  const [publisher, setPublisher] = useState("");
  const [language, setLanguage] = useState("en");
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary py-1.5 text-xs flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Edition
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) { toast.error("PDF is required"); return; }
    const num = parseInt(editionNumber, 10);
    if (!num || num < 1) { toast.error("Edition number must be a positive integer"); return; }
    if (existingNums.includes(num)) {
      toast.error(`Edition ${num} already exists for this book`);
      return;
    }
    const fd = new FormData();
    fd.append("edition_number", String(num));
    if (year) fd.append("year", year);
    if (publisher) fd.append("publisher", publisher);
    fd.append("language", language || "en");
    fd.append("pdf_file", pdfFile);

    setUploading(true);
    setUploadPct(0);
    try {
      await booksApi.addEditionWithProgress(
        bookId,
        fd,
        (pct) => setUploadPct(pct),
        accessToken || "",
      );
      qc.invalidateQueries({ queryKey: [BOOKS_KEY, bookId] });
      toast.success("Edition added");
      setOpen(false);
      setPdfFile(null);
      setEditionNumber("");
      setYear("");
      setPublisher("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-900">Add New Edition</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* PDF pick */}
        <div>
          <label className="label">PDF File <span className="text-red-400">*</span></label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-paper-300 rounded-lg px-4 py-3 text-sm
                       text-gray-400 cursor-pointer hover:border-ink-300 hover:bg-ink-50 transition-colors"
          >
            {pdfFile ? (
              <span className="text-ink-700">{pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
            ) : (
              "Click to select PDF"
            )}
          </div>
        </div>

        <div className="mb-2">
          <label className="label">Publisher</label>
          <input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className="input"
            placeholder="e.g. McGraw-Hill Education"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Edition # <span className="text-red-400">*</span></label>
            <input
              type="number"
              min={1}
              value={editionNumber}
              onChange={(e) => setEditionNumber(e.target.value)}
              className="input"
              placeholder={String((existingNums.length ? Math.max(...existingNums) : 0) + 1)}
            />
          </div>
          <div>
            <label className="label">Year</label>
            <input
              type="number"
              min={1000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Language</label>
            <LanguagePicker value={language} onChange={setLanguage} />
          </div>
        </div>

        {/* Progress bar -- shown while uploading */}
        {uploading && (
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-ink-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !pdfFile}
          className="btn-primary justify-center py-2"
        >
          {uploading
            ? uploadPct < 100
              ? `Uploading... ${uploadPct}%`
              : "Processing..."
            : "Upload Edition"}
        </button>
      </form>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────
export default function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { data: book, isLoading, error } = useBook(Number(bookId));
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editEditionId, setEditEditionId] = useState<number | null>(null);
  const [editPublisher, setEditPublisher] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editEditionNum, setEditEditionNum] = useState("");
  const [editLanguage, setEditLanguage] = useState("en");

  if (isLoading) {
    return <BookDetailSkeleton />;
  }

  if (error || !book) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-400">
        <p>Book not found.</p>
        <Link to="/browse" className="text-ink-600 text-sm hover:underline mt-2 inline-block">
          Back to browse
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === book.uploader_id;
  const existingNums = book.editions.map((e) => e.edition_number);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Book header -- CSS grid so "Added on" row is always at the cover foot */}
      {/*
        Layout: [cover col] [meta col]
        Meta col is a sub-grid with 4 rows:
          1. title (auto)
          2. author (auto)
          3. description (1fr -- scrolls, never grows beyond its track)
          4. "Added on" (auto -- always at the bottom, level with cover foot)
        The outer grid min-height = cover height (w-48 × 4/3 = 256px on sm).
      */}
      <div className="mb-10 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 items-start">
        {/* Cover */}
        <div className="flex-shrink-0 w-40 sm:w-48 sm:row-span-2">
          <div className="relative group overflow-hidden rounded-lg shadow-md">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={book.title}
                loading="lazy"
                decoding="async"
                className="w-full object-cover aspect-[3/4] group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full aspect-[3/4] bg-paper-100 flex items-center justify-center text-paper-400">
                <BookOpen className="w-12 h-12" />
              </div>
            )}
            {/* Total likes across all editions */}
            {book.editions.length > 0 && (
              <TotalLikesBadge bookId={book.id} />
            )}
            {/* Total comments across all editions */}
            {(book as any).total_comment_count > 0 && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
                <MessageSquare className="w-3 h-3" />
                {(book as any).total_comment_count}
              </div>
            )}
          </div>
          {/* Cover upload -- owner only */}
          {isOwner && <CoverUploadPanel bookId={book.id} />}
        </div>

        {/*
          Meta: 4-row sub-grid.
          Row 3 (description) uses min-h-0 + overflow so it scrolls rather than expanding.
          Row 4 (Added on) is always the last row -- never moves.
          The sub-grid height = cover height because both sit in the same outer grid row
          and the cover's aspect-[3/4] defines the row height.
        */}
        <div
          className="grid grid-rows-[auto_auto_1fr_auto] h-full"
          style={{ minHeight: "calc(192px * 4 / 3)" }}
        >
          {/* Row 1: title + copy link */}
          <div className="flex items-start gap-2">
            <h1 className="font-serif text-3xl font-semibold text-ink-900 dark:text-gray-100 leading-tight flex-1">
              {book.title}
            </h1>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title="Copy link to this book"
              className="flex-shrink-0 mt-1.5 p-1.5 rounded-md text-gray-400 hover:text-ink-600 hover:bg-paper-100 dark:hover:bg-gray-700 transition-colors"
            >
              {copied
                ? <CheckCircle className="w-4 h-4 text-green-500" />
                : <Link2 className="w-4 h-4" />
              }
            </button>
          </div>

          {/* Row 2: author */}
          <div className="mt-1">
            <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {book.author}
            </p>
          </div>

          {/* Row 3: description (scrollable, never pushes row 4) */}
          <div className="min-h-0 overflow-hidden">
            {book.description && (
              <div className="mt-3 h-full max-h-[9rem] overflow-y-auto pr-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {book.description}
                </p>
              </div>
            )}
          </div>

          {/* Row 4: Added on + commenter avatars -- ALWAYS at the bottom */}
          <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Added on <span className="font-medium text-ink-700 dark:text-gray-300">{format(new Date(book.created_at), "MMMM d, yyyy")}</span>
              {book.uploader_username && (
                <> by <Link
                  to={`/u/${book.uploader_username}`}
                  className="font-semibold text-ink-600 dark:text-indigo-400 hover:text-ink-800 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  {book.uploader_username}
                </Link></>
              )}
            </p>
            {book.recent_commenters?.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {book.recent_commenters.slice(0, 5).map((c) => (
                  <Link
                    key={c.username}
                    to={`/u/${c.username}`}
                    title={c.username}
                    className="ring-2 ring-white dark:ring-gray-900 rounded-full hover:z-10 hover:scale-110 transition-transform duration-150 flex-shrink-0"
                  >
                    <Avatar username={c.username} avatarUrl={c.avatar_url} size="xs" />
                  </Link>
                ))}
                {book.recent_commenters.length > 5 && (
                  <span className="text-xs text-gray-400 pl-2">+{book.recent_commenters.length - 5}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editions */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-ink-900 flex items-center gap-2 whitespace-nowrap">
            <Layers className="w-5 h-5 text-ink-400" />
            {book.editions.length} {book.editions.length === 1 ? "edition" : "editions"}
          </h2>
          {/* Actions: stacked on small screens, row on large */}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <AddToListPanel bookId={book.id} />
            {book.editions.length > 1 && (
              <button
                onClick={() => setShowComparison(v => !v)}
                className="btn-secondary py-1.5 text-xs flex items-center gap-1.5"
              >
                <Table2 className="w-3.5 h-3.5" />
                {showComparison ? "Close Table" : "Compare"}
              </button>
            )}
            {user && (
              <AddEditionPanel bookId={book.id} existingNums={existingNums} />
            )}
          </div>
        </div>

        {/* 28: Edition comparison table */}
        {showComparison && book.editions.length > 1 && (
          <div className="overflow-x-auto mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full text-xs text-gray-900 dark:text-gray-100">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300">
                  <th className="text-center px-4 py-2.5 font-semibold">Edition</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Year</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Publisher</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Language</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Size</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Pages</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {[...book.editions].sort((a, b) => b.edition_number - a.edition_number).map((ed) => (
                  <tr key={ed.id} className="border-b border-gray-200/60 dark:border-gray-700/40 last:border-0 hover:bg-paper-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-center font-bold">Edition {ed.edition_number}</td>
                    <td className="px-4 py-2.5 text-center">{ed.year ?? "N/A"}</td>
                    <td className="px-4 py-2.5 text-center">{ed.publisher ?? "N/A"}</td>
                    <td className="px-4 py-2.5 text-center">{ed.language?.toUpperCase() ?? "N/A"}</td>
                    <td className="px-4 py-2.5 text-center">{ed.file_size_bytes ? formatBytes(ed.file_size_bytes) : "N/A"}</td>
                    <td className="px-4 py-2.5 text-center">{ed.page_count ?? "N/A"}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/read/${ed.id}`} className="text-ink-600 hover:underline font-medium block text-center">Read</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {book.editions.length === 0 ? (
          <p className="text-sm text-gray-400">No editions uploaded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...book.editions]
              .sort((a, b) => b.edition_number - a.edition_number)
              .map((ed) => (
                <EditionRow
                  key={ed.id}
                  edition={ed}
                  bookId={book.id}
                  isOwner={isOwner}
                  totalEditions={book.editions.length}
                  onDelete={() => { /* edition removed, query already invalidated */ }}
                  onEditInfo={() => {
                    setEditTitle(book.title);
                    setEditAuthor(book.author);
                    setEditDescription(book.description ?? "");
                    setEditEditionId(ed.id);
                    setEditPublisher(ed.publisher ?? "");
                    setEditYear(ed.year ? String(ed.year) : "");
                    setEditLanguage(ed.language ?? "en");
                    setEditEditionNum(String(ed.edition_number));
                    setShowEditInfo(true);
                  }}
                />
              ))}
          </div>
        )}

      {/* ── Edit Info modal (owner only) ── */}
      {showEditInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowEditInfo(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl flex flex-col max-h-[90vh] min-w-0 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100">Edit Info</h2>
              <button onClick={() => setShowEditInfo(false)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 pb-4 min-w-0">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Title</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input w-full" maxLength={500} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Author</label>
                  <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} className="input w-full" maxLength={500} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Description</label>
                  <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="input w-full resize-y" style={{ minHeight: 160, maxHeight: 250 }} maxLength={2000} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Publisher</label>
                  <input value={editPublisher} onChange={e => setEditPublisher(e.target.value)} className="input w-full" maxLength={300} placeholder="e.g. McGraw-Hill Education" />
                </div>
                <div className="grid grid-cols-2 gap-3 min-w-0">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 truncate">Edition No.</label>
                    <input value={editEditionNum} onChange={e => setEditEditionNum(e.target.value)} className="input w-full min-w-0" placeholder="e.g. 6" type="number" min="1" max="99" />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 truncate">Year</label>
                    <input value={editYear} onChange={e => setEditYear(e.target.value)} className="input w-full min-w-0" placeholder="" type="number" min="1800" max="2099" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Language</label>
                  <LanguagePicker value={editLanguage} onChange={setEditLanguage} />
                </div>
              </div>
            </div>
            {/* Footer: on mobile Cancel is above Save (flex-col); on desktop side-by-side right-aligned */}
            <div className="flex flex-col sm:flex-row items-end sm:justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <button
                onClick={() => setShowEditInfo(false)}
                className="btn-secondary py-2 px-4 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={editSaving || !editTitle.trim() || !editAuthor.trim()}
                onClick={async () => {
                  setEditSaving(true);
                  try {
                    await api.patch(`/books/${book.id}`, {
                      title: editTitle.trim(),
                      author: editAuthor.trim(),
                      description: editDescription.trim() || null,
                    });
                    if (editEditionId) {
                      await api.patch(`/books/${book.id}/editions/${editEditionId}`, {
                        publisher: editPublisher.trim() || null,
                        edition_number: editEditionNum ? Number(editEditionNum) : undefined,
                        year: editYear ? Number(editYear) : null,
                        language: editLanguage || "en",
                      });
                    }
                    toast.success("Book info updated");
                    setShowEditInfo(false);
                    qc.invalidateQueries({ queryKey: [BOOKS_KEY, Number(bookId)] });
                  } catch {
                    toast.error("Failed to update");
                  } finally {
                    setEditSaving(false);
                  }
                }}
                className="btn-primary py-2 px-4 text-sm"
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}