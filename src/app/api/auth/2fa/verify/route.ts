export const dynamic = 'force-dynamic';
/**
 * POST /api/auth/2fa/verify
 * Verifies TOTP code after login (step 2 of 2FA login flow).
 * Marks the session as 2FA-verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-guards";
import { verifyTotp } from "@/lib/totp";
import { prisma } from "@/lib/prisma";
import { decryptTwoFaSecret } from "@/lib/encryption";
import { markSessionTwoFaVerified, SESSION_COOKIE } from "@/lib/session";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({
  code: z.string().min(6).max(8), // 6 for TOTP, 8 for backup code
});

export async function POST(request: NextRequest) {
  const { ip, userAgent } = getRequestContext(request);
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit 2FA verify attempts
  const rl = rateLimit("2fa:verify", session.user.id, RATE_LIMITS.TOTP_VERIFY);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 });
  }

  let body: { code: string };
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.platformUser.findUnique({
    where: { id: session.user.id },
    select: { id: true, twoFaEnabled: true, twoFaSecret: true, twoFaBackupCodes: true, platformRole: true },
  });
  if (!user || !user.twoFaEnabled || !user.twoFaSecret) {
    return NextResponse.json({ error: "2FA not configured" }, { status: 400 });
  }

  if (session.twoFaVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const normalizedCode = body.code.replace(/\s/g, "");
  let verified = false;

  // Try TOTP first
  if (normalizedCode.length === 6) {
    verified = await verifyTotp(decryptTwoFaSecret(user.twoFaSecret), normalizedCode);
  }

  // Try backup codes if TOTP failed
  if (!verified && user.twoFaBackupCodes) {
    let codes: string[];
    try {
      codes = JSON.parse(user.twoFaBackupCodes);
    } catch {
      console.error(`[2FA] Corrupted twoFaBackupCodes for user ${user.id}`);
      codes = [];
    }
    for (let i = 0; i < codes.length; i++) {
      const match = await bcrypt.compare(normalizedCode.toUpperCase(), codes[i]);
      if (match) {
        // Invalidate used backup code
        const updatedCodes = codes.filter((_, idx) => idx !== i);
        await prisma.platformUser.update({
          where: { id: user.id },
          data: { twoFaBackupCodes: JSON.stringify(updatedCodes) },
        });
        verified = true;
        break;
      }
    }
  }

  if (!verified) {
    await logAudit({
      actorUserId: user.id,
      actorPlatformRole: user.platformRole,
      action: AUDIT_ACTIONS.TWO_FA_FAILED,
      targetType: "user",
      targetId: user.id,
      ip,
      userAgent,
    });
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Mark session as 2FA verified
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await markSessionTwoFaVerified(token);
  }

  await logAudit({
    actorUserId: user.id,
    actorPlatformRole: user.platformRole,
    action: AUDIT_ACTIONS.TWO_FA_VERIFIED,
    targetType: "user",
    targetId: user.id,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
