"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, Share } from "lucide-react";

// All state is per-device (localStorage) — PWA install is a per-device/per-browser
// thing, so a DB flag would wrongly suppress the nudge on a second device.
const INSTALLED_KEY = "pwa-installed";
const OPTOUT_KEY = "pwa-install-optout";
const SNOOZE_COUNT_KEY = "pwa-install-snooze-count";
const SNOOZE_UNTIL_KEY = "pwa-install-snooze-until";
const LEGACY_DISMISS_KEY = "pwa-install-dismissed"; // old "X = forever" key → treat as opt-out

const MAX_SNOOZES = 3;
const SNOOZE_MS = 5 * 24 * 60 * 60 * 1000; // reappear after ~5 days
const REVEAL_DELAY_MS = 3500; // small delay so it isn't jarring on load

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}
function lsNum(k: string): number {
  return parseInt(lsGet(k) || "0", 10) || 0;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
}
/** Mobile/tablet only — the home-screen install nudge is irrelevant on desktop. */
function isMobile(): boolean {
  if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) return true;
  try {
    return window.matchMedia("(pointer: coarse)").matches &&
      Math.min(window.innerWidth, window.innerHeight) < 820;
  } catch {
    return false;
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPWABanner() {
  const [show, setShow] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ── Record "installed" via every reliable signal, so we never nag installed users ──
    const markInstalled = () => { lsSet(INSTALLED_KEY, "1"); setShow(false); };
    if (isStandalone()) markInstalled(); // running inside the installed app
    // Best-effort: Chrome/Android can report the installed PWA from a browser tab.
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    nav.getInstalledRelatedApps?.().then((apps) => {
      if (Array.isArray(apps) && apps.length > 0) markInstalled();
    }).catch(() => { /* unsupported */ });
    // Fires the moment they install (our prompt or the browser's own menu).
    const onInstalled = () => markInstalled();
    window.addEventListener("appinstalled", onInstalled);

    // Migrate the old permanent-dismiss into the new opt-out so we don't re-nag.
    if (lsGet(LEGACY_DISMISS_KEY) === "1" && lsGet(OPTOUT_KEY) !== "1") lsSet(OPTOUT_KEY, "1");

    // ── Eligibility: mobile, not installed, not opted-out, under snooze cap, past snooze ──
    const eligible =
      isMobile() &&
      lsGet(INSTALLED_KEY) !== "1" &&
      lsGet(OPTOUT_KEY) !== "1" &&
      lsNum(SNOOZE_COUNT_KEY) < MAX_SNOOZES &&
      Date.now() >= lsNum(SNOOZE_UNTIL_KEY);

    if (!eligible) {
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    const reveal = () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => {
        if (lsGet(INSTALLED_KEY) === "1") return; // changed during the delay
        setShow(true);
      }, REVEAL_DELAY_MS);
    };

    let promptHandler: ((e: Event) => void) | null = null;
    if (isIOS() && isSafari()) {
      // iOS Safari exposes no install prompt and no install-state API — show manual
      // instructions; snooze cap + opt-out keep it from being annoying.
      setIsIOSDevice(true);
      reveal();
    } else {
      promptHandler = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e as BeforeInstallPromptEvent);
        reveal();
      };
      window.addEventListener("beforeinstallprompt", promptHandler);
    }

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      if (promptHandler) window.removeEventListener("beforeinstallprompt", promptHandler);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choice) => {
      if (choice.outcome === "accepted") { lsSet(INSTALLED_KEY, "1"); setShow(false); }
    });
  }

  function handleClose() {
    setShow(false);
    if (dontShowAgain) {
      lsSet(OPTOUT_KEY, "1"); // never again
    } else {
      lsSet(SNOOZE_COUNT_KEY, String(lsNum(SNOOZE_COUNT_KEY) + 1)); // soft: comes back later
      lsSet(SNOOZE_UNTIL_KEY, String(Date.now() + SNOOZE_MS));
    }
  }

  if (!show) return null;

  return (
    <div
      dir="rtl"
      // z-40: below modals (.modal-overlay is z-50) so it never covers their
      // bottom action buttons on mobile; above the bottom nav (z-30).
      className="fixed bottom-0 inset-x-0 z-40 bg-slate-900 text-white p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        {/* App icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="Petra" className="w-10 h-10 rounded-xl flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">הוסף את Petra למסך הבית</p>

          {isIOSDevice ? (
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">
              לחץ על{" "}
              <Share className="inline w-3.5 h-3.5 mx-0.5 text-blue-400" />
              {" "}ואז &ldquo;הוסף למסך הבית&rdquo;
            </p>
          ) : (
            <p className="text-xs text-slate-300 mt-0.5">
              גישה מהירה, עבודה כמו אפליקציה אמיתית
            </p>
          )}
        </div>

        {!isIOSDevice && installPrompt && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            התקנה
          </button>
        )}

        <button
          onClick={handleClose}
          className="flex-shrink-0 text-slate-400 hover:text-white p-1 transition-colors"
          aria-label="אחר כך"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Don't-show-again — soft close (X) snoozes; checked = never again */}
      <label className="flex items-center gap-2 mt-2 pr-[52px] text-xs text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="w-3.5 h-3.5 accent-orange-500"
        />
        אל תציג שוב
      </label>
    </div>
  );
}
