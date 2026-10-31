"use client";

import { useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { isModuleHidden, isScreenHiddenForVertical, normalizeVertical, type VerticalModule } from "@/lib/verticals";
import { vocab, type VocabKey, type VocabOptions } from "@/lib/verticals/vocab";

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

  const v = useCallback(
    (key: VocabKey, params?: VocabOptions["params"]) => vocab(key, { vertical, params }),
    [vertical],
  );
  const hides = useCallback((module: VerticalModule) => isModuleHidden(vertical, module), [vertical]);
  const hidesScreen = useCallback((path: string) => isScreenHiddenForVertical(vertical, path), [vertical]);

  return { vertical, isGeneric: vertical === "generic", v, hides, hidesScreen };
}
