"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  basic:       "בייסיק",
  pro:         "פרו",
  groomer:     "גרומר+",
  service_dog: "Service Dog",
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const tier = searchParams.get("tier") ?? "";
  const isNewUser = searchParams.get("newuser") === "1";
  const tierLabel = TIER_LABELS[tier] ?? tier;
  const [activating, setActivating] = useState(!isNewUser); // New users already activated by success-redirect
  const [activated, setActivated] = useState(isNewUser);     // New users arrive pre-activated

  useEffect(() => {
    // Break out of Cardcom iframe if we're embedded
    if (typeof window !== "undefined" && window !== window.top) {
      window.top!.location.href = window.location.href;
      return;
    }

    // Clean up localStorage from checkout flow
    try {
      localStorage.removeItem("pendingLowProfileCode");
      localStorage.removeItem("pendingCheckoutId");
    } catch {}

    // New user flow: account was already created + activated by success-redirect.
    // Just redirect to login page after a short delay.
    if (isNewUser) {
      setTimeout(() => window.location.replace("/login"), 4000);
      return;
    }

    // Auth user flow: call activate-pending as a belt-and-suspenders approach.
    // success-redirect already tried to activate, but if it failed (e.g., no UserId
    // in Cardcom verification response), activate-pending reads the stored
    // cardcomPendingCode from DB and activates.
    fetch("/api/cardcom/activate-pending", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setActivated(true);
          console.log("Subscription activated:", data);
        } else {
          console.warn("activate-pending:", data.error ?? res.status);
        }
      })
      .catch((err) => {
        console.error("activate-pending error:", err);
      })
      .finally(() => {
        setActivating(false);
        setTimeout(() => window.location.replace("/dashboard"), 3000);
      });
  }, [isNewUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white p-8 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">התשלום הצליח!</h1>
      {tierLabel && (
        <p className="text-lg text-slate-600 mb-2">
          המנוי שלך למסלול <span className="font-bold text-green-600">{tierLabel}</span> {activated ? "פעיל עכשיו" : "מופעל..."}
        </p>
      )}
      {activating && (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          מפעיל את המנוי...
        </div>
      )}
      {isNewUser ? (
        <>
          <p className="text-slate-600 text-sm mb-2">
            שלחנו לך אימייל עם פרטי ההתחברות למערכת.
          </p>
          <p className="text-slate-400 text-sm mb-8">מועבר לדף ההתחברות בעוד מספר שניות...</p>
          <button
            onClick={() => window.location.replace("/login")}
            className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
          >
            התחבר עכשיו
          </button>
        </>
      ) : (
        <>
          <p className="text-slate-400 text-sm mb-8">מועבר לדאשבורד בעוד מספר שניות...</p>
          <button
            onClick={() => window.location.replace("/dashboard")}
            className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
          >
            עבור לדאשבורד עכשיו
          </button>
        </>
      )}
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
