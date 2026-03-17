"use client";

import { useState } from "react";
import { Accessibility, X, Plus, Minus, RotateCcw } from "lucide-react";

export function AccessibilityButton() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(100);

  function applyScale(next: number) {
    document.documentElement.style.fontSize = next === 100 ? "" : `${next}%`;
    setScale(next);
  }

  return (
    <div className="fixed bottom-[76px] sm:bottom-[88px] right-5 z-50 flex flex-col items-end">
      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="הגדרות נגישות"
          className="mb-3 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-52"
        >
          <p className="text-xs font-bold text-slate-500 mb-4 text-center tracking-wide uppercase">
            נגישות
          </p>

          {/* Font size label */}
          <p className="text-[11px] text-slate-500 mb-2 text-center">גודל טקסט</p>

          {/* +/- controls */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              onClick={() => applyScale(Math.max(80, scale - 10))}
              disabled={scale <= 80}
              aria-label="הקטן טקסט"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Minus className="w-4 h-4 text-slate-700" />
            </button>
            <span className="text-sm font-bold text-slate-800 min-w-[3rem] text-center tabular-nums">
              {scale}%
            </span>
            <button
              onClick={() => applyScale(Math.min(150, scale + 10))}
              disabled={scale >= 150}
              aria-label="הגדל טקסט"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 mb-3">
            {([100, 120, 140] as const).map((v) => (
              <button
                key={v}
                onClick={() => applyScale(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scale === v
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {v === 100 ? "רגיל" : v === 120 ? "גדול" : "גדול מאוד"}
              </button>
            ))}
          </div>

          {/* Reset */}
          {scale !== 100 && (
            <button
              onClick={() => applyScale(100)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              איפוס
            </button>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "סגור תפריט נגישות" : "פתח תפריט נגישות"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2"
      >
        {open ? (
          <X className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        ) : (
          <Accessibility className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
