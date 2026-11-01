"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { XCircle, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

const WHATSAPP_SUPPORT = "972542560964";

export default function PaymentErrorPage() {
  const router = useRouter();
  const t = useTranslations("checkout.paymentErrorPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];

  useEffect(() => {
    // Break out of Cardcom iframe if we're embedded
    if (typeof window !== "undefined" && window !== window.top) {
      window.top!.location.href = window.location.href;
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-50 to-white p-8 text-center" dir={cfg.dir}>
      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
        <XCircle className="w-10 h-10 text-red-400" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">{t("title")}</h1>
      <p className="text-slate-500 max-w-sm mb-8">
        {t("body")}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => router.replace("/upgrade")}
          className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors"
        >
          {t("retry")}
        </button>
        <button
          onClick={() => window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_SUPPORT}&text=${encodeURIComponent(t("whatsappMessage"))}`, "_blank")}
          className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          {t("contactSupport")}
        </button>
      </div>
    </div>
  );
}
