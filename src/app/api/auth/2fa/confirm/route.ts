export const dynamic = 'force-dynamic';
/**
 * POST /api/auth/2fa/confirm
 * Confirms 2FA enrollment by verifying the first TOTP code.
 * Activates 2FA on the account and stores hashed backup codes.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-guards";
import { verifyTotp, generateBackupCodes } from "@/lib/totp";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({ code: z.string().min(6).max(6) });

export async function POST(request: NextRequest) {
  const { ip, userAgent } = getRequestContext(request);
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit 2FA confirmation attempts
  const rl = rateLimit("2fa:confirm", session.user.id, RATE_LIMITS.TOTP_VERIFY);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: { code: string };
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.platformUser.findUnique({ where: { id: session.user.id } });
  if (!user?.twoFaSecret) {
    return NextResponse.json({ error: "2FA enrollment not started" }, { status: 400 });
  }

  if (user.twoFaEnabled) {
    return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
  }

  const valid = await verifyTotp(user.twoFaSecret, body.code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Generate backup codes and hash them for storage
  const backupCodes = generateBackupCodes(8);
  const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.platformUser.update({
    where: { id: user.id },
    data: {
      twoFaEnabled: true,
      twoFaBackupCodes: JSON.stringify(hashedCodes),
    },
  });

  await logAudit({
    actorUserId: user.id,
    actorPlatformRole: user.platformRole,
    action: AUDIT_ACTIONS.TWO_FA_ENROLLED,
    targetType: "user",
    targetId: user.id,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, backupCodes }); // Show backup codes once
}
