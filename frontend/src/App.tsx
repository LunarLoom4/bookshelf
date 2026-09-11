import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { useAuthStore } from "@/stores/authStore";

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
      <Toaster position="bottom-right" toastOptions={{ className: "font-sans text-sm" }} />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/books/:bookId" element={<BookDetail />} />
            <Route path="/read/:editionId" element={<ReadingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/u/:username" element={<UserProfile />} />
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
      </main>
    </BrowserRouter>
  );
}
