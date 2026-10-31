"use client";

import { XCircle, ArrowRight, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export default function PaymentCancelledPage() {
  const t = useTranslations("checkout.paymentCancelledPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-6" dir={cfg.dir}>
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{t("title")}</h1>
        <p className="text-slate-500 mb-8">
          {t("body")}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t("retry")}
          </button>
          <a
            href="/"
            className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
            {t("backToSite")}
          </a>
        </div>
      </div>
    </div>
  );
}
