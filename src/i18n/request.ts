/**
 * next-intl request config — "without i18n routing": the dashboard has no
 * locale prefix; the locale comes from the business (see resolve-locale.ts).
 */
import { getRequestConfig } from "next-intl/server";
import { LOCALE_CONFIG } from "@/lib/locale";
import { resolveRequestLocale } from "./resolve-locale";

export default getRequestConfig(async () => {
  const { locale, timeZone } = await resolveRequestLocale();
  const lang = LOCALE_CONFIG[locale].lang;
  const messages = (await import(`../../messages/${lang}.json`)).default;
  if (lang === "he") return { locale, timeZone, messages };
  // A key missing in en.json falls back to the Hebrew source instead of the raw key path.
  const he = (await import("../../messages/he.json")).default;
  return { locale, timeZone, messages: deepMerge(he, messages) };
});

type Messages = { [key: string]: string | Messages };

function deepMerge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v;
  }
  return out;
}
