/**
 * GoogleSignInButton
 * Uses Google Identity Services One-Tap / button flow.
 * Initializes only once per page load using a module-level flag.
 */
import { useEffect, useRef } from "react";

interface Props {
  onCredential: (credential: string) => void;
  label?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ onCredential, label = "Continue with Google" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  // Store callback in a ref so Google's SDK always calls the latest version
  const callbackRef = useRef(onCredential);
  useEffect(() => { callbackRef.current = onCredential; }, [onCredential]);

  useEffect(() => {
    if (!clientId) return;

    const tryRender = () => {
      if (!window.google || !containerRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          callbackRef.current(response.credential);
        },
        // Use popup mode to avoid COOP/cross-origin issues
        ux_mode: "popup",
      });

      // Clear the container before rendering to avoid duplicate buttons
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: label === "Continue with Google" ? "continue_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: containerRef.current.getBoundingClientRect().width || 368,
        });
      }
    };

    // Google script may not be loaded yet
    if (window.google) {
      tryRender();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          tryRender();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  // Only run once on mount -- label and clientId won't change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;

  return <div ref={containerRef} className="w-full" />;
}
