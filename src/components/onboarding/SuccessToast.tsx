"use client";

import { useEffect } from "react";

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onDone: () => void;
  /** Auto-dismiss after ms (default 2500) */
  duration?: number;
}

export function SuccessToast({
  message,
  visible,
  onDone,
  duration = 2500,
}: SuccessToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] animate-slide-up">
      <div
        className="bg-white rounded-2xl shadow-modal px-6 py-4 border border-emerald-100 flex items-center gap-3"
        style={{ minWidth: 280 }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#ECFDF5" }}
        >
          <span className="text-lg">🎉</span>
        </div>
        <p className="text-sm font-medium text-petra-text leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}
