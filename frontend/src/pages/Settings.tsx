import { useState, useRef } from "react";
import { usePostLoginToast } from "@/hooks/usePostLoginToast";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  User, KeyRound, Trash2, Camera, X, Eye, EyeOff,
  ShieldCheck, LogOut, Palette, Monitor, Sun, Moon, BookOpen, ArrowLeft, History,
} from "lucide-react";
import { accountApi } from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { Avatar } from "@/components/ui/Avatar";
import { PasswordStrength } from "@/components/ui/PasswordStrength";

type Tab = "general" | "account";

// ── Schemas ────────────────────────────────────────────────────────────────────
const RESERVED_USERNAMES = new Set([
  "admin","administrator","root","api","bookshelf","me","null",
  "undefined","anonymous","system","support","help","contact",
  "about","terms","privacy","login","register","signup","signin",
  "logout","settings","profile","account","user","users","browse",
  "upload","search","static","assets","favicon","robots",
]);

const strongPassword = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/\d/, "Must contain a number")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, "Must contain a special character");

const usernameRules = z
  .string()
  .min(3, "At least 3 characters")
  .max(30, "30 characters max")
  .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, _ and -")
  .refine((v) => !v.startsWith("-") && !v.startsWith("_"), "Cannot start with - or _")
  .refine((v) => !v.endsWith("-") && !v.endsWith("_"), "Cannot end with - or _")
  .refine((v) => !RESERVED_USERNAMES.has(v.toLowerCase()), "This username is reserved");

const usernameSchema = z.object({ username: usernameRules });

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must differ from current password",
    path: ["newPassword"],
  });

// ── Helpers ───────────────────────────────────────────────────────────────────
function PwInput({ id, label, reg, error, autoComplete }: {
  id: string; label: string; reg: any; error?: string; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"}
          autoComplete={autoComplete} className="input pr-10" {...reg} />
        <button type="button" tabIndex={-1} onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100 flex items-center gap-2 mb-5">
        <Icon className="w-5 h-5 text-ink-400" />
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Account tab sections ──────────────────────────────────────────────────────
function AvatarSection() {
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  if (!user) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await accountApi.uploadAvatar(fd);
      setUser(res.data);
      queryClient.invalidateQueries({ queryKey: ["user", res.data.username] });
      toast.success("Avatar updated");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await accountApi.removeAvatar();
      setUser(res.data);
      queryClient.invalidateQueries({ queryKey: ["user", res.data.username] });
      toast.success("Avatar removed");
    } catch {
      toast.error("Failed to remove avatar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section icon={Camera} title="Profile Picture">
      <div className="flex items-center gap-6">
        <Avatar username={user.username} avatarUrl={user.avatar_url} size="xl" />
        <div className="inline-flex flex-col gap-2 items-start">
          <input ref={fileRef} type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="btn-primary py-2 text-sm flex items-center gap-2">
            <Camera className="w-4 h-4" />
            {loading ? "Uploading..." : user.avatar_url ? "Change photo" : "Upload photo"}
          </button>
          {user.avatar_url && (
            <button onClick={handleRemove} disabled={loading}
              className="btn-secondary py-2 text-sm flex items-center gap-2 text-red-500 border-red-200 hover:bg-red-50">
              <X className="w-4 h-4" />
              Remove photo
            </button>
          )}
          <p className="text-xs text-gray-400">JPEG, PNG, WebP or GIF (max 5 MB)</p>
        </div>
      </div>
    </Section>
  );
}

function UsernameSection() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: user?.username ?? "" },
  });

  const onSubmit = async (data: { username: string }) => {
    setLoading(true);
    try {
      const res = await accountApi.updateUsername(data.username);
      setUser(res.data);
      toast.success("Username updated");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to update username");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section icon={User} title="Username">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-sm">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input" autoComplete="off" {...register("username")} />
          {errors.username && (
            <p className="text-xs text-red-500 mt-1">{errors.username.message as string}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Shown everywhere on the platform. 3-30 characters, letters/numbers/_ and -.
          </p>
        </div>
        <div>
          <button type="submit" disabled={loading} className="btn-primary py-2 text-sm">
            {loading ? "Saving..." : "Save username"}
          </button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const changeForm = useForm({ resolver: zodResolver(passwordSchema) });
  const watchedNew = changeForm.watch("newPassword", "");
  const watchedConfirm = changeForm.watch("confirmPassword", "");
  const passwordsMatch = watchedNew.length > 0 && watchedConfirm.length > 0 && watchedNew === watchedConfirm;
  if (!user?.has_password) return null;

  const onChangePassword = async (data: any) => {
    setLoading(true);
    try {
      const res = await accountApi.updatePassword(data.currentPassword, data.newPassword);
      setUser(res.data);
      toast.success("Password changed");
      changeForm.reset();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section icon={KeyRound} title="Password">
      <form onSubmit={changeForm.handleSubmit(onChangePassword)} className="flex flex-col gap-4 max-w-sm">
        <PwInput id="cp" label="Current password" autoComplete="current-password"
          reg={changeForm.register("currentPassword")}
          error={changeForm.formState.errors.currentPassword?.message as string} />
        <div>
          <PwInput id="np" label="New password" autoComplete="new-password"
            reg={changeForm.register("newPassword")}
            error={changeForm.formState.errors.newPassword?.message as string} />
          <PasswordStrength password={changeForm.watch("newPassword") || ""} />
        </div>
        <div>
          <PwInput id="cnp" label="Confirm new password" autoComplete="new-password"
            reg={changeForm.register("confirmPassword")}
            error={changeForm.formState.errors.confirmPassword?.message as string} />
          {passwordsMatch && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Passwords match
            </p>
          )}
        </div>
        <div>
          <button type="submit" disabled={loading} className="btn-primary py-2 text-sm">
            {loading ? "Changing..." : "Change password"}
          </button>
        </div>
      </form>
    </Section>
  );
}

function DangerSection() {
  const { logout } = useAuthStore();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await accountApi.deleteAccount();
      logout();
      window.location.href = "/register";
    } catch {
      toast.error("Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <Section icon={ShieldCheck} title="Danger Zone">
      <div className="border-l-4 border-l-red-500 border border-red-200 rounded-lg p-4 bg-white dark:bg-transparent">
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Delete account</h3>
        <p className="text-xs text-red-600 dark:text-red-400/80 mb-3">
          Permanently deletes your account, all uploaded books, comments, bookmarks,
          and reading lists. This cannot be undone.
        </p>
        {!confirm ? (
          <button onClick={() => setConfirm(true)}
            className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800/50 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            Delete my account
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-red-700">Are you absolutely sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">
                {deleting ? "Deleting..." : "Yes, delete everything"}
              </button>
              <button onClick={() => setConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// ── General tab (theme + reading preferences) ──────────────────────────────
function GeneralTab() {
  const { theme, setTheme } = useThemeStore();
  const { pdfBackMode, setPdfBackMode } = usePrefsStore();

  const themes = [
    { value: "system" as const, icon: Monitor, label: "System", desc: "Follows your OS setting" },
    { value: "light" as const, icon: Sun, label: "Light", desc: "Always light" },
    { value: "dark" as const, icon: Moon, label: "Dark", desc: "Always dark" },
  ];

  const backModes: {
    value: "exit" | "retrace";
    icon: React.ElementType;
    label: string;
    desc: string;
  }[] = [
    {
      value: "exit",
      icon: ArrowLeft,
      label: "Leave the book",
      desc: "One click exits the reader and returns to where you came from. Your last page is always saved.",
    },
    {
      value: "retrace",
      icon: History,
      label: "Step back through visited pages",
      desc: "Each click goes back one page in your reading session before finally exiting. Useful for retracing your path through the book.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Theme */}
      <div className="card p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900 dark:text-gray-100 flex items-center gap-2 mb-5">
          <Palette className="w-5 h-5 text-ink-400" />
          Theme
        </h2>
        <div className="grid grid-cols-3 gap-3 max-w-sm">
          {themes.map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150"
              style={{
                borderColor: theme === value ? "#4f46e5" : "#e5e7eb",
                backgroundColor: theme === value ? "rgba(79,70,229,0.12)" : "transparent",
              }}
            >
              <Icon className="w-6 h-6" style={{ color: theme === value ? "#6366f1" : "#9ca3af" }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: theme === value ? "#818cf8" : undefined }}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              {theme === value && (
                <div className="w-2 h-2 rounded-full bg-ink-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* PDF reading behaviour */}
      <div className="card p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900 flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-ink-400" />
          Back Button in PDF Reader
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          Controls what the back arrow does while reading.
        </p>
        <div className="flex flex-col gap-3 max-w-lg">
          {backModes.map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              onClick={() => setPdfBackMode(value)}
              className="flex items-start gap-4 p-3 rounded-xl border-2 text-left transition-all duration-150"
              style={{
                borderColor: pdfBackMode === value ? "#6366f1" : "var(--opt-border, #e5e7eb)",
                backgroundColor: pdfBackMode === value ? "rgba(99,102,241,0.10)" : "transparent",
              }}
            >
              <Icon
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${pdfBackMode !== value ? "text-gray-400 dark:text-gray-500" : ""}`}
                style={{ color: pdfBackMode === value ? "#7c8cff" : undefined }}
              />
              <div>
                <p
                  className="text-sm font-semibold mb-0.5"
                  style={{ color: pdfBackMode === value ? "#7c8cff" : undefined }}
                >
                  {label}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
              {pdfBackMode === value && (
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ml-auto" style={{backgroundColor:"#7c8cff"}} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* More options placeholder */}
      <div className="card p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900 flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5 text-ink-400" />
          More Appearance Options
        </h2>
        <p className="text-sm text-gray-400">
          Font size, reading width, and other display preferences will appear here in a future update.
        </p>
      </div>
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────
export default function Settings() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("general");

  usePostLoginToast();

  if (!isAuthenticated || !user) {
    navigate("/login");
    return null;
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: "general", icon: Palette, label: "General" },
    { id: "account", icon: User, label: "Account" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="btn-secondary py-1.5 text-sm flex items-center gap-1.5 text-gray-500"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Two-column layout: sidebar + content */}
      <div className="flex gap-8">
        {/* Sidebar nav */}
        <aside className="w-48 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left w-full ${
                  tab !== id
                    ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-100"
                    : ""
                }`}
                style={tab === id ? { backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {tab === "general" && <GeneralTab />}
          {tab === "account" && (
            <>
              <AvatarSection />
              <UsernameSection />
              <PasswordSection />
              <DangerSection />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
