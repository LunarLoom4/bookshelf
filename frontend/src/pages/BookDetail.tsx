import { useParams, Link, useNavigate } from "react-router-dom";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { useQuery } from "@tanstack/react-query";
import { progressApi } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { BookDetailSkeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { useRef, useState } from "react";
import {
  BookOpen, Layers, User, Calendar, Globe, FileText,
  Upload, Plus, X, CheckCircle, Link2, Download, Table2,
} from "lucide-react";
import { useBook, useUploadCover, useAddEdition, useDeleteBook } from "@/hooks/useBooks";
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

function EditionRow({ edition, bookId, isOwner, onDelete }: {
  edition: Edition;
  bookId: number;
  isOwner: boolean;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteBook = useDeleteBook();
  const { isAuthenticated } = useAuthStore();

  // 20: Fetch reading progress for this edition
  const { data: progress } = useQuery({
    queryKey: ["progress", edition.id],
    queryFn: () => progressApi.get(edition.id).then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const lastPage = progress?.last_page;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteBook.mutateAsync(bookId);
      onDelete();
      toast.success("Book deleted");
    } catch {
      toast.error("Failed to delete book");
    }
  };

  return (
    <div className="card flex items-center justify-between p-4 hover:shadow-md hover:border-ink-200 transition-all duration-150">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-9 h-9 bg-ink-50 rounded-lg flex items-center justify-center text-ink-600 flex-shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">
            Edition {edition.edition_number}
            {edition.year && <span className="text-gray-400 font-normal"> · {edition.year}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-gray-400">
            {edition.publisher && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {edition.publisher}
              </span>
            )}
            {edition.language !== "en" && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {edition.language.toUpperCase()}
              </span>
            )}
            {edition.file_size_bytes != null && (
              <span>{formatBytes(edition.file_size_bytes)}</span>
            )}
            {edition.page_count != null && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {edition.page_count} pages
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {timeAgo(edition.created_at)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {/* 20: Continue from last page if progress exists */}
        {lastPage && lastPage > 1 ? (
          <Link
            to={`/read/${edition.id}`}
            className="btn-primary py-1.5 text-xs"
            title={`Continue from page ${lastPage}`}
          >
            p.{lastPage} ▶
          </Link>
        ) : (
          <Link
            to={`/read/${edition.id}`}
            className="btn-primary py-1.5 text-xs"
          >
            Read
          </Link>
        )}
        {/* 26: Download PDF button */}
        <a
          href={`/api/v1/books/${bookId}/editions/${edition.id}/pdf`}
          download={`${edition.edition_number ? "Edition-" + edition.edition_number : "book"}.pdf`}
          className="btn-secondary py-1.5 text-xs flex items-center gap-1"
          title="Download PDF"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-3.5 h-3.5" />
        </a>
        {isOwner && (
          confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600 font-medium">Delete book?</span>
              <button
                onClick={handleDelete}
                disabled={deleteBook.isPending}
                className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                {deleteBook.isPending ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setConfirmDelete(false); }}
                className="px-2 py-1 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="px-2 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )
        )}
      </div>
    </div>
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
  const fileRef = useRef<HTMLInputElement>(null);
  const addEdition = useAddEdition(bookId);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary py-1.5 text-xs flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Add edition
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
    try {
      await addEdition.mutateAsync(fd);
      toast.success("Edition added");
      setOpen(false);
      setPdfFile(null);
      setEditionNumber("");
      setYear("");
      setPublisher("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed");
    }
  };

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-900">Add new edition</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* PDF pick */}
        <div>
          <label className="label">PDF file <span className="text-red-400">*</span></label>
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

        <button
          type="submit"
          disabled={addEdition.isPending || !pdfFile}
          className="btn-primary justify-center py-2"
        >
          {addEdition.isPending ? "Uploading…" : "Upload edition"}
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
  const [copied, setCopied] = useState(false); // must be before early returns
  const [showComparison, setShowComparison] = useState(false); // must be before early returns

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
      {/* Book header */}
      <div className="flex flex-col sm:flex-row gap-8 mb-10">
        {/* Cover */}
        <div className="flex-shrink-0 w-40 sm:w-48">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              loading="lazy"
              decoding="async"
              className="w-full rounded-lg shadow-md object-cover aspect-[3/4]"
            />
          ) : (
            <div className="w-full aspect-[3/4] rounded-lg bg-paper-100 flex items-center justify-center text-paper-400">
              <BookOpen className="w-12 h-12" />
            </div>
          )}
          {/* Cover upload -- owner only */}
          {isOwner && <CoverUploadPanel bookId={book.id} />}
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-2 flex-1">
          <h1 className="font-serif text-3xl font-semibold text-ink-900 leading-tight">
            {book.title}
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-gray-500 flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {book.author}
            </p>
            {/* 12: Copy link */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-ink-600 transition-colors"
              title="Copy link to this book"
            >
              <Link2 className="w-3 h-3" />
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          {book.description && (
            <p className="text-sm text-gray-600 leading-relaxed mt-2 max-w-xl">
              {book.description}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-auto pt-3">
            Added on {format(new Date(book.created_at), "MMMM d, yyyy")}
            {book.uploader_username && (
              <> by <Link
                to={`/u/${book.uploader_username}`}
                className="text-ink-600 hover:text-ink-800 font-medium hover:underline"
              >{book.uploader_username}</Link></>
            )}
          </p>
          {/* 19: Recent commenters avatars */}
          {book.recent_commenters?.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-gray-400 leading-none">Discussed by</span>
              <div className="flex items-center -space-x-1.5">
                {book.recent_commenters.slice(0, 8).map((c) => (
                  <Link
                    key={c.username}
                    to={`/u/${c.username}`}
                    title={c.username}
                    className="ring-1.5 ring-white dark:ring-gray-900 rounded-full hover:z-10 hover:scale-110 transition-transform duration-150 flex-shrink-0"
                  >
                    <Avatar username={c.username} avatarUrl={c.avatar_url} size="xs" />
                  </Link>
                ))}
                {book.recent_commenters.length > 8 && (
                  <span className="text-xs text-gray-400 pl-2">+{book.recent_commenters.length - 8}</span>
                )}
              </div>
            </div>
          )}
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
                {showComparison ? "Close table" : "Compare"}
              </button>
            )}
            {user && (
              <AddEditionPanel bookId={book.id} existingNums={existingNums} />
            )}
          </div>
        </div>

        {/* 28: Edition comparison table */}
        {showComparison && book.editions.length > 1 && (
          <div className="overflow-x-auto mb-4 card p-0">
            <table className="w-full text-xs" style={{color: "#111827"}}>
              <thead>
                <tr style={{backgroundColor: "#f8f9fa", color: "#374151"}} className="border-b border-gray-200/60 dark:border-gray-700/40">
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
                  onDelete={() => navigate("/browse")}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
