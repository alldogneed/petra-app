import type { FullSession } from "@/lib/session";
import type { CustomerScope } from "@/services/support-tickets";

/**
 * Who sees which tickets on the customer side: the member who opened a ticket,
 * and the business owner (every ticket of the business). An impersonating
 * platform admin reads like the owner but cannot reply on the customer's behalf.
 */
export function supportScope(session: FullSession, businessId: string): CustomerScope & { canReply: boolean } {
  const impersonating = !!session.impersonatedBusinessId;
  const isOwner = session.memberships.some((m) => m.businessId === businessId && m.isActive && m.role === "owner");
  return {
    businessId,
    userId: session.user.id,
    seesAllOfBusiness: impersonating || isOwner,
    canReply: !impersonating,
  };
}
