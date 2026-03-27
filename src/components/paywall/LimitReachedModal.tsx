"use client";

import { useState, useEffect } from "react";
import { Lock, Crown, X, Zap } from "lucide-react";
import Link from "next/link";
import { LIMIT_REACHED_EVENT, type LimitReachedDetail } from "@/lib/limit-reached";

export function LimitReachedModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<LimitReachedDetail>).detail;
      setMessage(detail.message);
      setOpen(true);
    }
    window.addEventListener(LIMIT_REACHED_EVENT, handler);
    return () => window.removeEventListener(LIMIT_REACHED_EVENT, handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="סגור"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-center text-lg font-bold text-slate-900 mb-2">
          הגעת לתקרת המנוי החינמי
        </h2>

        {/* Message from API */}
        <p className="text-center text-sm text-slate-500 leading-relaxed mb-5">
          {message}
        </p>

        {/* Upgrade CTA */}
        <Link
          href="/upgrade"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors"
        >
          <Crown className="w-4 h-4" />
          שדרג לבייסיק — ₪99/חודש
        </Link>

        {/* What you get */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3 text-brand-500" />
            מה מקבלים בבייסיק:
          </p>
          <ul className="space-y-1">
            {[
              "תורים, לקוחות והזמנות ללא הגבלה",
              "תזכורות WhatsApp אוטומטיות",
              "Google Calendar סנכרון",
              "אנליטיקס ודוחות",
              "לינקי תשלום ללקוחות",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 text-[9px] font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setOpen(false)}
          className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors"
        >
          אולי אחר כך
        </button>
      </div>
    </div>
  );
}
