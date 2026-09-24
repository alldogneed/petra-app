"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Petra loading animation — bouncing paw + PETRA wordmark (the full logo, in every variant).
// Geometry + colors come from the "Petra Splash" design; keyframes live in globals.css.
//
// ONE loader for the whole app, three variants:
//   page   — data is loading for the main body of a screen. Fixed at the center of the content
//            area (viewport minus sidebar), always the same size + spot, so moving between
//            loading.tsx → page → tab never makes the paw jump. Several at once overlap into one.
//   splash — app open / full-screen guards. Same paw, same size, opaque background + PETRA.
//   inline — small regions only (modal, dropdown, card, side panel). In normal flow.

const SCALE = { page: 0.6, splash: 0.6, inline: 0.4 } as const;
const CYCLE_MS = 1500;

const TOES = [
  { left: 7, top: 48, width: 46, height: 62, rotate: -30, color: "#FE4C09", delay: 0 },
  { left: 45, top: 0, width: 52, height: 68, rotate: -12, color: "#0083DB", delay: 0.13 },
  { left: 111, top: 0, width: 52, height: 68, rotate: 10, color: "#FFCB00", delay: 0.26 },
  { left: 160, top: 46, width: 43, height: 56, rotate: 30, color: "#25BB59", delay: 0.39 },
];

// Layout effect on the client = the portal switch happens before first paint
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const px = (n: number) => `calc(${n}px * var(--petra-loader-scale))`;
const delay = (s: number) => `calc(var(--petra-loader-phase) + ${s}s)`;

interface PetraLoaderProps {
  variant?: keyof typeof SCALE;
  className?: string;
}

export function PetraLoader({ variant = "page", className }: PetraLoaderProps) {
  const overlay = variant !== "inline";

  // Overlays move to <body> after mount so a transformed ancestor (animate-slide-up etc.)
  // can't capture `position: fixed` and shift the paw.
  const [mounted, setMounted] = useState(false);
  useIsomorphicLayoutEffect(() => setMounted(true), []);

  const node = (
    <div
      role="status"
      aria-label="טוען"
      // phase differs between server and client render by design
      suppressHydrationWarning
      className={cn(
        "petra-loader flex items-center justify-center",
        variant === "page" && "petra-loader-page",
        variant === "splash" && "petra-loader-splash",
        // inline: wordmark sits in normal flow, so any padding a caller passes can't make it overlap
        variant === "inline" && "flex-col py-10",
        className
      )}
      style={
        {
          "--petra-loader-scale": SCALE[variant],
          // Every loader bounces on the same wall-clock beat, so swapping one for another is seamless
          "--petra-loader-phase": `${-(Date.now() % CYCLE_MS)}ms`,
        } as React.CSSProperties
      }
    >
      <div className="relative" style={{ width: px(210), height: px(172) }}>
        {TOES.map((t) => (
          <div
            key={t.color}
            className="absolute"
            style={{
              left: px(t.left),
              top: px(t.top),
              width: px(t.width),
              height: px(t.height),
              transform: `rotate(${t.rotate}deg)`,
            }}
          >
            <div className="petra-loader-toe" style={{ background: t.color, animationDelay: delay(t.delay) }} />
          </div>
        ))}
        <div className="absolute" style={{ left: px(41), top: px(70), width: px(127), height: px(100) }}>
          <div className="petra-loader-pad" style={{ animationDelay: delay(0.2) }} />
        </div>
        {/* Overlays: the wordmark hangs below the paw so the paw itself stays at the exact center */}
        {overlay && (
          <div
            className="petra-loader-wordmark petra-loader-wordmark-hanging"
            style={{ top: `calc(100% + ${px(22)})`, fontSize: px(43), letterSpacing: px(2) }}
          >
            PETRA
          </div>
        )}
      </div>
      {!overlay && (
        <div className="petra-loader-wordmark" style={{ marginTop: px(22), fontSize: px(43), letterSpacing: px(2) }}>
          PETRA
        </div>
      )}
    </div>
  );

  return overlay && mounted ? createPortal(node, document.body) : node;
}
