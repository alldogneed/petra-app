import { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.onboardingLayout");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("onboarding.onboardingLayout");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: await getLocale() })];
  return (
    <div
      className="min-h-screen flex flex-col"
      dir={cfg.dir}
      style={{ background: "#F8FAFC" }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Petra" width={28} height={28} />
          <span className="text-lg font-bold text-petra-text">Petra</span>
        </div>
        <span className="text-sm text-petra-muted">{t("headerLabel")}</span>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        {children}
      </main>
    </div>
  );
}
