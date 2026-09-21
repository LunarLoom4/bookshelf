/**
 * Tooltip -- shows a styled popup to the RIGHT of the trigger on hover.
 * Falls back to LEFT if there is not enough space on the right.
 */
import { useState, useRef } from "react";

interface Props {
  content: string;
  title?: string;
  children: React.ReactNode;
  width?: number;
}

export function Tooltip({ content, title, children, width = 240 }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number; side: "right" | "left" } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 10;
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight >= width + GAP) {
      setPos({ x: rect.right + GAP, y: rect.top + rect.height / 2, side: "right" });
    } else {
      setPos({ x: rect.left - GAP - width, y: rect.top + rect.height / 2, side: "left" });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setPos(null)}
    >
      {children}

      {pos && content && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: pos.x, top: pos.y, transform: "translateY(-50%)", width }}
        >
          {/* Arrow */}
          {pos.side === "right" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full" aria-hidden>
              <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "6px solid #334155" }} />
            </div>
          )}
          {pos.side === "left" && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full" aria-hidden>
              <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "6px solid #334155" }} />
            </div>
          )}

          {/* Box */}
          <div className="rounded-lg shadow-lg overflow-hidden bg-slate-700 dark:bg-slate-800 border border-slate-600 dark:border-slate-600">
            {title && (
              <div className="px-3 pt-2.5 pb-1.5 border-b border-slate-600">
                <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{title}</p>
              </div>
            )}
            <div className="px-3 py-2.5">
              <p className="text-xs text-slate-300 leading-relaxed">{content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
