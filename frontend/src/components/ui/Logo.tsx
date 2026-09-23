/**
 * BookshelfLogo -- three stacked pages with amber bookmark ribbon.
 *
 * Navbar (default): amber container rx=5, ink-blue pages.
 * Favicon (showBackground=true): solid ink-blue square, white pages.
 *
 * Centering: mark spans x=5..44 (w=39) in a 49px-wide internal space,
 * giving L=5, R=5 exactly. Container is 48px wide. A translate(0.5,0)
 * shifts the mark 0.5px right to optically center it within the container.
 * Vertical: T=6, B=6 (equal).
 */
interface Props {
  size?: number;
  className?: string;
  showBackground?: boolean;
}

export function BookshelfLogo({ size = 28, className = "", showBackground = false }: Props) {
  if (showBackground) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
        xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1c3089"/>
        <rect x="8"  y="4"  width="20" height="15" rx="2.5" fill="white" opacity="0.28"/>
        <rect x="5"  y="9"  width="20" height="15" rx="2.5" fill="white" opacity="0.55"/>
        <rect x="2"  y="14" width="20" height="15" rx="2.5" fill="white"/>
        <rect x="6"  y="19" width="9"  height="2"  rx="1"   fill="#1c3089" opacity="0.3"/>
        <path d="M17 14 L22 14 L22 22 L19.5 20 L17 22 Z" fill="#f59e0b"/>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
      xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">

      {/* Container -- amber, rx=5 as requested */}
      <rect width="48" height="48" rx="5" fill="#fbbf24"/>

      {/*
        translate(0.5, 0) shifts the mark half a pixel right so:
          left margin  = 5 + 0.5 = 5.5
          right margin = 48 - (44 + 0.5) = 3.5   ...hmm
        Better: use translate(0.5,0) so the visual center of the 39px-wide
        mark aligns with the center of the 48px container.
        Mark center without translate: (5+44)/2 = 24.5  (container center = 24)
        Shift left by 0.5: translate(-0.5, 0) → mark center = 24 ✓
      */}
      <g transform="translate(-0.5, 0)">
        {/* Back page */}
        <rect x="14" y="6"  width="30" height="22" rx="3.5" fill="#1c3089" opacity="0.28"/>
        {/* Middle page */}
        <rect x="9"  y="13" width="30" height="22" rx="3.5" fill="#1c3089" opacity="0.55"/>
        {/* Front page */}
        <rect x="5"  y="20" width="30" height="22" rx="3.5" fill="#1c3089"/>
        {/* Text lines on front page */}
        <rect x="10" y="28" width="13" height="3"  rx="1.5" fill="white" opacity="0.3"/>
        {/* Amber bookmark ribbon */}
        <path d="M29 20 L37 20 L37 32 L33 29 L29 32 Z" fill="#f59e0b"/>
      </g>
    </svg>
  );
}
