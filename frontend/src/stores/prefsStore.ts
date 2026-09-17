/**
 * prefsStore — persisted user preferences beyond theme.
 * All preferences here are local to the device (localStorage).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * pdfBackMode controls what the back button does on the reading page.
 *
 * "exit"      — back exits the reading page immediately and returns to wherever
 *               you came from (book detail, profile, etc.). Last page is saved.
 *               This is the default and matches every major e-reader / PDF app.
 *
 * "retrace"   — back steps backward through your in-session page history
 *               (e.g. 245 -> 442 -> 256 -> 1) before finally exiting. Last page
 *               is preserved as the highest page you visited.
 */
export type PdfBackMode = "exit" | "retrace";

interface PrefsState {
  pdfBackMode: PdfBackMode;
  setPdfBackMode: (m: PdfBackMode) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      pdfBackMode: "exit",
      setPdfBackMode: (m) => set({ pdfBackMode: m }),
    }),
    {
      name: "bookshelf-prefs",
      partialize: (s) => ({ pdfBackMode: s.pdfBackMode }),
    }
  )
);
