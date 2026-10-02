/**
 * Internal/test account detection for the platform admin panel.
 *
 * Test businesses (QA, design sandboxes) must not inflate MRR, churn-risk and
 * usage numbers. There is no DB flag — a business counts as "test" when it has
 * members and EVERY member's email is a test address. A real customer who adds
 * a test user to their team is therefore never classified as test.
 *
 * Server-only (reads env + prisma).
 */

import { prisma } from "@/lib/prisma";

// "petra-test.com" stays open for self-registration on purpose (onboarding QA signs up
// with it), so anyone could use it — hence the paid-business safety net below.
const TEST_EMAIL_DOMAINS = ["petra.local", "petra-test.com"];
const TEST_EMAILS = ["testuser@petra-app.com"];

function extraTestEmails(): string[] {
  return (process.env.PLATFORM_TEST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return (
    TEST_EMAIL_DOMAINS.includes(domain) ||
    TEST_EMAILS.includes(e) ||
    extraTestEmails().includes(e)
  );
}

/** Ids of businesses whose members are all test accounts. */
export async function getTestBusinessIds(): Promise<Set<string>> {
  const memberships = await prisma.businessUser.findMany({
    select: { businessId: true, user: { select: { email: true } } },
  });

  const allTest = new Map<string, boolean>();
  for (const m of memberships) {
    const prev = allTest.get(m.businessId) ?? true;
    allTest.set(m.businessId, prev && isTestEmail(m.user?.email));
  }

  const ids = new Set<string>();
  allTest.forEach((isTest, id) => {
    if (isTest) ids.add(id);
  });
  if (ids.size === 0) return ids;

  // Safety net: a business that actually paid through Cardcom is never "test",
  // whatever its members' emails — real revenue must not disappear from MRR.
  const paid = await prisma.business.findMany({
    where: { id: { in: Array.from(ids) }, subscriptionStatus: "active", cardcomDealId: { not: null } },
    select: { id: true },
  });
  for (const b of paid) ids.delete(b.id);
  return ids;
}

/** Ids of platform users with a test email. */
export async function getTestUserIds(): Promise<Set<string>> {
  const extra = extraTestEmails();
  const users = await prisma.platformUser.findMany({
    where: {
      OR: [
        ...TEST_EMAIL_DOMAINS.map((d) => ({ email: { endsWith: `@${d}`, mode: "insensitive" as const } })),
        ...[...TEST_EMAILS, ...extra].map((e) => ({ email: { equals: e, mode: "insensitive" as const } })),
      ],
    },
    select: { id: true },
  });
  return new Set(users.map((u) => u.id));
}

/** `?includeTest=1` on platform admin endpoints opts back into test data. */
export function wantsTestData(searchParams: URLSearchParams): boolean {
  return searchParams.get("includeTest") === "1";
}
