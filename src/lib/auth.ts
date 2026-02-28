/**
 * auth.ts — compatibility layer over session.ts.
 *
 * Core session management (create / validate / delete) delegates to session.ts
 * so token generation and hashing logic live in one place.
 *
 * getCurrentUser keeps its own Prisma query to fetch businessName / businessSlug /
 * avatarUrl in a single round-trip (these fields are not included in FullSession).
 *
 * Cookie helpers use the Next.js 14 synchronous cookies() API.
 */

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  createSession as _createSession,
  deleteSession as _deleteSession,
  getSessionByToken,
  SESSION_COOKIE,
} from "./session";

export { SESSION_COOKIE };

// ─── Session CRUD ─────────────────────────────────────────────────────────────

/** Create a session. Returns { token } for backward compatibility. */
export async function createSession(userId: string, req?: Request | null) {
  const ip = req?.headers.get("x-forwarded-for") ?? undefined;
  const userAgent = req?.headers.get("user-agent") ?? undefined;
  const token = await _createSession(userId, { ip, userAgent });
  return { token };
}

/** Validate a raw token. Delegates to session.ts — returns FullSession or null. */
export async function validateSession(token: string) {
  return getSessionByToken(token);
}

/** Delete a session by raw token. Delegates to session.ts. */
export async function deleteSession(token: string) {
  return _deleteSession(token);
}

// ─── Cookie helpers (Next.js 14 synchronous cookies() API) ───────────────────

export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

// ─── getCurrentUser ───────────────────────────────────────────────────────────

/**
 * Resolve the currently logged-in user with business details.
 * Uses a single Prisma query (via validateSession) + a second for business
 * slug/name — only called by layout.tsx and /api/auth/me (low frequency).
 */
export async function getCurrentUser() {
  const token = getSessionToken();
  if (!token) return null;

  // Use the full-session validator from session.ts
  const session = await validateSession(token);
  if (!session) return null;

  const membership = session.memberships[0] ?? null;

  // Fetch business details and avatarUrl in parallel (not in FullSession)
  const [business, platformUser] = await Promise.all([
    membership?.businessId
      ? prisma.business.findUnique({
          where: { id: membership.businessId },
          select: { name: true, slug: true },
        })
      : Promise.resolve(null),
    prisma.platformUser.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    }),
  ]);

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarUrl: platformUser?.avatarUrl ?? null,
    role: session.user.role || "USER",
    platformRole: session.user.platformRole,
    businessId: membership?.businessId ?? null,
    businessName: business?.name ?? null,
    businessSlug: business?.slug ?? null,
    businessRole: membership?.role ?? null,
  };
}
