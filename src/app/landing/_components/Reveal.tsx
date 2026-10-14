"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fade/rise into view once. Transform/opacity only; reduced-motion handled in CSS (.lp-reveal). */
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add("lp-armed");
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
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
