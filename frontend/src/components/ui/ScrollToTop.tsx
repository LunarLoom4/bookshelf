/**
 * ScrollToTop — a floating button that appears when the user scrolls down
 * and smoothly scrolls back to the top when clicked.
 * Used on long pages: Browse, UserProfile.
 */
import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-ink-700 text-white
                 shadow-lg hover:bg-ink-800 transition-all duration-200
                 flex items-center justify-center
                 opacity-90 hover:opacity-100 hover:scale-110"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
