/**
 * BookshelfLogo -- three stacked pages with amber bookmark ribbon.
 *
 * Centered geometry: mark spans x=5..44 (w=39), y=6..42 (h=36) inside 48x48.
 * Margins: left=5, right=4, top=6, bottom=6 -- visually equal on all sides.
 *
 * showBackground=false (default/navbar):
 *   Light mode: warm amber-tinted fill (#fef3c7)
 *   Dark mode:  deep amber-brown fill (#3d2000)
 *   Pages: ink-blue (#1c3089)
 *
 * showBackground=true (favicon):
 *   Solid ink-blue square, white pages.
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

  // Navbar mark: 48x48 internal canvas, centered geometry, amber container
  // Rendered at `size` px via viewBox scaling
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
      xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">

      {/* Container -- amber, same in both light and dark */}
      <rect width="48" height="48" rx="10" fill="#fbbf24"/>

      {/*
        Mark geometry -- centered in 48x48:
        Back page:   x=14, y=6,  w=30, h=22  → right=44, bottom=28
        Middle page: x=9,  y=13, w=30, h=22  → right=39, bottom=35
        Front page:  x=5,  y=20, w=30, h=22  → right=35, bottom=42
        Horizontal span: 5..44 = 39px, margin L=5 R=4 (≈equal)
        Vertical span:   6..42 = 36px, margin T=6 B=6 (equal)
      -->

      {/* Back page */}
      <rect x="14" y="6"  width="30" height="22" rx="3.5" fill="#1c3089" opacity="0.28"/>
      {/* Middle page */}
      <rect x="9"  y="13" width="30" height="22" rx="3.5" fill="#1c3089" opacity="0.55"/>
      {/* Front page */}
      <rect x="5"  y="20" width="30" height="22" rx="3.5" fill="#1c3089"/>
      {/* Text lines on front page */}
      <rect x="10" y="28" width="13" height="3"  rx="1.5" fill="white" opacity="0.3"/>
      {/* Amber bookmark ribbon -- positioned relative to front page top-right */}
      <path d="M29 20 L37 20 L37 32 L33 29 L29 32 Z" fill="#f59e0b"/>
    </svg>
  );
}
