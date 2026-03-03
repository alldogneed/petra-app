export const dynamic = 'force-dynamic';
/**
 * GET  /api/webhooks/lead/key  — return current webhook API key for the business
 * POST /api/webhooks/lead/key  — generate (or regenerate) a new webhook API key
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

function generateKey(): string {
  return "pk_" + randomBytes(24).toString("hex");
}

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const business = await prisma.business.findUnique({
    where: { id: authResult.businessId },
    select: { webhookApiKey: true },
  });

  return NextResponse.json({ key: business?.webhookApiKey ?? null });
}

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const newKey = generateKey();

  await prisma.business.update({
    where: { id: authResult.businessId },
    data: { webhookApiKey: newKey },
  });

  return NextResponse.json({ key: newKey });
}
