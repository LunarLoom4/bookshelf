import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  _hydrated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hydrated: false,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: "bookshelf-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hydrated: true });
      },
    }
  )
);

// Sync store across browser tabs via localStorage events.
// When tab A calls setUser() -> persists to localStorage ->
// tab B receives "storage" event -> rehydrates store -> Navbar updates.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "bookshelf-auth" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        const state = parsed?.state;
        if (state) {
          useAuthStore.setState({
            user: state.user ?? null,
            accessToken: state.accessToken ?? null,
            refreshToken: state.refreshToken ?? null,
            isAuthenticated: state.isAuthenticated ?? false,
          });
        }
      } catch {
        // ignore malformed storage values
      }
    }
  });
}
