/**
 * usePostLoginToast
 * Stores a toast message in sessionStorage before a hard redirect,
 * then shows it on the next page load.
 * Used after login/register when window.location.href is needed to
 * avoid white screen from Zustand hydration lag.
 */
import { useEffect } from "react";
import toast from "react-hot-toast";

const KEY = "post_login_toast";

export function setPostLoginToast(message: string, duration = 3000) {
  sessionStorage.setItem(KEY, JSON.stringify({ message, duration }));
}

export function usePostLoginToast() {
  useEffect(() => {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    sessionStorage.removeItem(KEY);
    try {
      const { message, duration } = JSON.parse(raw);
      // Small delay so the page fully renders before toast appears
      setTimeout(() => toast.success(message, { duration }), 200);
    } catch {
      // ignore malformed data
    }
  }, []);
}
