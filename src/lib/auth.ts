import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import crypto from "crypto";

const SESSION_COOKIE = "petra_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Hash a token with SHA-256 for secure DB storage */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, req?: Request) {
  const token = generateToken();
  const tokenHashed = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const ipAddress = req?.headers.get("x-forwarded-for") || null;
  const userAgent = req?.headers.get("user-agent") || null;

  const session = await prisma.adminSession.create({
    data: {
      userId,
      token: tokenHashed,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return { session, token };
}

export async function validateSession(token: string) {
  const tokenHashed = hashToken(token);
  const session = await prisma.adminSession.findUnique({
    where: { token: tokenHashed },
    include: {
      user: {
        include: {
          businessMemberships: {
            where: { isActive: true },
            include: { business: true },
          },
        },
      },
    },
  });

  if (!session) return null;

  // Check if expired
  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } });
    return null;
  }

  // Update lastSeenAt
  await prisma.adminSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session;
}

export async function deleteSession(token: string) {
  const tokenHashed = hashToken(token);
  await prisma.adminSession.deleteMany({ where: { token: tokenHashed } });
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value || null;
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

export async function getCurrentUser() {
  const token = getSessionToken();
  if (!token) return null;

  const session = await validateSession(token);
  if (!session) return null;

  const user = session.user;
  const membership = user.businessMemberships[0] || null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: (user as any).role || "USER",
    platformRole: user.platformRole,
    businessId: membership?.businessId || null,
    businessName: membership?.business?.name || null,
    businessRole: membership?.role || null,
  };
}
