/**
 * portal-auth.ts — auth layer for the dog-owner portal (/c/[slug]).
 *
 * Completely separate world from the business-user session (petra_session):
 * its own cookie, its own tables (PortalUser / PortalOtp / PortalSession),
 * email OTP login. Mirrors the session pattern in src/lib/session.ts —
 * raw 32-byte hex token in an HttpOnly cookie, SHA-256 hash in the DB.
 */

import { cookies } from "next/headers";
import { createHash, randomBytes, randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PortalUser } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendEmail, brandHeader, brandFooter } from "@/lib/email";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { validateIsraeliPhone, sanitizeName } from "@/lib/validation";

export const PORTAL_SESSION_COOKIE = "petra_portal_session";
export const PORTAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
/** lastSeenAt refresh throttle — mirrors the 5-minute pattern in session.ts */
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

/** SHA-256 hex digest (used for both OTP codes and session tokens) */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalize an Israeli phone to E.164 "+972..." for PortalUser storage. */
function toE164IsraeliPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return "+972" + digits;
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

/**
 * Generate a 6-digit code for the given email, store its SHA-256 hash in
 * PortalOtp (10-minute expiry), invalidate all prior unconsumed codes for the
 * email, and send the code via a Hebrew RTL email. Caller validates the email.
 */
export async function requestPortalOtp(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();

  // Invalidate prior unconsumed codes — only the newest code is ever valid
  await prisma.portalOtp.updateMany({
    where: { email: normalized, consumedAt: null },
    data: { consumedAt: now },
  });

  await prisma.portalOtp.create({
    data: {
      email: normalized,
      codeHash: sha256(code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  });

  await sendEmail({
    to: normalized,
    subject: "קוד הכניסה שלך",
    html: `
      <div dir="rtl" style="font-family:'Heebo',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        ${brandHeader()}
        <div style="padding:32px 24px;text-align:center;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">קוד הכניסה שלך לפורטל</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;">הזינו את הקוד הבא כדי להתחבר:</p>
          <div style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 32px;">
            <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#ea580c;direction:ltr;display:inline-block;">${code}</span>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#64748b;">הקוד תקף ל-10 דקות בלבד.</p>
          <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">אם לא ביקשתם קוד כניסה — אפשר להתעלם מהמייל הזה.</p>
        </div>
        ${brandFooter()}
      </div>`,
  });
}

export type OtpVerifyResult =
  | { ok: true; portalUser: { id: string; name: string; email: string; phone: string } }
  | { ok: true; needsProfile: true } // code valid but no PortalUser with this email
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" };

/**
 * Verify a 6-digit OTP for an email.
 * - attempts++ on wrong code, max 5.
 * - Atomic consume via updateMany(consumedAt: null) so a code is redeemed once.
 * - opts.consume=false lets the verify route peek without consuming
 *   (used for the needsProfile flow — consumed only on final success).
 */
export async function verifyPortalOtp(
  email: string,
  code: string,
  opts?: { consume?: boolean }
): Promise<OtpVerifyResult> {
  const consume = opts?.consume ?? true;
  const normalized = normalizeEmail(email);
  const now = new Date();

  const otp = await prisma.portalOtp.findFirst({
    where: { email: normalized, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, error: "invalid" };
  if (otp.expiresAt < now) return { ok: false, error: "expired" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  if (otp.codeHash !== sha256(code)) {
    const updated = await prisma.portalOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      ok: false,
      error: updated.attempts >= OTP_MAX_ATTEMPTS ? "too_many_attempts" : "invalid",
    };
  }

  if (consume) {
    // Atomic consume — a concurrent request can win exactly one redemption
    const consumed = await prisma.portalOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return { ok: false, error: "invalid" };
  }

  const portalUser = await prisma.portalUser.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!portalUser) return { ok: true, needsProfile: true };
  return { ok: true, portalUser };
}

// ─── PortalUser ───────────────────────────────────────────────────────────────

/**
 * Create a global PortalUser (profile-completion step after first OTP login).
 * Validates the phone as Israeli and normalizes it to E.164 "+972...".
 * Throws Error with a Hebrew message on validation failure or identity conflict.
 */
export async function createPortalUser(data: {
  email: string;
  phone: string;
  name: string;
}): Promise<PortalUser> {
  const email = normalizeEmail(data.email);
  const name = sanitizeName(data.name).slice(0, 100);
  if (name.length < 2) throw new Error("נא להזין שם מלא");

  const phoneError = validateIsraeliPhone(data.phone);
  if (phoneError) throw new Error(phoneError);
  const phone = toE164IsraeliPhone(data.phone);

  const existing = await prisma.portalUser.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true },
  });
  if (existing) throw new Error("כבר קיים חשבון עם האימייל או הטלפון הזה");

  return prisma.portalUser.create({ data: { email, phone, name } });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

/** Create a portal session and return the RAW token (64 hex chars). */
export async function createPortalSession(portalUserId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.portalSession.create({
    data: {
      portalUserId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + PORTAL_SESSION_TTL_MS),
    },
  });
  return token;
}

export function setPortalSessionCookie(token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  cookies().set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_TTL_MS / 1000,
  });
}

export function clearPortalSessionCookie(): void {
  const isProd = process.env.NODE_ENV === "production";
  cookies().set(PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function deletePortalSession(rawToken: string): Promise<void> {
  await prisma.portalSession
    .deleteMany({ where: { tokenHash: sha256(rawToken) } })
    .catch(() => null);
}

export type PortalAuthResult = {
  portalUser: { id: string; name: string; email: string; phone: string };
  sessionId: string;
};

/** Resolve the portal session from the request cookie. Null if missing/expired. */
export async function resolvePortalSession(
  request: NextRequest
): Promise<PortalAuthResult | null> {
  const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;

  const now = new Date();
  const tokenHash = sha256(token);
  const session = await prisma.portalSession.findUnique({
    where: { tokenHash },
    include: {
      portalUser: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt < now) {
    await prisma.portalSession.delete({ where: { tokenHash } }).catch(() => null);
    return null;
  }

  // Throttled lastSeenAt refresh — fire-and-forget, non-blocking
  if (session.lastSeenAt < new Date(now.getTime() - LAST_SEEN_REFRESH_MS)) {
    prisma.portalSession
      .update({ where: { tokenHash }, data: { lastSeenAt: now } })
      .catch(() => null);
  }

  return { portalUser: session.portalUser, sessionId: session.id };
}

// ─── Route guard ──────────────────────────────────────────────────────────────

export type PortalCtx = PortalAuthResult & {
  business: { id: string; name: string; slug: string; logo: string | null };
  membership: { id: string; status: string; validUntil: Date | null } | null;
};

/**
 * Guard for authenticated portal API routes under /api/portal/[slug]/...
 * - 401 {error:"נדרשת התחברות"} when there is no valid portal session.
 * - 404 when the slug is unknown, the business isn't active, or its tier
 *   lacks the online_classes feature (hasFeatureWithOverrides).
 * - membership may be null (session holders can browse before joining).
 */
export async function requirePortalAuth(
  request: NextRequest,
  slug: string
): Promise<PortalCtx | NextResponse> {
  const auth = await resolvePortalSession(request);
  if (!auth) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      status: true,
      tier: true,
      featureOverrides: true,
    },
  });
  const overrides = (business?.featureOverrides as Record<string, boolean> | null) ?? null;
  if (
    !business ||
    business.status !== "active" ||
    !hasFeatureWithOverrides(business.tier, "online_classes", overrides)
  ) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  const membership = await prisma.membership.findUnique({
    where: {
      portalUserId_businessId: {
        portalUserId: auth.portalUser.id,
        businessId: business.id,
      },
    },
    select: { id: true, status: true, validUntil: true },
  });

  return {
    ...auth,
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug as string,
      logo: business.logo,
    },
    membership,
  };
}

export function isPortalGuardError(r: PortalCtx | NextResponse): r is NextResponse {
  return r instanceof NextResponse;
}

/** Active membership = status "active" and not past validUntil (null = open-ended). */
export function isActiveMembership(
  m: { status: string; validUntil: Date | null } | null
): boolean {
  if (!m) return false;
  return m.status === "active" && (m.validUntil === null || m.validUntil >= new Date());
}
