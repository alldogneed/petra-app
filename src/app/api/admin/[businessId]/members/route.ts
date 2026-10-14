export const dynamic = 'force-dynamic';
/**
 * GET  /api/admin/[businessId]/members  — list members of a business
 * POST /api/admin/[businessId]/members  — invite a new member (TeamInvitation + email;
 *                                         the membership is created when the invitee accepts)
 * Requires: tenant.users.read / tenant.users.write
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS, canModifyTenantRole, type TenantRole } from "@/lib/permissions";
import { rateLimitAsync } from "@/lib/rate-limit";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";
import { z } from "zod";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import {
  INVITE_RATE_LIMIT, INVITE_ROLES, deliverInvitation, inviteUrl, normalizeEmail, serializeInvitation, upsertInvitation,
} from "@/lib/team-invitations";

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const guard = await requireTenantPermission(
    request,
    params.businessId,
    TENANT_PERMS.USERS_READ
  );
  if (isGuardError(guard)) return guard;

  const members = await prisma.businessUser.findMany({
    where: { businessId: params.businessId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true, // used by the business-admin Team tab avatars
          // platformRole intentionally excluded — server-only per rule #11
          isActive: true,
          twoFaEnabled: true,
          createdAt: true,
          sessions: {
            select: { lastSeenAt: true },
            orderBy: { lastSeenAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(100),
  role: z.enum(INVITE_ROLES).default("user"),
  // Legacy clients still send temporaryPassword — ignored (zod strips unknown keys).
});

export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const guard = await requireTenantPermission(
      request,
      params.businessId,
      TENANT_PERMS.USERS_WRITE
    );
    if (isGuardError(guard)) return guard;
    const { session, membership } = guard;

    // Enforce staff_management feature gate
    const business = await prisma.business.findUnique({
      where: { id: params.businessId },
      select: { tier: true, featureOverrides: true, name: true },
    });
    const overrides = (business?.featureOverrides as Record<string, boolean> | null) ?? null;
    if (!hasFeatureWithOverrides(business?.tier, "staff_management", overrides)) {
      return NextResponse.json(
        { error: "תוסף ניהול עובדים אינו זמין במסלול הנוכחי. שדרג למסלול Pro." },
        { status: 403 }
      );
    }

    const { ip, userAgent } = getRequestContext(request);

    let body: z.infer<typeof InviteSchema>;
    try {
      body = InviteSchema.parse(await request.json());
    } catch (_e: unknown) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Owner role can only be granted by current owner
    if (body.role === "owner" && membership.role !== "owner") {
      return NextResponse.json(
        { error: "רק בעל העסק יכול להוסיף בעלים נוסף." },
        { status: 403 }
      );
    }

    // Already an active member? Nothing to invite.
    const email = normalizeEmail(body.email);
    const existingUser = await prisma.platformUser.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUser) {
      const existing = await prisma.businessUser.findUnique({
        where: { businessId_userId: { businessId: params.businessId, userId: existingUser.id } },
        select: { isActive: true, role: true },
      });
      if (existing?.isActive) {
        return NextResponse.json({ error: "המשתמש עם אימייל זה כבר רשום כחבר צוות." }, { status: 409 });
      }
      // Re-inviting a deactivated member reactivates them on accept — same hierarchy
      // rule as PATCH: nobody brings back someone ranked above themselves.
      if (existing && !canModifyTenantRole(membership.role as TenantRole, existing.role as TenantRole)) {
        return NextResponse.json({ error: "אין לך הרשאה להחזיר חבר צוות בתפקיד גבוה משלך." }, { status: 403 });
      }
    }

    // Invitation emails go out from Petra's domain — cap them per business.
    const rl = await rateLimitAsync("team:invite", params.businessId, INVITE_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי הזמנות בזמן קצר. נסה/י שוב בעוד שעה." }, { status: 429 });
    }

    // The member joins only after confirming from the emailed link (or a link the
    // owner shares) and choosing their own password — no password is set here.
    const { invitation, rawToken } = await upsertInvitation({
      businessId: params.businessId,
      email,
      name: body.name,
      role: body.role,
      invitedById: session.user.id,
    });
    const { emailSent } = await deliverInvitation(invitation, rawToken, {
      businessName: business?.name || "העסק",
      inviterName: session.user.name || "מנהל העסק",
    });

    await logAudit({
      actorUserId: session.user.id,
      actorBusinessId: params.businessId,
      action: AUDIT_ACTIONS.TENANT_MEMBER_INVITED,
      targetType: "team_invitation",
      targetId: invitation.id,
      ip,
      userAgent,
      metadata: { role: body.role, emailSent },
    });
    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.INVITE_MEMBER, {
      businessId: membership.businessId,
      entityType: ENTITY_TYPES.MEMBER,
      entityId: invitation.id,
      entityLabel: invitation.name,
    });

    // inviteUrl goes back to the inviter so the link can be shared another way
    // (WhatsApp) when the email did not arrive. Only the hash is stored.
    return NextResponse.json(
      { invitation: serializeInvitation(invitation), emailSent, inviteUrl: inviteUrl(rawToken) },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/admin/[businessId]/members error:", error);
    return NextResponse.json({ error: "שגיאה בהוספת חבר צוות" }, { status: 500 });
  }
}
