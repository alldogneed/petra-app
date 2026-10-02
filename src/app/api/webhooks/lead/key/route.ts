export const dynamic = 'force-dynamic';
/**
 * GET  /api/webhooks/lead/key  — return current webhook API key for the business
 * POST /api/webhooks/lead/key  — generate (or regenerate) a new webhook API key
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError, type FullSession } from "@/lib/auth-guards";
import { TENANT_PERMS, sessionHasTenantPermission } from "@/lib/permissions";

function generateKey(): string {
  return "pk_" + randomBytes(24).toString("hex");
}

/** Owner (or a member the owner granted SETTINGS_CRITICAL) may view or regenerate webhook API keys */
function requireOwnerRole(authResult: { session: FullSession; businessId: string }): NextResponse | null {
  if (!sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.SETTINGS_CRITICAL)) {
    return NextResponse.json({ error: "רק בעלים יכול לנהל מפתחות API" }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ownerCheck = requireOwnerRole(authResult);
    if (ownerCheck) return ownerCheck;

    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { webhookApiKey: true },
    });

    return NextResponse.json({ key: business?.webhookApiKey ?? null });
  } catch (error) {
    console.error("Failed to get webhook key:", error);
    return NextResponse.json({ error: "Failed to get webhook key" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ownerCheck = requireOwnerRole(authResult);
    if (ownerCheck) return ownerCheck;

    const newKey = generateKey();

    await prisma.business.update({
      where: { id: authResult.businessId },
      data: { webhookApiKey: newKey, webhookApiKeyCreatedAt: new Date() },
    });

    return NextResponse.json({ key: newKey });
  } catch (error) {
    console.error("Failed to generate webhook key:", error);
    return NextResponse.json({ error: "Failed to generate webhook key" }, { status: 500 });
  }
}
