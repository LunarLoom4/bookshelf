import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Search, Upload, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Avatar } from "@/components/ui/Avatar";

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  // Compute isDark fresh from theme -- no stale resolved state
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ink-400 focus:ring-offset-1"
      style={{ backgroundColor: isDark ? "#4f46e5" : "#d1d5db" }}
    >
      {/* Sun on left, Moon on right */}
      <Sun className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-400 pointer-events-none"
        style={{ opacity: isDark ? 0.35 : 1 }} />
      <Moon className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-300 pointer-events-none"
        style={{ opacity: isDark ? 1 : 0.35 }} />
      {/* Dark: thumb LEFT covers sun. Light: thumb RIGHT covers moon. */}
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none"
        style={{ transform: isDark ? "translateX(-21px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-paper-200 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between relative">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-serif text-lg font-semibold text-ink-800">
          <BookOpen className="w-5 h-5 text-ink-600" />
          Bookshelf
        </Link>

        {/* Center links */}
        <div className="hidden sm:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          <Link to="/browse" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-ink-700 transition-colors">
            <Search className="w-4 h-4" />
            Browse
          </Link>
          {isAuthenticated && (
            <Link to="/upload" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-ink-700 transition-colors">
              <Upload className="w-4 h-4" />
              Upload
            </Link>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle -- always visible */}
          <ThemeToggle />

          {isAuthenticated && user ? (
            <>
              {/* Avatar + username → profile */}
              <Link
                to={`/u/${user.username}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-ink-700 transition-colors px-2 py-1 rounded-md hover:bg-paper-100"
              >
                <Avatar username={user.username} avatarUrl={user.avatar_url} size="xs" />
                <span className="hidden sm:inline font-medium">{user.username}</span>
              </Link>

              {/* Settings gear */}
              <Link
                to="/settings"
                className="p-1.5 text-gray-400 hover:text-ink-700 rounded-md hover:bg-paper-100 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>

              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-paper-100 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary py-1.5 text-xs">Sign in</Link>
              <Link to="/register" className="btn-primary py-1.5 text-xs">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
