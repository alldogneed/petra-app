"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.error");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];

  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div
      dir={cfg.dir}
      className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
    >
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800">{t("title")}</h1>
        <p className="text-slate-500 text-sm">
          {error.message?.includes("מסד הנתונים") // i18n-ok — matches a server error message
            ? error.message
            : t("description")}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400">{t("errorCode", { digest: error.digest })}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("tryAgain")}
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            {t("home")}
          </a>
        </div>
      </div>
    </div>
  );
}
