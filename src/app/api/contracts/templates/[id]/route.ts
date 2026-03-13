export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

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

  try {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!template) return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });

    // Delete blob
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
