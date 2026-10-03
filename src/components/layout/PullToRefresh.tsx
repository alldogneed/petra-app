"use client";

/**
 * Pull-to-refresh for every screen inside the app shell (touch devices only).
 *
 * Pull down while the page is scrolled to the top → release past the threshold →
 * every active React Query refetches and server components re-render
 * (router.refresh). Native pull-to-refresh is disabled while this is mounted
 * (overscroll-behavior-y: none) so Chrome/Android doesn't hard-reload the page and
 * the installed iOS PWA (which has none) gets one.
 *
 * Skipped when: a dialog/sheet is open, body scroll is locked, the page isn't at the
 * top, the touch starts inside an inner scroller that isn't at its top, or inside
 * a form field / map / [data-no-pull-refresh] element.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70; // px of (damped) pull needed to refresh
const MAX_PULL = 110;
const DAMPING = 0.5;

function blockedTarget(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest("input, textarea, select, [contenteditable=true], [data-no-pull-refresh]")) return true;
  if (el.closest("[role=dialog], [aria-modal=true], .modal-overlay, [data-topbar-panel]")) return true;
  // An inner scroller that is not at its top owns this gesture
  while (el && el !== document.body) {
    if (el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

function modalOpen(): boolean {
  if (document.body.style.overflow === "hidden" || document.documentElement.style.overflow === "hidden") return true;
  return !!document.querySelector("[aria-modal=true], .modal-overlay, [data-topbar-panel]");
}

export function PullToRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const html = document.documentElement;
    const prevOverscroll = html.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = "none";

    const reset = () => {
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      if (window.scrollY > 0 || modalOpen() || blockedTarget(e.target)) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) reset();
        else startY.current = dy < 0 ? null : startY.current;
        return;
      }
      const next = Math.min(MAX_PULL, dy * DAMPING);
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      const reached = pullRef.current >= THRESHOLD;
      reset();
      if (!reached || refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      try {
        await Promise.all([
          queryClient.invalidateQueries({ refetchType: "active" }),
          new Promise((r) => setTimeout(r, 600)), // keep the spinner visible long enough to read
        ]);
        router.refresh();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      html.style.overscrollBehaviorY = prevOverscroll;
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [queryClient, router]);

  const visible = refreshing || pull > 4;
  const offset = refreshing ? THRESHOLD : pull;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
    >
      {visible && (
        <div
          className={cn(
            "w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center",
            !refreshing && pull === 0 && "transition-transform"
          )}
          style={{ transform: `translateY(${offset - 44}px)`, opacity: refreshing ? 1 : 0.35 + progress * 0.65 }}
        >
          <RefreshCw
            className={cn("w-5 h-5", progress >= 1 || refreshing ? "text-orange-500" : "text-slate-400", refreshing && "animate-spin")}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
          <span className="sr-only">{refreshing ? "מרענן נתונים…" : progress >= 1 ? "שחרר כדי לרענן" : "משוך כדי לרענן"}</span>
        </div>
      )}
    </div>
  );
}
