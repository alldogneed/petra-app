"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// The browser fires `beforeinstallprompt` once, early in the page lifecycle, and
// the captured event can only be consumed a single time. Capturing it in two
// independent components (the bottom nudge banner + the hamburger-menu button)
// races and breaks the second `prompt()` call. This provider owns the single
// capture and exposes it to every consumer via context.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface PWAInstallContextValue {
  /** Native install prompt is available (Android / desktop Chrome / Edge). */
  canInstall: boolean;
  /** iOS device — no prompt API; consumers should show manual instructions. */
  isIOS: boolean;
  /** Running as an already-installed standalone PWA. */
  isInstalled: boolean;
  /** Trigger the native install prompt. Resolves to the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PWAInstallContext = createContext<PWAInstallContextValue>({
  canInstall: false,
  isIOS: false,
  isInstalled: false,
  promptInstall: async () => "unavailable",
});

export function usePWAInstall() {
  return useContext(PWAInstallContext);
}

function detectIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());
    if (detectStandalone()) setIsInstalled(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep the event so we can prompt() on demand later
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // the captured event is single-use
    if (outcome === "accepted") setIsInstalled(true);
    return outcome;
  }, [deferred]);

  return (
    <PWAInstallContext.Provider
      value={{ canInstall: !!deferred && !isInstalled, isIOS, isInstalled, promptInstall }}
    >
      {children}
    </PWAInstallContext.Provider>
  );
}
