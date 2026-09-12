/**
 * Tooltip — a beautiful custom tooltip that appears on hover.
 * Wraps any element and shows a styled popup on hover.
 * Use instead of the native browser `title` attribute for elegance.
 */
import { useState, useRef } from "react";

interface Props {
  content: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Tooltip({ content, children, maxWidth = "220px" }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    }
    setVisible(true);
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: pos.x, top: pos.y, transform: "translateX(-50%)" }}
        >
          <div
            className="bg-gray-900 text-gray-100 text-xs leading-relaxed rounded-lg px-3 py-2 shadow-xl
                       border border-gray-700 text-left"
            style={{ maxWidth, width: "max-content" }}
          >
            {content}
            {/* Arrow pointing up */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-1.5 overflow-hidden"
              aria-hidden
            >
              <div className="w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45 translate-y-1 mx-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
