import { Suspense, lazy, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { useAuthStore } from "@/stores/authStore";

// Error boundary that catches chunk load failures (e.g. after a new deployment)
// and forces a hard reload so the user gets the latest version automatically.
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // If a chunk fails to load (404 after deployment), reload the page once.
    // The sessionStorage flag prevents an infinite reload loop.
    const isChunkError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed") ||
      error.message.includes("Unable to preload CSS") ||
      error.name === "ChunkLoadError";

    if (isChunkError && !sessionStorage.getItem("chunk-reload")) {
      sessionStorage.setItem("chunk-reload", "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <p className="text-gray-500 text-sm">Something went wrong loading this page.</p>
          <button
            onClick={() => window.location.reload()}
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

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Toaster position="bottom-left" toastOptions={{ className: "font-sans text-sm" }} />
      <main>
        <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/books/:bookId" element={<BookDetail />} />
            <Route path="/read/:editionId" element={<ReadingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/u/:username" element={<UserProfile />} />
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
    </BrowserRouter>
  );
}
