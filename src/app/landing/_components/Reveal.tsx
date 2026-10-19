"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Fade/rise into view once. Transform/opacity only; reduced-motion handled in CSS (.lp-reveal).
 * Content already on screen at hydration is marked shown before the page is armed,
 * so it never blinks out and back in — only content entering the viewport animates.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (typeof IntersectionObserver === "undefined" || (r.top < window.innerHeight && r.bottom > 0)) {
      el.classList.add("is-in");
      setShown(true);
      document.documentElement.classList.add("lp-armed");
      return;
    }
    document.documentElement.classList.add("lp-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`lp-reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ ["--lp-d" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
