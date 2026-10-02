export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sessionHasTenantPermission, TENANT_PERMS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS, ENTITY_TYPES } from "@/lib/activity-actions";

/** Creating, editing and deleting templates needs the owner-grantable CONTRACTS_MANAGE. */
function contractsGuard(authResult: { session: Parameters<typeof sessionHasTenantPermission>[0]; businessId: string }) {
  if (!sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.CONTRACTS_MANAGE)) {
    return NextResponse.json({ error: "אין לך הרשאה לנהל תבניות חוזים" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const blocked = contractsGuard(authResult);
  if (blocked) return blocked;

  try {
    const body = await request.json();

    const template = await prisma.contractTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!template) return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });

    const updated = await prisma.contractTemplate.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.signaturePage !== undefined && { signaturePage: Math.max(1, Number(body.signaturePage)) }),
        ...(body.signatureX !== undefined && { signatureX: Math.max(0, Math.min(1, Number(body.signatureX))) }),
        ...(body.signatureY !== undefined && { signatureY: Math.max(0, Math.min(1, Number(body.signatureY))) }),
        ...(body.signatureWidth !== undefined && { signatureWidth: Math.max(0.01, Math.min(1, Number(body.signatureWidth))) }),
        ...(body.signatureHeight !== undefined && { signatureHeight: Math.max(0.01, Math.min(1, Number(body.signatureHeight))) }),
        ...(body.fields !== undefined && { fields: String(body.fields) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH contract template error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const blockedDel = contractsGuard(authResult);
  if (blockedDel) return blockedDel;

  try {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!template) return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });

    // Delete related contract requests first (FK constraint)
    const relatedRequests = await prisma.contractRequest.findMany({
      where: { templateId: params.id },
      select: { id: true, signedFileUrl: true, status: true },
    });

    // Deleting the template also deletes every request made from it — including
    // SIGNED contracts and their PDFs. That is a critical delete, not template upkeep.
    const signedCount = relatedRequests.filter((r) => r.status === "SIGNED" || !!r.signedFileUrl).length;
    if (signedCount > 0 && !sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.CRITICAL_DELETE)) {
      return NextResponse.json(
        { error: `לתבנית יש ${signedCount} חוזים חתומים — רק מי שמורשה למחוק לקוחות וכלבים יכול למחוק אותה`, code: "SIGNED_CONTRACTS" },
        { status: 403 }
      );
    }

    // Clean up signed PDF blobs
    for (const req of relatedRequests) {
      if (req.signedFileUrl && (req.signedFileUrl.includes("vercel-storage.com") || req.signedFileUrl.includes("blob.vercel"))) {
        try { await del(req.signedFileUrl); } catch { /* ignore */ }
      }
    }

    if (relatedRequests.length > 0) {
      // Without CRITICAL_DELETE never touch a signed row, even one signed after the
      // check above (race) — the template delete then fails on the FK instead.
      const canDeleteSigned = sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.CRITICAL_DELETE);
      await prisma.contractRequest.deleteMany({
        where: {
          templateId: params.id,
          businessId: authResult.businessId,
          ...(canDeleteSigned ? {} : { status: { not: "SIGNED" }, signedFileUrl: null }),
        },
      });
    }

    // Delete template blob
    try {
      if (template.fileUrl.includes("vercel-storage.com") || template.fileUrl.includes("blob.vercel")) {
        await del(template.fileUrl);
      }
    } catch {
      // Blob may not exist
    }

    await prisma.contractTemplate.delete({ where: { id: params.id, businessId: authResult.businessId } });

    await logActivity(authResult.session.user.id, authResult.session.user.name, ACTIVITY_ACTIONS.DELETE_CONTRACT_TEMPLATE, {
      businessId: authResult.businessId,
      entityType: ENTITY_TYPES.SETTINGS,
      entityId: template.id,
      entityLabel: signedCount > 0 ? `${template.name} (כולל ${signedCount} חוזים חתומים)` : template.name,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE contract template error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
