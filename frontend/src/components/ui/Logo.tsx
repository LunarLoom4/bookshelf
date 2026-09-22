/**
 * BookshelfLogo -- three stacked pages with amber bookmark ribbon.
 *
 * The mark always sits inside a soft rounded-square container:
 *   - Light mode: very light ink-tinted fill (#eef0f8), no border
 *   - Dark mode:  deep navy fill (#1e2740), no border
 * This gives the mark presence on both light and dark navbars
 * without the heaviness of the full solid favicon background.
 *
 * showBackground=true (favicon): solid ink-blue square, white pages.
 * Default (navbar): soft container, ink-blue pages.
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
      {showBackground ? (
        /* Favicon / icon context: solid ink-blue background */
        <rect width="32" height="32" rx="6" fill={bgColor} />
      ) : (
        /* Navbar context: soft container that adapts to light/dark mode */
        <>
          {/* Light mode container */}
          <rect width="32" height="32" rx="7" fill="#dde3f5" className="dark:hidden" />
          {/* Dark mode container */}
          <rect width="32" height="32" rx="7" fill="#1e2740" className="hidden dark:block" />
        </>
      )}

      {/* Back page */}
      <rect x="8" y="4"  width="20" height="15" rx="2.5" fill={pageColor} opacity="0.28" />
      {/* Middle page */}
      <rect x="5" y="9"  width="20" height="15" rx="2.5" fill={pageColor} opacity="0.55" />
      {/* Front page */}
      <rect x="2" y="14" width="20" height="15" rx="2.5" fill={pageColor} />
      {/* Text lines on front page */}
      <rect x="6" y="19" width="9" height="2" rx="1" fill={showBackground ? bgColor : "white"} opacity="0.3" />
      {/* Amber bookmark ribbon */}
      <path d="M17 14 L22 14 L22 22 L19.5 20 L17 22 Z" fill="#f59e0b" />
    </svg>
  );
}
