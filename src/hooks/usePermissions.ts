"use client";

import { useAuth } from "@/providers/auth-provider";
import { getClientPermissions, type ClientPermissions } from "@/lib/permissions";

/**
 * usePermissions — fine-grained role-based permission hook.
 *
 * Returns a set of booleans derived from the current user's business role.
 * Use this for UI-level access control (hiding/showing elements).
 * Security is always enforced on the server — this is for UX only.
 *
 * Usage:
 *   const perms = usePermissions();
 *   if (!perms.canSeeFinance) return null;
 *   if (perms.isManager) return <RequestApprovalButton />;
 *   if (perms.isOwner) return <DeleteButton />;
 */
export function usePermissions(): ClientPermissions {
  const { user, loading } = useAuth();

  // While loading, grant all permissions to prevent UI flicker
  if (loading || !user) {
    return getClientPermissions("owner");
  }

  return getClientPermissions(user.businessRole);
}
