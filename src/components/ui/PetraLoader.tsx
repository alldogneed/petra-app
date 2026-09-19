import { cn } from "@/lib/utils";

// Petra loading animation — bouncing paw (+ PETRA wordmark).
// Pure CSS (keyframes in globals.css), no client JS — safe in loading.tsx / Suspense fallbacks.
// Geometry + colors come from the "Petra Splash" design; everything scales through --petra-loader-scale.

const SCALE = { sm: 0.22, md: 0.4, lg: 0.6 } as const;

const TOES = [
  { left: 7, top: 48, width: 46, height: 62, rotate: -30, color: "#FE4C09", delay: 0 },
  { left: 45, top: 0, width: 52, height: 68, rotate: -12, color: "#0083DB", delay: 0.13 },
  { left: 111, top: 0, width: 52, height: 68, rotate: 10, color: "#FFCB00", delay: 0.26 },
  { left: 160, top: 46, width: 43, height: 56, rotate: 30, color: "#25BB59", delay: 0.39 },
];

const px = (n: number) => `calc(${n}px * var(--petra-loader-scale))`;

interface PetraLoaderProps {
  /** lg = app splash, md = page/section, sm = card/modal */
  size?: keyof typeof SCALE;
  /** PETRA wordmark under the paw. Default: only on lg. */
  wordmark?: boolean;
  /** Fill the viewport (app open, guards). */
  fullScreen?: boolean;
  className?: string;
}

export function PetraLoader({ size = "md", wordmark, fullScreen = false, className }: PetraLoaderProps) {
  const showWordmark = wordmark ?? size === "lg";

  return (
    <div
      role="status"
      aria-label="טוען"
      className={cn(
        "petra-loader flex items-center justify-center",
        fullScreen && "min-h-screen min-h-[100dvh] bg-petra-bg",
        className
      )}
      style={{ "--petra-loader-scale": SCALE[size] } as React.CSSProperties}
    >
      <div className="petra-loader-inner flex flex-col items-center">
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
              <div
                className="petra-loader-toe w-full h-full rounded-full"
                style={{ background: t.color, animationDelay: `${t.delay}s` }}
              />
            </div>
          ))}
          <div className="absolute" style={{ left: px(41), top: px(70), width: px(127), height: px(100) }}>
            <div className="petra-loader-pad w-full h-full" />
          </div>
        </div>
        {showWordmark && (
          <div
            className="petra-loader-wordmark"
            style={{ marginTop: px(22), fontSize: px(43), letterSpacing: px(2) }}
          >
            PETRA
          </div>
        )}
      </div>
    </div>
  );
}
