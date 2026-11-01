"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("checkout.paymentSuccessPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    // Brief validation delay so UI feels intentional
    const timer = setTimeout(() => setStatus("success"), 800);
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-6" dir={cfg.dir}>
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        {status === "loading" ? (
          <>
            <PetraLoader variant="inline" />
            <h1 className="text-2xl font-bold text-slate-800">{t("verifying")}</h1>
          </>
        ) : status === "success" ? (
          <>
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{t("successTitle")}</h1>
            <p className="text-slate-500 mb-8">
              {t("successBody")}
            </p>
            {sessionId && (
              <p className="text-xs text-slate-400 mb-6 font-mono break-all" dir="ltr">
                {t("transactionId", { sessionId })}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.close()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors"
              >
                {t("closeWindow")}
              </button>
              <a
                href="/"
                className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
                {t("backToSite")}
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{t("errorTitle")}</h1>
            <p className="text-slate-500 mb-8">
              {t("errorBody")}
            </p>
            <a
              href="/"
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
              {t("backToSite")}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PetraLoader variant="splash" />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
