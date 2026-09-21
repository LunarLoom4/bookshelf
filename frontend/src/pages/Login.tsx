import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/api";
import { setPostLoginToast } from "@/hooks/usePostLoginToast";
import { useAuthStore } from "@/stores/authStore";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";

const schema = z.object({
  email: z.string().min(1, "Please enter your email or username"),
  password: z.string().min(1, "Required"),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const { setTokens, setUser, isAuthenticated } = useAuthStore();

  // Already logged in -- redirect to home
  if (isAuthenticated) return <Navigate to="/" replace />;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const handleGoogleCredential = async (credential: string) => {
    try {
      const res = await authApi.googleLogin(credential);
      setTokens(res.data.access_token, res.data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      if (res.data.is_new_user) {
        // New account created via Google on the Sign In page
        setPostLoginToast("Account created! You can update your username in Settings.", 5000);
        window.location.href = "/settings";
      } else {
        setPostLoginToast("Welcome back!");
        window.location.href = "/";
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 501) {
        toast.error("Google Sign-In is not configured. Please add GOOGLE_CLIENT_ID to your .env file.");
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
      const res = await authApi.login(data.email, data.password);
      setTokens(res.data.access_token, res.data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      // Use href instead of navigate() so the page reloads with auth state fully
      // settled in localStorage -- prevents white screen flash on Zustand hydration
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Sign In</h1>
          <p className="text-sm text-gray-500">
            No account?{" "}
            <Link to="/register" className="text-ink-600 hover:underline">Register</Link>
          </p>
        </div>

        <div className="mb-4 w-full">
          <GoogleSignInButton onCredential={handleGoogleCredential} label="Sign in with Google" />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or sign in with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="email">Email or username</label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              className="input"
              placeholder="Enter your email or username"
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="input pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center mt-1"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
