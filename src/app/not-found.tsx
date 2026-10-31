import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: await getLocale() })];
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      dir={cfg.dir}
      style={{ background: "linear-gradient(135deg, #FDF8F4 0%, #F9F3EC 100%)" }}
    >
      <Image src="/petra-logo.png" alt="Petra" width={56} height={56} style={{ borderRadius: 12 }} />
      <div
        className="text-8xl font-bold"
        style={{ color: "#C4956A" }}
      >
        404
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-petra-text">{t("title")}</h1>
        <p className="text-petra-muted max-w-xs">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-colors"
          style={{ background: "#C4956A" }}
        >
          {t("home")}
        </Link>
        <Link
          href="/customers"
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-center border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          style={{ color: "#3D2E1F" }}
        >
          {t("clientsList")}
        </Link>
      </div>

      <p className="text-xs text-petra-muted mt-4">
        {t("contactSupport")}
      </p>
    </div>
  );
}
