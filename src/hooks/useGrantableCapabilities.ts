"use client";

import { useAuth } from "@/providers/auth-provider";
import { hasFeatureWithOverrides, type TierKey } from "@/lib/feature-flags";
import { CAPABILITY_GROUPS, CRITICAL_CAPABILITIES, SERVICE_DOG_CAPABILITY_GROUPS, TENANT_PERMS, VIEW_SCREENS } from "@/lib/permissions";
import { isModuleHidden, isScreenHiddenForVertical } from "@/lib/verticals";
import { vocab } from "@/lib/verticals/vocab";

/**
 * The capability groups and checkboxes the owner sees in the team screens.
 * Service-dog tab permissions appear only for a business that has the module.
 */
export function useGrantableCapabilities() {
  const { user } = useAuth();
  const tier = (user?.businessEffectiveTier ?? user?.businessTier ?? "free") as TierKey;
  const hasServiceDogs = hasFeatureWithOverrides(tier, "service_dogs", user?.businessFeatureOverrides ?? null);

  // Verticals (docs/verticals): a module the vertical hides has no screen to grant, and the
  // service-dog tab groups don't exist there either. "dogs" → the lists are unchanged.
  const vertical = user?.businessVertical;
  const sdVisible = hasServiceDogs && !isModuleHidden(vertical, "service_dogs");
  const groups = CAPABILITY_GROUPS.filter((g) => sdVisible || !SERVICE_DOG_CAPABILITY_GROUPS.includes(g.id));
  const hiddenScreenPerms = new Set<string>(
    VIEW_SCREENS.filter((v) => isScreenHiddenForVertical(vertical, v.prefix)).map((v) => v.perm)
  );
  const capabilities = CRITICAL_CAPABILITIES
    .filter((c) => groups.some((g) => g.id === c.group))
    .filter((c) => !hiddenScreenPerms.has(c.key))
    .map((c) => {
      if (c.key === TENANT_PERMS.CRITICAL_DELETE) return { ...c, label: vocab("team.critical_delete_label", { vertical }) };
      if (c.key === TENANT_PERMS.VIEW_TRAINING) return { ...c, label: vocab("team.view_training_label", { vertical }), hint: vocab("team.view_training_hint", { vertical }) };
      return c;
    });
  return { groups, capabilities };
}
