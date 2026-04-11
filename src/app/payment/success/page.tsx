"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { CheckCircle2 } from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  basic:       "בייסיק",
  pro:         "פרו",
  groomer:     "גרומר+",
  service_dog: "Service Dog",
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tier = searchParams.get("tier") ?? "";
  const tierLabel = TIER_LABELS[tier] ?? tier;
  // Cardcom appends lowprofilecode to the success URL
  const lowProfileCode = searchParams.get("lowprofilecode") ?? searchParams.get("LowProfileCode") ?? "";

  useEffect(() => {
    // Break out of Cardcom iframe if we're embedded
    if (typeof window !== "undefined" && window !== window.top) {
      window.top!.location.href = window.location.href;
      return;
    }

    // Fallback: call success-redirect to activate subscription server-side.
    // success-redirect verifies payment via Cardcom API (no sig needed).
    if (lowProfileCode) {
      fetch(`/api/cardcom/success-redirect?lowprofilecode=${encodeURIComponent(lowProfileCode)}&tier=${encodeURIComponent(tier)}`)
        .then(() => {
          // Wait a moment then redirect to dashboard
          setTimeout(() => window.location.replace("/dashboard"), 2000);
        })
        .catch(() => {
          setTimeout(() => window.location.replace("/dashboard"), 2000);
        });
    } else {
      // No lowprofilecode — just redirect after delay
      const t = setTimeout(() => {
        window.location.replace("/dashboard");
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [lowProfileCode]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white p-8 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">התשלום הצליח! 🎉</h1>
      {tierLabel && (
        <p className="text-lg text-slate-600 mb-2">
          המנוי שלך למסלול <span className="font-bold text-green-600">{tierLabel}</span> פעיל עכשיו
        </p>
      )}
      <p className="text-slate-400 text-sm mb-8">מועבר לדאשבורד בעוד מספר שניות...</p>
      <button
        onClick={() => window.location.replace("/dashboard")}
        className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
      >
        עבור לדאשבורד עכשיו
      </button>
      <p className="mt-6 text-xs text-slate-400 max-w-xs">
        אם לא רואה את השינוי מיד — רענן את הדף. הנתונים מתעדכנים תוך שניות ספורות.
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
