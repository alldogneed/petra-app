export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

function staffGuard(authResult: { session: { memberships: Array<{ businessId: string; role: string; isActive: boolean }> }; businessId: string }) {
  const m = authResult.session.memberships.find((mb) => mb.businessId === authResult.businessId && mb.isActive);
  if (m && !hasTenantPermission(m.role as TenantRole, TENANT_PERMS.SETTINGS_WRITE)) {
    return NextResponse.json({ error: "אין הרשאה לנהל חוזים" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const blocked = staffGuard(authResult);
  if (blocked) return blocked;

  try {
    const body = await request.json();

    const template = await prisma.contractTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!template) return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });

    const updated = await prisma.contractTemplate.update({
      where: { id: params.id },
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
  const blockedDel = staffGuard(authResult);
  if (blockedDel) return blockedDel;

  try {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!template) return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });

    // Delete related contract requests first (FK constraint)
    const relatedRequests = await prisma.contractRequest.findMany({
      where: { templateId: params.id },
      select: { id: true, signedFileUrl: true },
    });

    // Clean up signed PDF blobs
    for (const req of relatedRequests) {
      if (req.signedFileUrl && (req.signedFileUrl.includes("vercel-storage.com") || req.signedFileUrl.includes("blob.vercel"))) {
        try { await del(req.signedFileUrl); } catch { /* ignore */ }
      }
    }

    if (relatedRequests.length > 0) {
      await prisma.contractRequest.deleteMany({ where: { templateId: params.id } });
    }

    // Delete template blob
    try {
      if (template.fileUrl.includes("vercel-storage.com") || template.fileUrl.includes("blob.vercel")) {
        await del(template.fileUrl);
      }
    } catch {
      // Blob may not exist
    }

    await prisma.contractTemplate.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE contract template error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
