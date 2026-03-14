/**
 * Session management utilities.
 * Uses a server-side session table (AdminSession) with a secure random token
 * stored in an HttpOnly cookie.
 */

import { cookies } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "./prisma";
import type { SessionUser, SessionMembership } from "./permissions";
import type { PlatformRole, TenantRole } from "./permissions";

export const SESSION_COOKIE = "petra_session";
/** Session timeout for regular users: 8 hours (no remember-me) */
const SESSION_TTL_REGULAR = 8 * 60 * 60 * 1000;
/** Session timeout when "remember me" is active: 30 days */
const SESSION_TTL_REMEMBER_ME = 30 * 24 * 60 * 60 * 1000;
/** Session timeout for platform admins: 30 minutes idle */
const SESSION_TTL_ADMIN = 30 * 60 * 1000;

export interface FullSession {
  user: SessionUser;
  sessionId: string;
  twoFaVerified: boolean;
  memberships: SessionMembership[];
  impersonatedBusinessId: string | null;
  impersonatedByAdminId: string | null;
}

/** Generate a 256-bit hex token */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a token with SHA-256 for secure DB storage */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a new session for a user after successful login */
export async function createSession(
  userId: string,
  options: {
    ip?: string;
    userAgent?: string;
    isPlatformAdmin?: boolean;
    rememberMe?: boolean;
  } = {}
): Promise<string> {
  const token = generateToken();
  const tokenHashed = hashToken(token);
  const ttl = options.isPlatformAdmin
    ? SESSION_TTL_ADMIN
    : options.rememberMe
    ? SESSION_TTL_REMEMBER_ME
    : SESSION_TTL_REGULAR;
  const expiresAt = new Date(Date.now() + ttl);

  await prisma.adminSession.create({
    data: {
      userId,
      token: tokenHashed,
      twoFaVerified: false,
      ipAddress: options.ip ?? null,
      userAgent: options.userAgent ?? null,
      expiresAt,
    },
  });

  return token;
}

/** Mark a session as 2FA-verified */
export async function markSessionTwoFaVerified(token: string): Promise<void> {
  const tokenHashed = hashToken(token);
  await prisma.adminSession.updateMany({
    where: { token: tokenHashed },
    data: { twoFaVerified: true },
  });
}

/** Get the current session from cookies (server-side only) */
export async function getSession(): Promise<FullSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return getSessionByToken(token);
}

/** Get a session by raw token value */
export async function getSessionByToken(token: string): Promise<FullSession | null> {
  const now = new Date();
  const tokenHashed = hashToken(token);

  const session = await prisma.adminSession.findUnique({
    where: { token: tokenHashed },
    include: {
      user: {
        include: {
          businessMemberships: {
            where: { isActive: true },
            select: { businessId: true, role: true, isActive: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < now) {
    // Expired — clean up
    await prisma.adminSession.delete({ where: { token: tokenHashed } }).catch(() => null);
    return null;
  }
  if (!session.user.isActive) return null;

  // Refresh lastSeenAt at most once every 5 minutes to avoid an extra DB write on every request
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  if (session.lastSeenAt < fiveMinutesAgo) {
    prisma.adminSession
      .update({ where: { token: tokenHashed }, data: { lastSeenAt: now } })
      .catch(() => null); // fire-and-forget — non-blocking
  }

  const user: SessionUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as { role?: string }).role ?? "USER",
    platformRole: (session.user.platformRole as PlatformRole) ?? null,
    twoFaEnabled: session.user.twoFaEnabled,
    twoFaVerified: session.twoFaVerified,
    isActive: session.user.isActive,
  };

  const memberships: SessionMembership[] = session.user.businessMemberships.map(
    (m) => ({
      businessId: m.businessId,
      role: m.role as TenantRole,
      isActive: m.isActive,
    })
  );

  return {
    user,
    sessionId: session.id,
    twoFaVerified: session.twoFaVerified,
    memberships,
    impersonatedBusinessId: session.impersonatedBusinessId ?? null,
    impersonatedByAdminId: session.impersonatedByAdminId ?? null,
  };
}

/** Delete a session (logout) */
export async function deleteSession(token: string): Promise<void> {
  const tokenHashed = hashToken(token);
  await prisma.adminSession
    .deleteMany({ where: { token: tokenHashed } })
    .catch(() => null);
}

/** Delete all sessions for a user (force logout everywhere) */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { userId } });
}

/** Set session cookie on response (call from login API route) */
export function buildSessionCookie(
  token: string,
  options: { isPlatformAdmin?: boolean } = {}
): string {
  const maxAge = options.isPlatformAdmin
    ? SESSION_TTL_ADMIN / 1000
    : SESSION_TTL_REGULAR / 1000;

  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/** Clear session cookie */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
