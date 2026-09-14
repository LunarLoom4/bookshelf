/**
 * Avatar — shows a user's photo or a coloured initial circle.
 * Each username gets a consistent, aesthetically pleasing background colour
 * from a curated palette, with white text in a clean sans-serif font.
 */

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: { cls: "w-6 h-6", text: "text-[11px]", fw: "font-bold" },
  sm: { cls: "w-8 h-8", text: "text-sm",   fw: "font-bold" },
  md: { cls: "w-10 h-10", text: "text-base", fw: "font-bold" },
  lg: { cls: "w-16 h-16", text: "text-2xl",  fw: "font-bold" },
  xl: { cls: "w-24 h-24", text: "text-4xl",  fw: "font-bold" },
};

// 16 curated vibrant backgrounds, all with white text.
// Designed to look vivid and distinct from each other.
const COLOURS = [
  "#4361EE", // Electric blue
  "#3A86FF", // Bright blue
  "#7B2D8B", // Rich purple
  "#E63946", // Vivid red
  "#F77F00", // Warm orange
  "#2EC4B6", // Teal
  "#06D6A0", // Mint green
  "#8338EC", // Purple
  "#FF006E", // Hot pink
  "#FB5607", // Deep orange
  "#1D3461", // Navy
  "#2D6A4F", // Forest
  "#D62828", // Crimson
  "#023E8A", // Deep blue
  "#6A0572", // Dark magenta
  "#0096C7", // Cerulean
];

function colourFor(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) >>> 0;
  }
  return COLOURS[h % COLOURS.length];
}

export function Avatar({ username, avatarUrl, size = "md", className = "" }: Props) {
  const { cls, text, fw } = sizes[size];
  const base = `${cls} rounded-full flex-shrink-0 ${className}`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        loading="lazy"
        decoding="async"
        className={`${base} object-cover ring-1 ring-black/10`}
      />
    );
  }

  const bg = colourFor(username || "?");
  const initial = (username || "?")[0].toUpperCase();

  return (
    <div
      className={`${base} ${text} ${fw} flex items-center justify-center select-none tracking-wide`}
      style={{
        backgroundColor: bg,
        color: "#FFFFFF",
        // Subtle inner highlight for depth/shininess
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.25)`,
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        textShadow: "0 1px 2px rgba(0,0,0,0.20)",
        letterSpacing: "0.03em",
      }}
      aria-label={username}
    >
      {initial}
    </div>
  );
}
