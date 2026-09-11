import { usePostLoginToast } from "@/hooks/usePostLoginToast";
import { Link } from "react-router-dom";
import { BookOpen, MessageSquare, Layers, Download, Bookmark, List } from "lucide-react";
import { useBooks } from "@/hooks/useBooks";
import { BookCard } from "@/components/ui/BookCard";
import { useAuthStore } from "@/stores/authStore";

export default function Landing() {
  usePostLoginToast();
  const { data: books } = useBooks(0, 6);
  const { isAuthenticated } = useAuthStore();

  return (
    <div>
      {/* Hero */}
      <section className="bg-ink-950 text-white py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-ink-400 text-xs font-mono tracking-widest uppercase mb-5">
            Read · Discuss · Share
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl font-semibold leading-tight mb-6">
            Books live longer when readers talk back.
          </h1>
          <p className="text-ink-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            A home for PDFs worth reading twice. Upload a book, read it in your browser,
            and leave comments pinned to specific pages — so the conversation stays
            exactly where it belongs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/browse"
              className="btn-primary bg-amber-500 hover:bg-amber-600 text-ink-950 font-semibold px-7 py-3 text-base"
            >
              Browse books
            </Link>
            <Link
              to={isAuthenticated ? "/upload" : "/register?next=/upload"}
              className="inline-flex items-center gap-2 px-7 py-3 text-base font-semibold border-2 border-white text-white rounded-md hover:bg-white hover:text-ink-900 transition-colors duration-150"
            >
              Upload a book
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-paper-100 landing-section-alt">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-2xl font-semibold text-ink-900 text-center mb-12">
            Everything a reader needs
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: BookOpen,
                title: "Read in the browser",
                body: "Open any PDF without downloading it. Zoom, pan, and jump to any page — all in one tab.",
              },
              {
                icon: MessageSquare,
                title: "Comments tied to pages",
                body: "Pin a thought to page 47. Anyone reading that edition clicks the badge and lands right there.",
              },
              {
                icon: Layers,
                title: "Multiple editions",
                body: "Track every edition of a book separately. Different PDFs, different discussions — no mix-ups.",
              },
              {
                icon: Download,
                title: "Download anytime",
                body: "Every PDF you can read, you can download. No paywalls, no limits.",
              },
              {
                icon: Bookmark,
                title: "Personal bookmarks",
                body: "Save any page with a private note. Your bookmarks are yours alone — nobody else sees them.",
              },
              {
                icon: List,
                title: "Reading lists",
                body: "Organise books into named lists — Want to Read, Finished, anything you like. Share them or keep them private.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(99,102,241,0.15)" }}>
                  <Icon className="w-5 h-5 text-ink-600" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-ink-900">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-white landing-section-main">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-10">
            {[
              { step: "1", title: "Upload", body: "Drop a PDF and fill in the title and author. Takes thirty seconds." },
              { step: "2", title: "Read", body: "Open the reader. Navigate by page, zoom in, and bookmark pages as you go." },
              { step: "3", title: "Discuss", body: "Leave a comment on any page. Others see exactly where you mean." },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-serif text-lg font-semibold" style={{ backgroundColor: "#312e81" }}>
                  {step}
                </div>
                <h3 className="font-serif text-lg font-semibold text-ink-900">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link
              to={isAuthenticated ? "/upload" : "/register?next=/upload"}
              className="btn-primary bg-ink-800 hover:bg-ink-900 px-8 py-3 text-base"
            >
              Get started — it's free
            </Link>
          </div>
        </div>
      </section>

      {/* Recent uploads */}
      {books && books.length > 0 && (
        <section className="py-16 px-4 bg-paper-50 landing-section-alt">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl font-semibold text-ink-900">Recently added</h2>
              <Link to="/browse" className="text-sm text-ink-600 hover:text-ink-800 transition-colors">
                See all
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
