import { Suspense, lazy, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { useAuthStore } from "@/stores/authStore";

// Error boundary that catches chunk load failures (e.g. after a new deployment)
// and forces a hard reload so the user gets the latest version automatically.
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; isChunkError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error) {
    const isChunkError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed") ||
      error.message.includes("Unable to preload CSS") ||
      error.name === "ChunkLoadError";
    // Only catch chunk errors here. Other errors are real bugs and should
    // surface clearly in development, not be swallowed as "Something went wrong".
    if (isChunkError) {
      return { hasError: true, isChunkError: true };
    }
    // For non-chunk errors: still set hasError so we show a useful message,
    // but mark it differently so we don't auto-reload.
    return { hasError: true, isChunkError: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const isChunkError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed") ||
      error.message.includes("Unable to preload CSS") ||
      error.name === "ChunkLoadError";

    if (isChunkError && !sessionStorage.getItem("chunk-reload")) {
      // Auto-reload once on chunk errors (stale deployment URLs)
      sessionStorage.setItem("chunk-reload", "1");
      window.location.reload();
      return;
    }

    // Log non-chunk errors so they appear in the console for debugging
    console.error("[App Error]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <p className="text-gray-500 text-sm">
            {this.state.isChunkError
              ? "A new version of Bookshelf is available."
              : "Something went wrong loading this page."}
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem("chunk-reload");
              window.location.reload();
            }}
            className="btn-primary py-2 text-sm"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded pages
const Landing = lazy(() => import("@/pages/Landing"));
const Browse = lazy(() => import("@/pages/Browse"));
const BookDetail = lazy(() => import("@/pages/BookDetail"));
const ReadingPage = lazy(() => import("@/pages/ReadingPage"));
const Upload = lazy(() => import("@/pages/Upload"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const Settings = lazy(() => import("@/pages/Settings"));
const ReadingListDetail = lazy(() => import("@/pages/ReadingListDetail"));
const UserCommentsFeed = lazy(() => import("@/pages/UserCommentsFeed"));
const AllReadingLists = lazy(() => import("@/pages/AllReadingLists"));
const AllCurrentlyReading = lazy(() => import("@/pages/AllCurrentlyReading"));
const AllCommentedBooks = lazy(() => import("@/pages/AllCommentedBooks"));
const AllBooksUploaded = lazy(() => import("@/pages/AllBooksUploaded"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
    </div>
  );
}

function InnerApp() {
  const { pathname } = useLocation();

  return (
    <>
      <Navbar />
      <Toaster position="bottom-left" toastOptions={{ className: "font-sans text-sm" }} />
      <main>
        {/* key=pathname resets ChunkErrorBoundary on every navigation so
            a previous render error doesn't block a different page */}
        <ChunkErrorBoundary key={pathname}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/books/:bookId" element={<BookDetail />} />
            <Route path="/read/:editionId" element={<ReadingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/u/:username" element={<UserProfile />} />
            <Route path="/u/:username/lists" element={<AllReadingLists />} />
            <Route path="/u/:username/reading" element={<AllCurrentlyReading />} />
            <Route path="/u/:username/comments" element={<AllCommentedBooks />} />
            <Route path="/u/:username/books" element={<AllBooksUploaded />} />
            <Route path="/u/:username/comments/:bookId" element={<UserCommentsFeed />} />
            <Route path="/lists/:listId" element={<ReadingListDetail />} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route
              path="/upload"
              element={
                <RequireAuth>
                  <Upload />
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
        </ChunkErrorBoundary>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <InnerApp />
    </BrowserRouter>
  );
}
