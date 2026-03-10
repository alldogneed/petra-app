"use client";

import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 30;

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallPWABanner() {
  const [show, setShow] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) return;
    // Don't show if recently dismissed
    if (isDismissed()) return;

    const ios = isIOS();
    setIsIOSDevice(ios);

    if (ios && isSafari()) {
      // iOS Safari — show manual instructions
      setShow(true);
      return;
    }

    // Chrome/Edge/Android/Desktop — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choice) => {
      if (choice.outcome === "accepted") {
        setShow(false);
        dismiss();
      }
    });
  }

  function handleDismiss() {
    setShow(false);
    dismiss();
  }

  if (!show) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-0 inset-x-0 z-50 bg-slate-900 text-white p-4 shadow-2xl flex items-start gap-3"
    >
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
          הורד
        </button>
      )}

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-slate-400 hover:text-white p-1 transition-colors"
        aria-label="סגור"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
