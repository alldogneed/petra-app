/**
 * Server-side context for a Petra AI request: which screen, which plan, which
 * role, how far the business setup got. Everything is resolved from the session
 * and the database — the only client input is the pathname, and it is reduced
 * to a known menu screen before use.
 */

import prisma from "@/lib/prisma";
import type { FullSession } from "@/lib/session";
import { isSubscriptionLapsed } from "@/lib/subscription-access";
import { resolveAssistantScreen } from "./screens";
import type { AssistantContext } from "./system-prompt";

export async function loadAssistantContext(
  session: FullSession,
  businessId: string,
  pathname: string | null | undefined
): Promise<AssistantContext> {
  const [business, progress, servicesCount, customersCount] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { tier: true, phone: true, subscriptionEndsAt: true, subscriptionStatus: true, cardcomRecurringId: true },
    }),
    prisma.onboardingProgress.findUnique({
      where: { userId: session.user.id },
      select: { stepCompleted1: true, stepCompleted2: true, stepCompleted3: true },
    }),
    prisma.service.count({ where: { businessId, isActive: true } }),
    prisma.customer.count({ where: { businessId } }),
  ]);

  // Same rule as getCurrentUser(): a lapsed subscription is effectively the free plan.
  const tier = business && !isSubscriptionLapsed(business) ? business.tier : "free";

  // An impersonating platform admin acts as the owner.
  const role = session.impersonatedBusinessId
    ? "owner"
    : session.memberships.find((m) => m.isActive && m.businessId === businessId)?.role ?? null;

  // Same live detection as getOnboardingProgress() (services/business.ts), core steps only.
  const setupDone = [
    !!progress?.stepCompleted1 || !!business?.phone,
    !!progress?.stepCompleted2 || servicesCount > 0,
    !!progress?.stepCompleted3 || customersCount > 0,
  ];

  return { screen: resolveAssistantScreen(pathname), tier, role, setupDone };
}
