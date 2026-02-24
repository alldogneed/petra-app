"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface CoachmarkProps {
  /** CSS selector or element id to highlight */
  targetSelector: string;
  /** Tooltip text (1-2 lines max) */
  text: string;
  /** Preferred position */
  position?: "top" | "bottom" | "left" | "right";
  /** Whether to show the coachmark */
  active: boolean;
  /** Called when the highlighted element is clicked */
  onTargetClick?: () => void;
  /** Optional pulse animation on the target */
  pulse?: boolean;
}

export function Coachmark({
  targetSelector,
  text,
  position = "bottom",
  active,
  onTargetClick,
  pulse = true,
}: CoachmarkProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updatePosition = useCallback(() => {
    const el = document.querySelector(targetSelector);
    if (el) {
      setRect(el.getBoundingClientRect());
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [targetSelector]);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    // Initial position
    updatePosition();

    // Watch for layout changes
    const el = document.querySelector(targetSelector);
    if (el) {
      observerRef.current = new ResizeObserver(updatePosition);
      observerRef.current.observe(el);
    }

    // Reposition on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [active, targetSelector, updatePosition]);

  // Intercept clicks on the target
  useEffect(() => {
    if (!active || !onTargetClick) return;

    const el = document.querySelector(targetSelector);
    if (!el) return;

    const handler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onTargetClick();
    };

    el.addEventListener("click", handler, true);
    return () => el.removeEventListener("click", handler, true);
  }, [active, targetSelector, onTargetClick]);

  if (!active || !visible || !rect) return null;

  const padding = 8;
  const highlightStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: 16,
    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.5)",
    zIndex: 55,
    pointerEvents: "none",
  };

  // Allow clicks through to the highlighted element
  const clickableStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    zIndex: 57,
    cursor: "pointer",
    background: "transparent",
  };

  // Compute tooltip position
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 56,
    maxWidth: 300,
  };

  switch (position) {
    case "bottom":
      tooltipStyle.top = rect.bottom + padding + 12;
      tooltipStyle.left = rect.left + rect.width / 2;
      tooltipStyle.transform = "translateX(-50%)";
      break;
    case "top":
      tooltipStyle.bottom = window.innerHeight - rect.top + padding + 12;
      tooltipStyle.left = rect.left + rect.width / 2;
      tooltipStyle.transform = "translateX(-50%)";
      break;
    case "left":
      tooltipStyle.top = rect.top + rect.height / 2;
      tooltipStyle.right = window.innerWidth - rect.left + padding + 12;
      tooltipStyle.transform = "translateY(-50%)";
      break;
    case "right":
      tooltipStyle.top = rect.top + rect.height / 2;
      tooltipStyle.left = rect.right + padding + 12;
      tooltipStyle.transform = "translateY(-50%)";
      break;
  }

  // Clamp to viewport
  if (tooltipStyle.left && typeof tooltipStyle.left === "number") {
    tooltipStyle.left = Math.max(16, Math.min(tooltipStyle.left, window.innerWidth - 316));
  }

  return (
    <>
      {/* Overlay highlight cutout */}
      <div style={highlightStyle}>
        {pulse && (
          <div
            className="absolute inset-0 rounded-2xl animate-pulse-soft"
            style={{
              border: "2px solid #F97316",
              boxShadow: "0 0 0 4px rgba(249,115,22,0.2)",
            }}
          />
        )}
      </div>

      {/* Clickable area over the target */}
      {onTargetClick && (
        <div style={clickableStyle} onClick={onTargetClick} />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle} className="animate-slide-up">
        <div
          className="bg-white rounded-2xl shadow-modal px-4 py-3 border border-petra-border"
          style={{ direction: "rtl" }}
        >
          <p className="text-sm font-medium text-petra-text leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </>
  );
}
