import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Upload as UploadIcon, FileText, X } from "lucide-react";
import { useUploadBook } from "@/hooks/useBooks";

const schema = z.object({
  title: z.string().min(1, "Required").max(500),
  author: z.string().min(1, "Required").max(255),
  description: z.string().max(2000).optional(),
  edition_number: z.coerce.number().int().min(1).default(1),
  year: z.coerce.number().int().min(1000).max(2100).optional().or(z.literal("")),
  publisher: z.string().max(255).optional(),
  language: z.string().default("en"),
});
type Form = z.infer<typeof schema>;

function FileDrop({
  label,
  accept,
  file,
  onFile,
  onClear,
}: {
  label: string;
  accept: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-paper-300 rounded-lg p-6 text-center cursor-pointer
                 hover:border-ink-300 hover:bg-ink-50 transition-colors duration-150 relative"
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3 text-sm text-ink-700">
          <FileText className="w-5 h-5 flex-shrink-0" />
          <span className="truncate max-w-xs">{file.name}</span>
          <span className="text-gray-400">({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-gray-400 hover:text-red-500 transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <UploadIcon className="w-7 h-7" />
          <p className="text-sm">{label}</p>
          <p className="text-xs">Click or drag and drop</p>
        </div>
      )}
    </div>
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const uploadBook = useUploadBook();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    if (!pdfFile) {
      toast.error("A PDF file is required");
      return;
    }

    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("author", data.author);
    if (data.description) fd.append("description", data.description);
    fd.append("edition_number", String(data.edition_number));
    if (data.year) fd.append("year", String(data.year));
    if (data.publisher) fd.append("publisher", data.publisher);
    fd.append("language", data.language);
    fd.append("pdf_file", pdfFile);
    if (coverFile) fd.append("cover_file", coverFile);

    try {
      const book = await uploadBook.mutateAsync(fd);
      toast.success("Book uploaded!");
      navigate(`/books/${book.id}`);
    } catch (e: any) {
      const detail: string = e.response?.data?.detail || "";
      if (detail.startsWith("DUPLICATE_BOOK:") || detail.startsWith("DUPLICATE_EDITION:")) {
        // Parse out the book ID and message from the detail string
        const parts = detail.split(":");
        const bookId = parts[1];
        const message = parts.slice(2).join(":");
        toast.error(message, { duration: 5000 });
        // Redirect to the existing book after a brief delay so the toast is readable
        setTimeout(() => navigate(`/books/${bookId}`), 1500);
      } else {
        toast.error(detail || "Upload failed");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold text-ink-900 mb-2">Upload a book</h1>
      <p className="text-sm text-gray-500 mb-8">
        Add a PDF and its metadata. You can upload more editions later from the book detail page.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* PDF upload */}
        <div>
          <label className="label">PDF file <span className="text-red-400">*</span></label>
          <FileDrop
            label="Upload PDF (max 100 MB)"
            accept="application/pdf"
            file={pdfFile}
            onFile={setPdfFile}
            onClear={() => setPdfFile(null)}
          />
        </div>

        {/* Cover upload */}
        <div>
          <label className="label">Cover image <span className="text-gray-400 font-normal">(optional)</span></label>
          <FileDrop
            label="Upload cover (JPEG, PNG, WebP, max 5 MB)"
            accept="image/jpeg,image/png,image/webp"
            file={coverFile}
            onFile={setCoverFile}
            onClear={() => setCoverFile(null)}
          />
        </div>

        {/* Title */}
        <div>
          <label className="label" htmlFor="title">Title <span className="text-red-400">*</span></label>
          <input id="title" className="input" autoComplete="off" {...register("title")} />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        {/* Author */}
        <div>
          <label className="label" htmlFor="author">Author <span className="text-red-400">*</span></label>
          <input id="author" className="input" autoComplete="off" {...register("author")} />
          {errors.author && <p className="text-xs text-red-500 mt-1">{errors.author.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={3}
            className="input resize-none"
            autoComplete="off"
            {...register("description")}
          />
        </div>

        {/* Publisher on its own row */}
        <div>
          <label className="label" htmlFor="publisher">Publisher</label>
          <input id="publisher" className="input" autoComplete="off" {...register("publisher")} />
        </div>

        {/* Edition, Year, Language on one row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="edition_number">Edition</label>
            <input
              id="edition_number"
              type="number"
              min={1}
              className="input"
              defaultValue={1}
              {...register("edition_number")}
            />
          </div>
          <div>
            <label className="label" htmlFor="year">Year</label>
            <input id="year" type="number" min={1000} max={2100} className="input" {...register("year")} />
          </div>
          <div>
            <label className="label" htmlFor="language">Language</label>
            <select id="language" className="input" {...register("language")}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="hi">Hindi</option>
              <option value="ar">Arabic</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={uploadBook.isPending || !pdfFile}
          className="btn-primary justify-center py-2.5 mt-2"
        >
          {uploadBook.isPending ? "Uploading..." : "Upload book"}
        </button>
      </form>
    </div>
  );
}
