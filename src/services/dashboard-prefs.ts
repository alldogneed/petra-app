/**
 * Per-member dashboard layout (BusinessUser.dashboardPrefs).
 *
 * The row is always looked up by (businessId from the session, userId from the
 * session) — callers never pass ids from the request, so a member can only read
 * or change their own layout in the business they are signed into.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  defaultDashboardPrefs,
  normalizeDashboardPrefs,
  type DashboardPrefsResponse,
} from "@/lib/dashboard-widgets";
import { ServiceError } from "./types";

export type DashboardPrefsResult = DashboardPrefsResponse;

/** Business type the owner picked in onboarding — drives the default layout. */
async function ownerBusinessType(db: PrismaClient, businessId: string): Promise<string | null> {
  const owner = await db.businessUser.findFirst({
    where: { businessId, role: "owner", isActive: true },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) return null;
  const profile = await db.onboardingProfile.findUnique({
    where: { userId: owner.userId },
    select: { businessType: true },
  });
  return profile?.businessType ?? null;
}

export async function getDashboardPrefs(
  db: PrismaClient,
  businessId: string,
  userId: string
): Promise<DashboardPrefsResult> {
  const [member, businessType] = await Promise.all([
    db.businessUser.findUnique({
      where: { businessId_userId: { businessId, userId } },
      select: { dashboardPrefs: true, isActive: true },
    }),
    ownerBusinessType(db, businessId),
  ]);
  const saved = member?.isActive ? normalizeDashboardPrefs(member.dashboardPrefs) : null;
  return {
    prefs: saved ?? defaultDashboardPrefs(businessType),
    isDefault: !saved,
    businessType,
  };
}

/** `input === null` resets to the defaults. */
export async function saveDashboardPrefs(
  db: PrismaClient,
  businessId: string,
  userId: string,
  input: unknown
): Promise<DashboardPrefsResult> {
  const member = await db.businessUser.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { id: true, isActive: true },
  });
  // Platform admins impersonating a business have no membership row — nothing to save to.
  if (!member || !member.isActive) {
    throw new ServiceError("אפשר לשמור תצוגה רק כחבר צוות פעיל בעסק", "UNAUTHORIZED");
  }

  if (input === null) {
    await db.businessUser.update({ where: { id: member.id }, data: { dashboardPrefs: Prisma.DbNull } });
    return getDashboardPrefs(db, businessId, userId);
  }

  const prefs = normalizeDashboardPrefs(input);
  if (!prefs) throw new ServiceError("הגדרות תצוגה לא תקינות", "VALIDATION");

  await db.businessUser.update({
    where: { id: member.id },
    data: { dashboardPrefs: prefs as unknown as Prisma.InputJsonValue },
  });
  return { prefs, isDefault: false, businessType: await ownerBusinessType(db, businessId) };
}
