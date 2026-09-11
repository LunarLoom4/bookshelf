/**
 * themeStore — persisted theme preference.
 * "system" follows the OS dark/light setting.
 * "light" / "dark" override it explicitly.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "system" | "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  // Resolved: what's actually applied right now
  resolved: "light" | "dark";
}

function getResolved(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolved: getResolved("system"),
      setTheme: (t) => {
        const resolved = getResolved(t);
        // Apply to <html> element
        document.documentElement.classList.toggle("dark", resolved === "dark");
        set({ theme: t, resolved });
      },
    }),
    { name: "bookshelf-theme" }
  )
);

// Apply theme on startup
export function initTheme() {
  const stored = useThemeStore.getState();
  const resolved = getResolved(stored.theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  useThemeStore.setState({ resolved });

  // Watch OS preference changes when theme is "system"
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      const resolved = e.matches ? "dark" : "light";
      document.documentElement.classList.toggle("dark", resolved === "dark");
      useThemeStore.setState({ resolved });
    }
  });
}
