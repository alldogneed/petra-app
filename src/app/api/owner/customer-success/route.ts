export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";

import { getTestBusinessIds, wantsTestData } from "@/lib/platform-test-accounts";

const DAY = 86_400_000;

/**
 * Health segments — separates "signed up and never started" (onboarding failure)
 * from "was active and stopped" (real churn), so the two get different follow-up.
 */
type Segment = "churn_risk" | "never_activated" | "watch" | "new" | "healthy";

export async function GET(request: NextRequest) {
  const authResult = await requirePlatformPermission(request, "platform.settings.write");
  if (isGuardError(authResult)) return authResult;

  try {
  const includeTest = wantsTestData(new URL(request.url).searchParams);
  const testIdSet = await getTestBusinessIds();
  const testIds = includeTest ? [] : Array.from(testIdSet);

  const businesses = await prisma.business.findMany({
    where: testIds.length ? { id: { notIn: testIds } } : undefined,
    select: {
      id: true,
      name: true,
      tier: true,
      phone: true,
      createdAt: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      members: {
        where: { isActive: true },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const now = new Date();

  // Fetch customer + appointment counts separately (avoids _count TS issues)
  const businessIds = businesses.map((b) => b.id);
  const [customerCounts, apptCounts] = await Promise.all([
    prisma.customer.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: { _all: true } }),
  ]);

  // Last real activity per member. Sessions live up to 30 days, so lastLoginAt alone
  // makes daily users look gone — the activity log is the truthful signal.
  const memberIds = Array.from(new Set(businesses.flatMap((b) => b.members.map((m) => m.user.id))));
  const lastActivities = memberIds.length
    ? await prisma.activityLog.groupBy({
        by: ["userId"],
        where: { userId: { in: memberIds } },
        _max: { createdAt: true },
      })
    : [];
  const lastActivityMap = new Map(lastActivities.map((a) => [a.userId, a._max.createdAt]));

  const customerMap = Object.fromEntries(customerCounts.map((r) => [r.businessId, r._count._all]));
  const apptMap = Object.fromEntries(apptCounts.map((r) => [r.businessId, r._count._all]));

  const rows = businesses.map((b) => {
    const owner = (b.members.find((m) => m.role === "owner") ?? b.members[0])?.user ?? null;
    const daysActive = Math.floor((now.getTime() - new Date(b.createdAt).getTime()) / DAY);

    // Last sign of life of ANY active team member (login or logged action) —
    // a business whose staff works daily is not churning
    const lastLoginMs = b.members.reduce<number | null>((max, m) => {
      const login = m.user?.lastLoginAt ? new Date(m.user.lastLoginAt).getTime() : null;
      const activity = lastActivityMap.get(m.user.id);
      const act = activity ? new Date(activity).getTime() : null;
      const t = login !== null && act !== null ? Math.max(login, act) : login ?? act;
      return t !== null && (max === null || t > max) ? t : max;
    }, null);
    const lastLoginDaysAgo = lastLoginMs !== null ? Math.floor((now.getTime() - lastLoginMs) / DAY) : null;

    const customerCount = customerMap[b.id] ?? 0;
    const appointmentCount = apptMap[b.id] ?? 0;

    const trialActive = b.trialEndsAt ? new Date(b.trialEndsAt) > now : false;
    const trialDaysLeft = trialActive && b.trialEndsAt
      ? Math.ceil((new Date(b.trialEndsAt).getTime() - now.getTime()) / DAY)
      : null;
    const subDaysLeft = b.subscriptionEndsAt
      ? Math.ceil((new Date(b.subscriptionEndsAt).getTime() - now.getTime()) / DAY)
      : null;

    const paying = b.tier !== "free" && b.subscriptionStatus === "active";
    const everUsed = customerCount > 0 || appointmentCount > 0;

    let segment: Segment;
    if (daysActive <= 3) {
      segment = "new";
    } else if (!everUsed) {
      segment = "never_activated";
    } else if (lastLoginDaysAgo === null || lastLoginDaysAgo > 14) {
      segment = "churn_risk";
    } else if (lastLoginDaysAgo > 7 || customerCount <= 2) {
      segment = "watch";
    } else {
      segment = "healthy";
    }

    // Higher = handle first. Paying customers at risk outrank everything.
    const segmentWeight: Record<Segment, number> = {
      churn_risk: 60, never_activated: 30, watch: 20, new: 10, healthy: 0,
    };
    const priority =
      segmentWeight[segment] +
      (paying && segment !== "healthy" ? 40 : 0) +
      (subDaysLeft !== null && subDaysLeft >= 0 && subDaysLeft <= 7 ? 25 : 0) +
      (trialDaysLeft !== null && trialDaysLeft <= 3 ? 10 : 0);

    return {
      businessId: b.id,
      businessName: b.name,
      tier: b.tier,
      paying,
      phone: b.phone ?? null,
      createdAt: b.createdAt,
      daysActive,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      lastLoginAt: lastLoginMs !== null ? new Date(lastLoginMs) : null,
      lastLoginDaysAgo,
      customerCount,
      appointmentCount,
      trialActive,
      trialDaysLeft,
      subscriptionStatus: b.subscriptionStatus ?? null,
      subDaysLeft,
      segment,
      priority,
      isTest: testIdSet.has(b.id),
    };
  });

  rows.sort((a, b) => b.priority - a.priority || a.daysActive - b.daysActive);

  const count = (s: Segment) => rows.filter((r) => r.segment === s).length;
  const stats = {
    total: rows.length,
    churnRisk: count("churn_risk"),
    payingAtRisk: rows.filter((r) => r.paying && r.segment === "churn_risk").length,
    neverActivated: count("never_activated"),
    watch: count("watch"),
    fresh: count("new"),
    healthy: count("healthy"),
  };

  return NextResponse.json({ rows, stats, includeTest });
  } catch (error) {
    console.error("GET /api/owner/customer-success error:", error);
    return NextResponse.json({ error: "Failed to fetch customer success data" }, { status: 500 });
  }
}
