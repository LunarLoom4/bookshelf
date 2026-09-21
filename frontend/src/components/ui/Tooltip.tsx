/**
 * Tooltip -- shows a styled popup to the RIGHT of the trigger on hover.
 * Falls back to LEFT if there is not enough space on the right.
 * Positions are computed at hover time using getBoundingClientRect so the
 * popup is never clipped by overflow:hidden parent cards.
 */
import { useState, useRef } from "react";

interface Props {
  content: string;
  title?: string;       // optional bold header line inside the popup
  children: React.ReactNode;
  width?: number;       // popup width in px, default 260
}

export function Tooltip({ content, title, children, width = 260 }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number; side: "right" | "left" } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const GAP = 10;           // gap between trigger and popup edge
    const ARROW = 8;          // arrow width
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    if (spaceRight >= width + GAP + ARROW) {
      // Enough room on the right
      setPos({
        x: rect.right + GAP,
        y: rect.top + rect.height / 2,
        side: "right",
      });
    } else {
      // Fall back to left
      setPos({
        x: rect.left - GAP - width,
        y: rect.top + rect.height / 2,
        side: "left",
      });
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
          style={{
            left: pos.x,
            top: pos.y,
            transform: "translateY(-50%)",
            width,
          }}
        >
          {/* Arrow pointing left (toward trigger) when popup is on the right */}
          {pos.side === "right" && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full"
              aria-hidden
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderRight: "7px solid #1e293b",
                }}
              />
            </div>
          )}

          {/* Arrow pointing right when popup is on the left */}
          {pos.side === "left" && (
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full"
              aria-hidden
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderLeft: "7px solid #1e293b",
                }}
              />
            </div>
          )}

          {/* Popup box */}
          <div
            className="rounded-xl shadow-2xl overflow-hidden"
            style={{ border: "1px solid #2d3748" }}
          >
            {/* Header strip */}
            <div
              className="px-3 py-2"
              style={{
                background: "linear-gradient(135deg, #1e293b 0%, #1c3089 100%)",
              }}
            >
              <p className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider leading-none">
                Description
              </p>
              {title && (
                <p className="text-xs font-semibold text-white mt-0.5 leading-snug line-clamp-1">
                  {title}
                </p>
              )}
            </div>

            {/* Body */}
            <div
              className="px-3 py-2.5"
              style={{ backgroundColor: "#0f172a" }}
            >
              <p
                className="text-xs text-slate-300 leading-relaxed"
                style={{ lineHeight: "1.55" }}
              >
                {content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
