/**
 * PDFViewer — native browser PDF renderer via <iframe>.
 *
 * Page navigation reloads the iframe at #page=N. The PDF proxy streams
 * from R2 so re-loads are fast. This is the only reliable way to navigate
 * Chrome's built-in PDF viewer to a specific page.
 */
import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from "react";

export interface PDFViewerHandle {
  goToPage: (page: number) => void;
  getCurrentPage: () => number;  // returns the page number from current iframe src
}

interface Props {
  url: string;
  downloadFilename?: string;
  onPageChange?: (page: number) => void;
}

const PDFViewer = forwardRef<PDFViewerHandle, Props>(({ url }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentSrc, setCurrentSrc] = useState(url);
  const [iframeKey, setIframeKey] = useState(0); // increment to force remount
  const currentPageNum = useRef(1); // tracks page set via goToPage
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadedOnce = useRef(false);

  const pendingPageRef = useRef<number | null>(null); // page to jump to after initial load
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildSrc = useCallback((page: number) => {
    const base = url.split("#")[0];
    return page > 1 ? `${base}#page=${page}` : base;
  }, [url]);

  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => {
      currentPageNum.current = page;

      if (!loadedOnce.current) {
        // PDF hasn't finished loading yet -- queue this page for after load.
        // The onLoad handler will call goToPage with pendingPageRef value.
        pendingPageRef.current = page;
        // Update the initial src so the PDF loads directly at this page.
        setCurrentSrc(buildSrc(page));
        return;
      }

      // PDF is already loaded -- hash-only change navigates instantly.
      // The native PDF viewer does NOT fire onLoad for hash changes,
      // so we clear the spinner after a short fixed delay instead.
      setCurrentSrc(buildSrc(page));
      setLoading(true);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => setLoading(false), 600);
    },
    getCurrentPage: () => currentPageNum.current,
  }));

  return (
    <div className="flex flex-col h-full relative">
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-800 z-10 pointer-events-none">
          <div className="w-8 h-8 border-4 border-gray-600 border-t-ink-400 rounded-full animate-spin" />
          <p className="text-sm">
            {loadedOnce.current ? "Jumping to page..." : "Loading PDF..."}
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-800 z-10">
          <p className="text-red-400 text-sm">Failed to load PDF.</p>
          <button
            onClick={() => {
              setError(false);
              setLoading(true);
              setCurrentSrc(url);
            }}
            className="text-xs text-ink-400 hover:text-ink-300 underline"
          >
            Retry
          </button>
        </div>
      )}
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={currentSrc}
        className="w-full flex-1 border-0"
        style={{ display: "block", minHeight: 0, height: "100%" }}
        title="PDF Viewer"
        onLoad={() => {
          loadedOnce.current = true;
          setLoading(false);
          setError(false);
          // If a page jump was queued before the PDF finished loading, apply it now.
          if (pendingPageRef.current !== null) {
            const page = pendingPageRef.current;
            pendingPageRef.current = null;
            // Small delay so the PDF viewer has rendered before we hash-navigate
            setTimeout(() => {
              currentPageNum.current = page;
              setCurrentSrc(buildSrc(page));
              // Clear spinner after hash navigation settles
              setTimeout(() => setLoading(false), 600);
            }, 100);
          }
        }}
        onError={() => { setLoading(false); setError(true); }}
        allow="fullscreen"
      />
    </div>
  );
});

PDFViewer.displayName = "PDFViewer";
export default PDFViewer;
