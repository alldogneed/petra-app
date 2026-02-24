/**
 * GET  /api/owner/feature-flags  — list all flags
 * POST /api/owner/feature-flags  — create or upsert a flag
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(guard)) return guard;

  const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(flags);
}

const FlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_.-]+$/),
  value: z.union([z.boolean(), z.string(), z.number()]),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const { ip, userAgent } = getRequestContext(request);

  let body: z.infer<typeof FlagSchema>;
  try {
    body = FlagSchema.parse(await request.json());
  } catch (e: unknown) {
    const zodError = e as { errors?: unknown };
    return NextResponse.json({ error: "Invalid request", details: zodError.errors }, { status: 400 });
  }

  const flag = await prisma.featureFlag.upsert({
    where: { key: body.key },
    create: {
      key: body.key,
      value: JSON.stringify(body.value),
      description: body.description ?? null,
      updatedByUserId: session.user.id,
    },
    update: {
      value: JSON.stringify(body.value),
      description: body.description ?? undefined,
      updatedByUserId: session.user.id,
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action: AUDIT_ACTIONS.FEATURE_FLAG_CHANGED,
    targetType: "feature_flag",
    targetId: flag.id,
    ip,
    userAgent,
    metadata: { key: body.key, value: body.value },
  });

  return NextResponse.json(flag);
}
