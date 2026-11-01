"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { isModuleHidden, isScreenHiddenForVertical, normalizeVertical, type VerticalModule } from "@/lib/verticals";
import { vocab, type VocabKey, type VocabOptions } from "@/lib/verticals/vocab";
import { isValueOffered, valueLabel } from "@/lib/verticals/catalog";

/**
 * useVertical — the business's vertical on the client (docs/verticals).
 *
 *   const { isGeneric, v, hides } = useVertical();
 *   v("nav.training")        → dogs: "ניהול תהליכי אילוף" · generic: "ניהול תוכניות"
 *   hides("pets")            → true for generic → don't render the element (not a paywall)
 *
 * While auth is loading the vertical is "dogs" — today's UI — so existing businesses
 * never see a flash of a different screen.
 */
export function useVertical() {
  const { user } = useAuth();
  const vertical = normalizeVertical(user?.businessVertical);
  const locale = useLocale();

  const v = useCallback(
    (key: VocabKey, params?: VocabOptions["params"]) => vocab(key, { vertical, locale, params }),
    [vertical, locale],
  );
  /**
   * Same words, ALWAYS Hebrew (no locale): for customer-facing message texts that are still
   * Hebrew data built in the client (`// i18n-ok`, Phase 3) — never mix an English word into them.
   */
  const vData = useCallback(
    (key: VocabKey, params?: VocabOptions["params"]) => vocab(key, { vertical, params }),
    [vertical],
  );
  const hides = useCallback((module: VerticalModule) => isModuleHidden(vertical, module), [vertical]);
  const hidesScreen = useCallback((path: string) => isScreenHiddenForVertical(vertical, path), [vertical]);

  /** Is a stored enum value (task category, order type…) offered? dogs → always. */
  const offers = useCallback((value: string) => isValueOffered(vertical, value), [vertical]);
  /** Label of a stored enum value. dogs → `dogsLabel` unchanged. */
  const label = useCallback((value: string, dogsLabel: string) => valueLabel(vertical, value, dogsLabel, locale), [vertical, locale]);

  return { vertical, isGeneric: vertical === "generic", v, vData, hides, hidesScreen, offers, label };
}
