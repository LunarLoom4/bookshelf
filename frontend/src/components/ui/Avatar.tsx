/**
 * Avatar component -- shows the user's photo if they have one,
 * otherwise shows their initial letter in a coloured circle.
 * Used in Navbar, UserProfile header, and comment threads.
 */
interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-16 h-16 text-2xl",
  xl: "w-24 h-24 text-4xl",
};

export function Avatar({ username, avatarUrl, size = "md", className = "" }: Props) {
  const cls = `${sizes[size]} rounded-full flex-shrink-0 ${className}`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${cls} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${cls} bg-ink-800 flex items-center justify-center
                  text-white font-serif font-semibold select-none`}
    >
      {username[0].toUpperCase()}
    </div>
  );
}
