export const dynamic = 'force-dynamic';
/**
 * POST   /api/admin/[businessId]/invitations/[invitationId] — resend: new link (the old one
 *        stops working) + email again. Returns the new link for sharing another way.
 * DELETE /api/admin/[businessId]/invitations/[invitationId] — cancel the invitation.
 * Requires: tenant.users.write. Invitations of another business are never found.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import {
  deliverInvitation, inviteUrl, refreshInvitationToken, serializeInvitation,
} from "@/lib/team-invitations";

type Params = { params: { businessId: string; invitationId: string } };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireTenantPermission(request, params.businessId, TENANT_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session, membership } = guard;

  const target = await prisma.teamInvitation.findFirst({
    where: { id: params.invitationId, businessId: params.businessId },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: "ההזמנה לא נמצאה" }, { status: 404 });
  // Same rule as inviting: only an owner hands out the owner role.
  if (target.role === "owner" && membership.role !== "owner") {
    return NextResponse.json({ error: "רק בעל העסק יכול לשלוח הזמנה לבעלים." }, { status: 403 });
  }

  const refreshed = await refreshInvitationToken(params.invitationId, params.businessId);
  if (!refreshed) {
    return NextResponse.json({ error: "ההזמנה כבר אושרה או בוטלה" }, { status: 409 });
  }

  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    select: { name: true },
  });
  const { emailSent } = await deliverInvitation(refreshed.invitation, refreshed.rawToken, {
    businessName: business?.name || "העסק",
    inviterName: session.user.name || "מנהל העסק",
  });

  const { ip, userAgent } = getRequestContext(request);
  await logAudit({
    actorUserId: session.user.id,
    actorBusinessId: params.businessId,
    action: AUDIT_ACTIONS.TENANT_MEMBER_INVITED,
    targetType: "team_invitation",
    targetId: params.invitationId,
    ip,
    userAgent,
    metadata: { resend: true, emailSent },
  });

  const invitation = await prisma.teamInvitation.findUniqueOrThrow({ where: { id: params.invitationId } });
  return NextResponse.json({
    invitation: serializeInvitation(invitation),
    emailSent,
    inviteUrl: inviteUrl(refreshed.rawToken),
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await requireTenantPermission(request, params.businessId, TENANT_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const res = await prisma.teamInvitation.updateMany({
    where: { id: params.invitationId, businessId: params.businessId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "ההזמנה לא נמצאה או כבר אושרה" }, { status: 404 });
  }

  const { ip, userAgent } = getRequestContext(request);
  await logAudit({
    actorUserId: session.user.id,
    actorBusinessId: params.businessId,
    action: AUDIT_ACTIONS.TENANT_INVITATION_REVOKED,
    targetType: "team_invitation",
    targetId: params.invitationId,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
