"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Link from "next/link";
import { CreditCard, CheckCircle2, Mail } from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  basic:       "בייסיק",
  pro:         "פרו",
  groomer:     "גרומר+",
  service_dog: "Service Dog",
};

function TrialSuccessContent() {
  const searchParams = useSearchParams();
  const tier = searchParams.get("tier") ?? "";
  const isNewUser = searchParams.get("newuser") === "1";
  const tierLabel = TIER_LABELS[tier] ?? tier;

  useEffect(() => {
    // Break out of Cardcom iframe if embedded
    if (typeof window !== "undefined" && window !== window.top) {
      window.top!.location.href = window.location.href;
      return;
    }
    // New users wait for welcome email — no auto-redirect
    if (isNewUser) return;

    // Existing users: wait 5s then navigate to dashboard
    const t = setTimeout(() => {
      window.location.replace("/dashboard");
    }, 5000);
    return () => clearTimeout(t);
  }, [isNewUser]);

  // ── New user: account just created, check your email ──────────────────────
  if (isNewUser) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white p-8 text-center"
        dir="rtl"
      >
        <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-brand-500" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">הכרטיס אומת בהצלחה! 🎉</h1>
        <p className="text-slate-500 text-base mb-6">החשבון שלך נוצר ו-14 ימי הניסיון מתחילים עכשיו</p>

        {/* Email notice */}
        <div className="bg-white border border-brand-100 rounded-2xl p-5 mb-6 max-w-sm w-full text-right shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <Mail className="w-5 h-5 text-brand-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-800">בדוק את האימייל שלך</p>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            שלחנו לך אימייל עם פרטי הכניסה הראשוניים שלך למערכת פטרה.
            <br />
            <span className="text-slate-400 mt-1 block">לא קיבלת? בדוק בתיקיית הספאם.</span>
          </p>
        </div>

        {/* Trial info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 max-w-sm w-full text-right space-y-2 shadow-sm">
          <ul className="space-y-2">
            <li className="flex items-center gap-2.5 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-[11px]">✓</span>
              <span>כרטיס אומת — <strong>לא חויבת</strong> כלום</span>
            </li>
            {tierLabel && (
              <li className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">P</span>
                <span>מסלול <strong>{tierLabel}</strong> — 14 יום ניסיון מלא</span>
              </li>
            )}
            <li className="flex items-center gap-2.5 text-sm text-slate-700">
              <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>לאחר 14 יום — חיוב חודשי אוטומטי</span>
            </li>
            <li className="flex items-center gap-2.5 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0 font-bold text-[11px]">✕</span>
              <span>בטלת בניסיון? <strong>₪0 — ללא חיוב</strong></span>
            </li>
          </ul>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">ביטול: הגדרות ← ניהול מנוי ← בטל מנוי</p>
        </div>

        <Link
          href="/login"
          className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors text-sm"
        >
          כניסה למערכת →
        </Link>
      </div>
    );
  }

  // ── Existing user: show confirmation + auto-redirect ──────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white p-8 text-center"
      dir="rtl"
    >
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-amber-500" />
      </div>

      <h1 className="text-3xl font-bold text-slate-900 mb-3">הכרטיס אומת בהצלחה! 🎉</h1>

      {tierLabel && (
        <p className="text-lg text-slate-600 mb-2">
          ניסיון חינמי של 14 יום למסלול{" "}
          <span className="font-bold text-amber-600">{tierLabel}</span> מתחיל עכשיו
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 max-w-sm text-right space-y-2 shadow-sm">
        <ul className="space-y-2">
          <li className="flex items-center gap-2.5 text-sm text-slate-700">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-[11px]">✓</span>
            <span>כרטיס אומת — <strong>לא חויבת</strong> כלום</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-slate-700">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">14</span>
            <span>14 ימי ניסיון מלאים מתחילים עכשיו</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-slate-700">
            <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>לאחר 14 יום — חיוב חודשי אוטומטי</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-slate-700">
            <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0 font-bold text-[11px]">✕</span>
            <span>בטלת בניסיון? <strong>₪0 — ללא חיוב</strong></span>
          </li>
        </ul>
        <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">ביטול: הגדרות ← ניהול מנוי ← בטל מנוי</p>
      </div>

      <p className="text-slate-400 text-sm mb-8">מועבר לדאשבורד בעוד מספר שניות...</p>

      <button
        onClick={() => window.location.replace("/dashboard")}
        className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
      >
        עבור לדאשבורד עכשיו
      </button>
    </div>
  );
}

export default function TrialSuccessPage() {
  return (
    <Suspense>
      <TrialSuccessContent />
    </Suspense>
  );
}
