"use client";
import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isActive: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    prev.current = document.activeElement as HTMLElement;
    const container = ref.current;
    if (!container) return;
    const els = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    els()[0]?.focus();

    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = els();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      prev.current?.focus();
    };
  }, [isActive]);

  return ref;
}
