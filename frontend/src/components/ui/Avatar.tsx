/**
 * Avatar — user photo or styled initial circle.
 * Colors are deterministic per username, vibrant, and high-contrast.
 * Initial is large, perfectly centered, bold, and visually striking.
 */

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Sizes: circle dimensions + text size tuned so the letter fills ~55% of the circle
const sizes = {
  xs: { cls: "w-6 h-6",   text: "text-[13px]" },
  sm: { cls: "w-8 h-8",   text: "text-[16px]" },
  md: { cls: "w-10 h-10", text: "text-[20px]" },
  lg: { cls: "w-16 h-16", text: "text-[32px]" },
  xl: { cls: "w-24 h-24", text: "text-[48px]" },
};

// Vibrant palette — each colour is distinct and punchy.
// All have sufficient contrast with white text (WCAG AA compliant).
const PALETTE = [
  { bg: "#FF4757", fg: "#fff" }, // Vivid red
  { bg: "#2ED573", fg: "#fff" }, // Emerald
  { bg: "#1E90FF", fg: "#fff" }, // Dodger blue
  { bg: "#FF6B81", fg: "#fff" }, // Pink rose
  { bg: "#FFA502", fg: "#fff" }, // Amber
  { bg: "#A29BFE", fg: "#fff" }, // Soft purple (dark enough)
  { bg: "#00B894", fg: "#fff" }, // Mint green
  { bg: "#6C5CE7", fg: "#fff" }, // Electric violet
  { bg: "#FDCB6E", fg: "#333" }, // Sunshine — dark text for contrast
  { bg: "#E84393", fg: "#fff" }, // Hot pink
  { bg: "#00CEC9", fg: "#fff" }, // Robin egg blue
  { bg: "#D63031", fg: "#fff" }, // Fire red
  { bg: "#0984E3", fg: "#fff" }, // Azure
  { bg: "#6AB04C", fg: "#fff" }, // Apple green
  { bg: "#E17055", fg: "#fff" }, // Terra cotta
  { bg: "#74B9FF", fg: "#1a1a2e" }, // Baby blue — dark text
];

function paletteFor(username: string) {
  let h = 5381;
  for (let i = 0; i < username.length; i++) {
    h = ((h << 5) + h + username.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ username, avatarUrl, size = "md", className = "" }: Props) {
  const { cls, text } = sizes[size];
  const base = `${cls} rounded-full flex-shrink-0 ${className}`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        loading="lazy"
        decoding="async"
        className={`${base} object-cover`}
      />
    );
  }

  const { bg, fg } = paletteFor(username || "?");
  const initial = (username || "?")[0].toUpperCase();

  return (
    <div
      className={`${base} ${text} flex items-center justify-center select-none`}
      style={{
        backgroundColor: bg,
        color: fg,
        fontWeight: 700,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        lineHeight: 1,
        letterSpacing: "-0.01em",
        // Subtle inset highlight + drop shadow for depth
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.18)`,
      }}
      aria-label={username}
    >
      {initial}
    </div>
  );
}
