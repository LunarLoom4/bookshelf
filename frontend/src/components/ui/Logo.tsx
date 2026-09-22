/**
 * BookshelfLogo -- three stacked pages with amber bookmark ribbon.
 *
 * Single source of truth for the brand mark.
 * viewBox is 32x32 (square) -- same geometry as the favicon.
 *
 * showBackground=false (default): transparent bg, ink-blue pages.
 *   Used in the Navbar on light/dark backgrounds.
 * showBackground=true: ink-blue rounded-square bg, white pages.
 *   Used for the favicon and any icon context where bg is needed.
 */
interface Props {
  size?: number;
  className?: string;
  showBackground?: boolean;
}

export function BookshelfLogo({ size = 28, className = "", showBackground = false }: Props) {
  const pageColor = showBackground ? "white" : "#1c3089";
  const bgColor = "#1c3089";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Rounded square background -- only for favicon/icon context */}
      {showBackground && (
        <rect width="32" height="32" rx="6" fill={bgColor} />
      )}

      {/* Back page */}
      <rect x="8" y="4"  width="20" height="15" rx="2.5" fill={pageColor} opacity="0.28" />
      {/* Middle page */}
      <rect x="5" y="9"  width="20" height="15" rx="2.5" fill={pageColor} opacity="0.55" />
      {/* Front page */}
      <rect x="2" y="14" width="20" height="15" rx="2.5" fill={pageColor} />
      {/* Text lines on front page */}
      <rect x="6"  y="19" width="9" height="2" rx="1" fill={showBackground ? bgColor : "white"} opacity="0.3" />
      {/* Amber bookmark ribbon */}
      <path d="M17 14 L22 14 L22 22 L19.5 20 L17 22 Z" fill="#f59e0b" />
    </svg>
  );
}
