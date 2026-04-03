export const dynamic = 'force-dynamic';
/**
 * POST /api/auth/2fa/enroll
 * Begins 2FA enrollment: generates a TOTP secret and returns QR URI.
 * Does NOT enable 2FA yet — user must confirm with a valid code.
 *
 * GET /api/auth/2fa/enroll
 * Returns current TOTP URI for re-display during enrollment.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-guards";
import { generateTotpSecret, totpUri, generateBackupCodes } from "@/lib/totp";
import { prisma } from "@/lib/prisma";

/** Step 1: Generate and return the TOTP setup info */
export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession(request);
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.platformUser.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.twoFaEnabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
    }

    // Generate secret and store it temporarily (not enabled until confirmed)
    const secret = generateTotpSecret();
    await prisma.platformUser.update({
      where: { id: user.id },
      data: { twoFaSecret: secret }, // stored but twoFaEnabled still false
    });

    const uri = totpUri(secret, user.email);
    const backupCodes = generateBackupCodes(8);

    return NextResponse.json({
      secret,
      uri,
      backupCodes, // Show once — user must save these
    });
  } catch (error) {
    console.error("2fa/enroll POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
