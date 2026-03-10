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

// ─── Business membership helper ───────────────────────────────────────────────

/**
 * Ensures a user has at least one active Business membership.
 * If not, auto-creates a Business + BusinessUser (owner).
 * Used for new registrations (Google OAuth, legacy users without membership).
 */
export async function ensureUserHasBusiness(
  userId: string,
  displayName: string
): Promise<string> {
  // Check for existing active membership
  const existing = await prisma.businessUser.findFirst({
    where: { userId, isActive: true },
    select: { businessId: true },
  });
  if (existing) return existing.businessId;

  // Auto-create a business for this user (atomic transaction)
  const slugBase = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "business";
  const slugSuffix = Math.random().toString(36).slice(2, 7);
  const slug = `${slugBase}-${slugSuffix}`;

  // 14-day free trial for new signups
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const business = await prisma.$transaction(async (tx) => {
    const biz = await tx.business.create({
      data: {
        name: `העסק של ${displayName}`,
        slug,
        status: "active",
        tier: "pro",         // Trial gives access to pro features
        trialEndsAt,         // Downgrades to free after 14 days
      },
    });

    await tx.businessUser.create({
      data: {
        businessId: biz.id,
        userId,
        role: "owner",
        isActive: true,
      },
    });

    return biz;
  });

  return business.id;
}

// ─── Cookie helpers (Next.js 14 synchronous cookies() API) ───────────────────

export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export function setSessionCookie(token: string, rememberMe = false) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60, // 30 days or 8 hours
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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

  let membership = session.memberships[0] ?? null;

  // Fallback: if no active membership found, look for any membership (handles
  // the case where BusinessUser.isActive was accidentally set to false).
  // This only affects UI role resolution — API endpoints enforce their own auth.
  if (!membership) {
    const anyMembership = await prisma.businessUser.findFirst({
      where: { userId: session.user.id },
      select: { businessId: true, role: true, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (anyMembership) {
      membership = { businessId: anyMembership.businessId, role: anyMembership.role as import("./permissions").TenantRole, isActive: anyMembership.isActive };
    }
  }

  // Resolve effective businessId (impersonation or membership)
  const isImpersonating = !!session.impersonatedBusinessId;
  const effectiveBusinessId = session.impersonatedBusinessId ?? membership?.businessId ?? null;

  // Fetch business details and avatarUrl in parallel (not in FullSession)
  const [business, platformUser] = await Promise.all([
    effectiveBusinessId
      ? prisma.business.findUnique({
          where: { id: effectiveBusinessId },
          select: { name: true, slug: true, tier: true, featureOverrides: true, trialEndsAt: true, subscriptionEndsAt: true },
        })
      : Promise.resolve(null),
    prisma.platformUser.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true, authProvider: true, passwordHash: true },
    }),
  ]);

  // Effective tier: if trial OR subscription expired, downgrade to "free"
  const storedTier = business?.tier ?? "free";
  const trialEndsAt = business?.trialEndsAt ?? null;
  const subscriptionEndsAt = business?.subscriptionEndsAt ?? null;
  const trialExpired = trialEndsAt && trialEndsAt < new Date();
  const subscriptionExpired = subscriptionEndsAt && subscriptionEndsAt < new Date();
  const businessEffectiveTier = (trialExpired || subscriptionExpired) ? "free" : storedTier;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarUrl: platformUser?.avatarUrl ?? null,
    role: session.user.role || "USER",
    platformRole: session.user.platformRole,
    businessId: effectiveBusinessId,
    businessName: business?.name ?? null,
    businessSlug: business?.slug ?? null,
    businessTier: storedTier,
    businessEffectiveTier,
    businessTrialEndsAt: trialEndsAt?.toISOString() ?? null,
    businessSubscriptionEndsAt: subscriptionEndsAt?.toISOString() ?? null,
    businessFeatureOverrides: (() => {
      try {
        const raw = business?.featureOverrides;
        if (!raw) return null;
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch { return null; }
    })(),
    businessRole: isImpersonating ? "owner" : (membership?.role ?? null),
    authProvider: platformUser?.authProvider ?? "local",
    hasPassword: !!platformUser?.passwordHash,
    isImpersonating,
    impersonatedBusinessId: session.impersonatedBusinessId ?? null,
  };
}
