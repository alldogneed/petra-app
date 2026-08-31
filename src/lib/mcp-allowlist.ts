/**
 * MCP beta allowlist — server-side only.
 *
 * While the MCP integration is in private beta, only these accounts may see
 * the "עוזרי AI" settings tab, manage connections, or authenticate MCP calls:
 *   - the alldog production account + Or's account (DEFAULT_ALLOWED_EMAILS)
 *   - internal test users (any @petra.local email)
 *   - extra emails via the MCP_ALLOWED_EMAILS env var (comma-separated)
 *
 * Set MCP_BETA_OPEN=true to open MCP to all subscribers (general availability).
 */
import prisma from "@/lib/prisma";

const DEFAULT_ALLOWED_EMAILS = [
  "alldogneed@gmail.com",
  "or.rabinovich@gmail.com",
];

const TEST_EMAIL_SUFFIX = "@petra.local";

/** Internal QA accounts (server-seeded only — self-registration with this suffix is blocked). */
export function isInternalTestEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(TEST_EMAIL_SUFFIX);
}

/** Session-level gate: platform admins OR allowlisted email. Use for UI + connection APIs. */
export function isMcpAllowedUser(email: string | null | undefined, platformRole: string | null | undefined): boolean {
  if (platformRole === "super_admin" || platformRole === "admin") return true;
  return isMcpAllowedEmail(email);
}

export function isMcpAllowedEmail(email: string | null | undefined): boolean {
  if (process.env.MCP_BETA_OPEN === "true") return true;
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.endsWith(TEST_EMAIL_SUFFIX)) return true;
  if (DEFAULT_ALLOWED_EMAILS.includes(normalized)) return true;
  const extra = (process.env.MCP_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(normalized);
}

/**
 * Defense-in-depth for the MCP endpoint itself: a token is only valid if the
 * business it belongs to has at least one active member on the allowlist.
 * Keeps pre-existing tokens of non-beta businesses inert without revoking them.
 */
export async function isMcpAllowedBusiness(businessId: string): Promise<boolean> {
  if (process.env.MCP_BETA_OPEN === "true") return true;
  const members = await prisma.businessUser.findMany({
    where: { businessId, isActive: true },
    select: { user: { select: { email: true } } },
  });
  return members.some((m) => isMcpAllowedEmail(m.user.email));
}
