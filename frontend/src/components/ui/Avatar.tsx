/**
 * Avatar — shows a user's photo if available, otherwise a coloured initial circle.
 * Each username gets a consistent, aesthetically pleasing background colour
 * derived from a hash of the username — so the same user always gets the same colour.
 */

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-base",
  lg: "w-16 h-16 text-2xl",
  xl: "w-24 h-24 text-4xl",
};

// Curated palette: aesthetically pleasing, accessible text contrast
// Each pair is [background, text] in hex. Selected to look good together.
const COLOUR_PAIRS: [string, string][] = [
  ["#4F6EF7", "#FFFFFF"], // Indigo → white
  ["#2D9C6A", "#FFFFFF"], // Emerald → white
  ["#E05C3A", "#FFFFFF"], // Coral → white
  ["#9B59B6", "#FFFFFF"], // Amethyst → white
  ["#D4853A", "#FFFFFF"], // Amber → white
  ["#2980B9", "#FFFFFF"], // Ocean blue → white
  ["#C0392B", "#FFFFFF"], // Crimson → white
  ["#16A085", "#FFFFFF"], // Teal → white
  ["#8E44AD", "#FFFFFF"], // Plum → white
  ["#1F7A4D", "#FFFFFF"], // Forest green → white
  ["#D35400", "#FFFFFF"], // Pumpkin → white
  ["#2C3E50", "#FFFFFF"], // Midnight → white
  ["#6D28D9", "#FFFFFF"], // Violet → white
  ["#0E7490", "#FFFFFF"], // Cyan → white
  ["#B45309", "#FFFFFF"], // Ochre → white
  ["#7C3AED", "#FFFFFF"], // Purple → white
];

/** Deterministic hash of a string → picks a colour pair */
function colourFor(username: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return COLOUR_PAIRS[hash % COLOUR_PAIRS.length];
}

export function Avatar({ username, avatarUrl, size = "md", className = "" }: Props) {
  const cls = `${sizes[size]} rounded-full flex-shrink-0 ${className}`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        loading="lazy"
        decoding="async"
        className={`${cls} object-cover`}
      />
    );
  }

  const [bg, fg] = colourFor(username || "?");
  const initial = (username || "?")[0].toUpperCase();

  return (
    <div
      className={`${cls} flex items-center justify-center font-semibold select-none`}
      style={{ backgroundColor: bg, color: fg }}
      aria-label={username}
    >
      {initial}
    </div>
  );
}
