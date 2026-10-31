"use client";

import { useMemo } from "react";
import { useLocale, useTimeZone } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { LOCALE_CONFIG, localeFromBusiness, type Locale, type LocaleConfig } from "@/lib/locale";

export interface BusinessLocale {
  locale: Locale;
  currency: string;
  timezone: string;
  country: string;
  cfg: LocaleConfig;
}

/**
 * The active business's locale settings for client components — pass them to
 * the helpers in `@/lib/format` (formatCurrency / formatDate / formatTime /
 * dateFnsLocaleFor / formatPhone).
 *
 * `locale` + `timezone` come from next-intl (resolved server-side from the
 * business, so they are right on the very first render); currency + country
 * come from `/api/auth/me`, falling back to the locale defaults while loading.
 */
export function useBusinessLocale(): BusinessLocale {
  const intlLocale = useLocale();
  const timeZone = useTimeZone();
  const { user } = useAuth();
  const currencyFromUser = user?.businessCurrency ?? null;
  const countryFromUser = user?.businessCountry ?? null;
  return useMemo(() => {
    const locale = localeFromBusiness({ locale: intlLocale });
    const cfg = LOCALE_CONFIG[locale];
    return {
      locale,
      cfg,
      currency: currencyFromUser || cfg.currency,
      country: countryFromUser || cfg.country,
      timezone: timeZone || cfg.timezone,
    };
  }, [intlLocale, timeZone, currencyFromUser, countryFromUser]);
}
