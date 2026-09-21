import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen, Search, Upload, Settings, LogOut, Sun, Moon,
  Bell, Check, MessageSquare, BookPlus, List, Menu, X as XIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { notificationsApi } from "@/api";
import type { NotificationEvent } from "@/api";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/utils/time";

// ── Theme toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0
                 focus:outline-none focus:ring-2 focus:ring-ink-400 focus:ring-offset-1"
      style={{ backgroundColor: isDark ? "#4f46e5" : "#d1d5db" }}
    >
      <Sun className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-400 pointer-events-none"
        style={{ opacity: isDark ? 0.35 : 1 }} />
      <Moon className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-300 pointer-events-none"
        style={{ opacity: isDark ? 1 : 0.35 }} />
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none"
        style={{ transform: isDark ? "translateX(-21px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ── Notification helpers ──────────────────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (type === "reply_to_my_comment") return <MessageSquare className={cls} />;
  if (type === "new_comment_on_my_book") return <MessageSquare className={cls} />;
  if (type === "new_edition_on_my_book") return <BookPlus className={cls} />;
  if (type === "book_added_to_list") return <List className={cls} />;
  return <Bell className={cls} />;
}

function notifIconColor(type: string): string {
  if (type === "reply_to_my_comment") return "#818cf8";
  if (type === "new_comment_on_my_book") return "#34d399";
  if (type === "new_edition_on_my_book") return "#fb923c";
  if (type === "book_added_to_list") return "#60a5fa";
  return "#9ca3af";
}

function NotificationPopup({
  notifications, onClose, onMarkAll, onMarkOne, isMarking,
}: {
  notifications: NotificationEvent[];
  onClose: () => void;
  onMarkAll: () => void;
  onMarkOne: (id: number, link: string) => void;
  isMarking: boolean;
}) {
  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  return (
    <div
      className="absolute right-0 top-full mt-2 rounded-xl shadow-2xl z-50 overflow-hidden border
                 w-[min(24rem,calc(100vw-2rem))]"
      style={{ background: "var(--notif-bg,#fff)", borderColor: "var(--notif-border,#e5e7eb)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b"
        style={{ borderColor: "var(--notif-border,#e5e7eb)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--notif-heading,#1e293b)" }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.3rem] h-5 rounded-full bg-ink-600 text-white text-[11px] font-bold px-1.5">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={onMarkAll} disabled={isMarking}
              className="flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-ink-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-xs" style={{ color: "var(--notif-muted,#9ca3af)" }}>
            Close
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: "min(480px,70vh)" }}>
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "var(--notif-muted,#9ca3af)" }} />
            <p className="text-sm" style={{ color: "var(--notif-muted,#9ca3af)" }}>No notifications yet.</p>
            <p className="text-xs mt-1" style={{ color: "var(--notif-muted,#9ca3af)" }}>
              You'll be notified when others comment on your books or reply to you.
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => {
              const isUnread = n.read_at === null;
              return (
                <button key={n.id} onClick={() => onMarkOne(n.id, n.link)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors border-b last:border-b-0"
                  style={{
                    borderColor: "var(--notif-divider,#f3f4f6)",
                    backgroundColor: isUnread ? "var(--notif-unread-bg,rgba(224,233,255,0.55))" : "transparent",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--notif-hover-bg,#f9fafb)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = isUnread ? "var(--notif-unread-bg,rgba(224,233,255,0.55))" : "transparent"; }}
                >
                  <div className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: notifIconColor(n.type) + "22", color: notifIconColor(n.type) }}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug"
                      style={{ color: "var(--notif-text,#1e293b)", fontWeight: isUnread ? 500 : 400 }}>
                      {n.message}
                    </p>
                    {n.detail && (
                      <p className="text-xs mt-0.5 line-clamp-1 italic" style={{ color: "var(--notif-muted,#9ca3af)" }}>
                        "{n.detail}"
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--notif-muted,#9ca3af)" }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {isUnread && <div className="w-2 h-2 rounded-full bg-ink-500 flex-shrink-0 mt-1.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t flex items-center justify-between"
          style={{ borderColor: "var(--notif-border,#e5e7eb)" }}>
          <p className="text-xs" style={{ color: "var(--notif-muted,#9ca3af)" }}>
            Showing last {notifications.length}
          </p>
          {unreadCount === 0 && (
            <p className="text-xs font-medium" style={{ color: "#22c55e" }}>All caught up</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close notification popup on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const { data: notifications = [] } = useQuery<NotificationEvent[]>({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.get().then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: (ids?: number[]) => notificationsApi.markRead(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<NotificationEvent[]>(["notifications"]);
      const now = new Date().toISOString();
      qc.setQueryData<NotificationEvent[]>(["notifications"], (old = []) =>
        old.map((n) => !ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)
      );
      return { prev };
    },
    onError: (_err, _ids, ctx) => { if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  const handleMarkAll = useCallback(() => { markRead.mutate(undefined); }, [markRead]);
  const handleMarkOne = useCallback((id: number, link: string) => {
    markRead.mutate([id]);
    setNotifOpen(false);
    navigate(link);
  }, [markRead, navigate]);

  const handleLogout = () => { logout(); navigate("/"); };

  // Active link helper
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <style>{`
        html:not(.dark) {
          --notif-bg:#fff;--notif-border:#e5e7eb;--notif-divider:#f3f4f6;
          --notif-heading:#0f172a;--notif-text:#1e293b;--notif-muted:#9ca3af;
          --notif-unread-bg:rgba(224,233,255,0.55);--notif-hover-bg:#f9fafb;
        }
        html.dark {
          --notif-bg:#1a1f2e;--notif-border:#2d3748;--notif-divider:#252d3d;
          --notif-heading:#f0f4f8;--notif-text:#e2e8f0;--notif-muted:#718096;
          --notif-unread-bg:rgba(30,58,95,0.5);--notif-hover-bg:#1e2535;
        }
      `}</style>

      <header className="sticky top-0 z-50 bg-white border-b border-paper-200 shadow-sm">
        {/* ── Desktop / tablet bar (always visible) ── */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">

          {/* Brand -- always leftmost */}
          <Link to="/" className="flex items-center gap-2 font-serif text-lg font-semibold text-ink-800 flex-shrink-0">
            <BookOpen className="w-5 h-5 text-ink-600" />
            <span>Bookshelf</span>
          </Link>

          {/* Center nav links -- hidden on mobile, shown from sm up */}
          <div className="hidden sm:flex items-center gap-1 ml-4">
            <Link
              to="/browse"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors
                ${isActive("/browse")
                  ? "text-ink-700 bg-ink-50 font-medium"
                  : "text-gray-600 hover:text-ink-700 hover:bg-paper-100"}`}
            >
              <Search className="w-4 h-4" />
              Browse
            </Link>
            {isAuthenticated && (
              <Link
                to="/upload"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors
                  ${isActive("/upload")
                    ? "text-ink-700 bg-ink-50 font-medium"
                    : "text-gray-600 hover:text-ink-700 hover:bg-paper-100"}`}
              >
                <Upload className="w-4 h-4" />
                Upload
              </Link>
            )}
          </div>

          {/* Spacer pushes right-side controls to the end */}
          <div className="flex-1" />

          {/* Right controls -- always visible */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />

            {isAuthenticated && user ? (
              <>
                {/* Avatar + username -- username hidden on mobile */}
                <Link
                  to={`/u/${user.username}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-ink-700
                             transition-colors px-2 py-1 rounded-md hover:bg-paper-100"
                >
                  <Avatar username={user.username} avatarUrl={user.avatar_url} size="xs" />
                  <span className="hidden sm:inline font-medium max-w-[120px] truncate">{user.username}</span>
                </Link>

                {/* Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen((v) => !v)}
                    className="p-1.5 text-gray-400 hover:text-ink-700 rounded-md hover:bg-paper-100 transition-colors relative"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 bg-red-500 text-white
                                       rounded-full text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <NotificationPopup
                      notifications={notifications}
                      onClose={() => setNotifOpen(false)}
                      onMarkAll={handleMarkAll}
                      onMarkOne={handleMarkOne}
                      isMarking={markRead.isPending}
                    />
                  )}
                </div>

                {/* Settings -- hidden on mobile (available in mobile menu) */}
                <Link
                  to="/settings"
                  className="hidden sm:flex p-1.5 text-gray-400 hover:text-ink-700 rounded-md hover:bg-paper-100 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>

                {/* Sign out -- hidden on mobile */}
                <button
                  onClick={handleLogout}
                  className="hidden sm:flex p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-paper-100 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* Hamburger -- only on mobile */}
                <button
                  onClick={() => setMobileOpen((v) => !v)}
                  className="sm:hidden p-1.5 text-gray-400 hover:text-ink-700 rounded-md hover:bg-paper-100 transition-colors"
                  title="Menu"
                >
                  {mobileOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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

        {/* ── Mobile drawer -- slides in below the bar when open ── */}
        {mobileOpen && isAuthenticated && user && (
          <div className="sm:hidden border-t border-paper-200 bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-1">
            <Link
              to="/browse"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${isActive("/browse") ? "text-ink-700 bg-ink-50 font-medium" : "text-gray-700 hover:bg-paper-100"}`}
            >
              <Search className="w-4 h-4 text-gray-400" />
              Browse
            </Link>
            <Link
              to="/upload"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${isActive("/upload") ? "text-ink-700 bg-ink-50 font-medium" : "text-gray-700 hover:bg-paper-100"}`}
            >
              <Upload className="w-4 h-4 text-gray-400" />
              Upload
            </Link>
            <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${isActive("/settings") ? "text-ink-700 bg-ink-50 font-medium" : "text-gray-700 hover:bg-paper-100"}`}
            >
              <Settings className="w-4 h-4 text-gray-400" />
              Settings
            </Link>
            <div className="border-t border-paper-200 mt-1 pt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-paper-100 transition-colors"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
