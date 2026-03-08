export const dynamic = 'force-dynamic';
/**
 * POST /api/owner/broadcast
 * Send a system message to one or all active businesses.
 * Requires: SETTINGS_WRITE platform permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { logAudit, getRequestContext } from "@/lib/audit";
import { z } from "zod";

const BroadcastSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  type: z.enum(["info", "warning", "update"]),
  targetBusinessId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  let body: z.infer<typeof BroadcastSchema>;
  try {
    body = BroadcastSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let businessIds: string[];

  if (body.targetBusinessId) {
    // Single business
    const biz = await prisma.business.findUnique({
      where: { id: body.targetBusinessId },
      select: { id: true },
    });
    if (!biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    businessIds = [body.targetBusinessId];
  } else {
    // All active businesses
    const businesses = await prisma.business.findMany({
      where: { status: "active" },
      select: { id: true },
    });
    businessIds = businesses.map((b) => b.id);
  }

  // Create SystemMessage for each business
  await prisma.systemMessage.createMany({
    data: businessIds.map((businessId) => ({
      businessId,
      title: body.title,
      content: body.content,
      type: body.type,
      isRead: false,
    })),
  });

  const { ip, userAgent } = getRequestContext(request);
  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action: "BROADCAST_SENT",
    targetType: body.targetBusinessId ? "business" : "all",
    targetId: body.targetBusinessId ?? null,
    ip,
    userAgent,
    metadata: { title: body.title, type: body.type, recipientCount: businessIds.length, content: body.content.slice(0, 100) },
  });

  return NextResponse.json({ ok: true, sent: businessIds.length });
}
