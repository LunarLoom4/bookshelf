import { useState } from "react";
import { Link, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/api";
import { setPostLoginToast } from "@/hooks/usePostLoginToast";
import { useAuthStore } from "@/stores/authStore";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";
import { PasswordStrength } from "@/components/ui/PasswordStrength";

// Mirror backend rules exactly so errors show before hitting the server
const RESERVED = new Set([
  "admin","administrator","root","api","bookshelf","me","null",
  "undefined","anonymous","system","support","help","contact",
  "about","terms","privacy","login","register","signup","signin",
  "logout","settings","profile","account","user","users","browse",
  "upload","search","static","assets","favicon","robots",
]);

const schema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be 30 characters or fewer")
      .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, underscores and hyphens allowed")
      .refine((v) => !v.startsWith("-") && !v.startsWith("_"), "Username cannot start with - or _")
      .refine((v) => !v.endsWith("-") && !v.endsWith("_"), "Username cannot end with - or _")
      .refine((v) => !v.includes("--") && !v.includes("__"), "Username cannot contain consecutive - or _")
      .refine((v) => !RESERVED.has(v.toLowerCase()), "This username is reserved"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "Password must be 128 characters or fewer")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/\d/, "Must contain a number")
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, "Must contain a special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type Form = z.infer<typeof schema>;

function PasswordInput({
  id, label, autoComplete, registration, error, onChangeExtra,
}: {
  id: string; label: string; autoComplete: string;
  registration: any; error?: string;
  onChangeExtra?: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="input pr-10"
          {...registration}
          onChange={(e) => {
            registration.onChange(e);
            onChangeExtra?.(e.target.value);
          }}
        />
        <button
          type="button" tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { setTokens, setUser, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const nextUrl = new URLSearchParams(location.search).get("next") || "/";

  // Already logged in -- redirect to home
  if (isAuthenticated) return <Navigate to="/" replace />;
  const [loading, setLoading] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [usernameValue, setUsernameValue] = useState("");

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const handleGoogleCredential = async (credential: string) => {
    try {
      const res = await authApi.googleLogin(credential);
      setTokens(res.data.access_token, res.data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      if (res.data.is_new_user) {
        const dest = nextUrl !== "/" ? nextUrl : "/settings";
        setPostLoginToast(
          dest === "/settings"
            ? "Welcome to Bookshelf! You can update your username in Settings."
            : "Welcome to Bookshelf!",
          5000
        );
        window.location.href = dest;
      } else {
        setPostLoginToast("Welcome back!");
        window.location.href = "/";
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 501) {
        toast.error("Google Sign-In is not configured on this server.");
      } else if (e.response?.status === 401) {
        toast.error("Google token verification failed. Please try again.");
      } else if (!e.response) {
        toast.error("Cannot reach the server. Check that the backend is running.");
      } else {
        toast.error(detail || "Google sign-in failed");
      }
    }
  };

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      const res = await authApi.register(data.email, data.username, data.password);
      setTokens(res.data.access_token, res.data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      setPostLoginToast("Welcome to Bookshelf!");
      window.location.href = nextUrl;
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const usernameCharsLeft = 30 - usernameValue.length;
  const watchedPassword = watch("password", "");
  const watchedConfirm = watch("confirmPassword", "");
  const passwordsMatch = watchedPassword.length > 0 && watchedConfirm.length > 0 && watchedPassword === watchedConfirm;

  return (
    <div
      style={{ minHeight: "calc(100vh - 56px)" }}
      className="flex items-center justify-center px-4 bg-paper-50"
    >
      <div className="w-full max-w-sm py-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-ink-800 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Create account</h1>
          <p className="text-sm text-gray-500">
            Already registered?{" "}
            <Link to="/login" className="text-ink-600 hover:underline">Sign in</Link>
          </p>
        </div>

        <div className="mb-4 w-full">
          <GoogleSignInButton onCredential={handleGoogleCredential} label="Continue with Google" />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or register with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 flex flex-col gap-4">
          {/* Email */}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="email" className="input"
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          {/* Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0" htmlFor="username">Username</label>
              <span className={`text-xs ${usernameCharsLeft <= 5 ? "text-orange-500" : "text-gray-400"}`}>
                {usernameCharsLeft} left
              </span>
            </div>
            <input
              id="username" type="text" autoComplete="off" className="input"
              {...register("username")}
              onChange={(e) => {
                register("username").onChange(e);
                setUsernameValue(e.target.value);
              }}
            />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
            <p className="text-xs text-gray-400 mt-1">
              Letters, numbers, _ and - only.
            </p>
          </div>

          {/* Password with strength indicator */}
          <div>
            <label className="label" htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              label=""
              autoComplete="new-password"
              registration={register("password")}
              error={errors.password?.message}
              onChangeExtra={setPasswordValue}
            />
            <PasswordStrength password={passwordValue} />
          </div>

          {/* Confirm password */}
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm password</label>
            <PasswordInput
              id="confirmPassword"
              label=""
              autoComplete="new-password"
              registration={register("confirmPassword")}
              error={errors.confirmPassword?.message}
            />
            {passwordsMatch && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Passwords match
              </p>
            )}
          </div>

          <button
            type="submit" disabled={loading}
            className="btn-primary w-full justify-center mt-1"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
