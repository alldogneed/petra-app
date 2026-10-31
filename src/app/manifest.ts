import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Locale = signed-in business, else NEXT_LOCALE cookie, else he-IL (src/i18n/resolve-locale.ts).
  const locale = localeFromBusiness({ locale: await getLocale() });
  const cfg = LOCALE_CONFIG[locale];
  const t = await getTranslations({ locale, namespace: "meta.manifest" });
  return {
    name: t("name"),
    short_name: "Petra",
    description: t("description"),
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#1e293b",
    // "any" (not portrait-lock) so the installed PWA can rotate to landscape —
    // the calendar switches to week view in landscape (see calendar/page.tsx).
    orientation: "any",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["business", "productivity"],
    lang: cfg.lang,
    dir: cfg.dir,
  };
}
