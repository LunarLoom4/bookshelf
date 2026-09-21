/**
 * BookshelfLogo -- Option C: three stacked pages with amber bookmark ribbon.
 * Colors are hardcoded to stay consistent on any background.
 */
interface Props {
  size?: number;
  className?: string;
}

export function BookshelfLogo({ size = 28, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Back page -- lightest, offset up-right */}
      <rect x="5" y="0" width="22" height="14" rx="2.5" fill="#1c3089" opacity="0.28"/>
      {/* Middle page */}
      <rect x="3" y="3" width="22" height="14" rx="2.5" fill="#1c3089" opacity="0.55"/>
      {/* Front page -- full opacity */}
      <rect x="1" y="6" width="22" height="14" rx="2.5" fill="#1c3089"/>
      {/* Text lines on front page */}
      <rect x="5" y="11" width="10" height="1.5" rx="0.75" fill="white" opacity="0.35"/>
      <rect x="5" y="14.5" width="7" height="1.5" rx="0.75" fill="white" opacity="0.25"/>
      {/* Amber bookmark ribbon on top-right of front page */}
      <path d="M19 6 L23 6 L23 14 L21 12.2 L19 14 Z" fill="#f59e0b"/>
    </svg>
  );
}
