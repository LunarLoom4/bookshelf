import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Search, Upload, Settings, LogOut, Sun, Moon, Bell } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { notificationsApi } from "@/api";
import type { NotificationEvent } from "@/api";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/utils/time";

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

  // 21: Real notification system -- events caused by OTHER users that affect the current user
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // b: Close notification popup when clicking outside it
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    // Use mousedown so it fires before any click handlers on other elements
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);
  const { data: notifications = [] } = useQuery<NotificationEvent[]>({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.get().then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
  const lastChecked = Number(localStorage.getItem("bookshelf-notif-checked") || "0");
  const hasNew = notifications.some(n => new Date(n.created_at).getTime() > lastChecked);

  const handleBellClick = () => {
    setNotifOpen(v => !v);
    if (!notifOpen) localStorage.setItem("bookshelf-notif-checked", Date.now().toString());
  };

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

              {/* Bell notification icon */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={handleBellClick}
                  className="p-1.5 text-gray-400 hover:text-ink-700 rounded-md hover:bg-paper-100 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {hasNew && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>

                {/* Notification dropdown */}
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink-800 dark:text-gray-100">Recent activity</span>
                      <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 text-xs">
                        Close
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                          No new notifications yet.
                        </div>
                      ) : (
                        notifications.map((n, i) => {
                          const isNew = new Date(n.created_at).getTime() > lastChecked;
                          return (
                            <a
                              key={i}
                              href={n.link}
                              onClick={() => setNotifOpen(false)}
                              className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                                isNew ? "bg-ink-50/60 dark:bg-ink-900/20 border-l-2 border-ink-400" : ""
                              }`}
                            >
                              <p className="text-sm text-ink-800 dark:text-gray-100 leading-snug">{n.message}</p>
                              {n.detail && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 italic">"{n.detail}"</p>
                              )}
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
                            </a>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

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
