/**
 * Owner security alerts for sensitive actions (ניהול ובקרה → התראות).
 * Called by logActivity() for every row that has a businessId.
 * STUB — implemented by the security-alerts work package.
 */
import type { ActivityLog } from "@prisma/client";

export async function onActivityLogged(_entry: ActivityLog): Promise<void> {
  // implemented in work package C
}
