export const dynamic = "force-dynamic";
/**
 * PATCH /api/service-recipient-stages/[id] — rename / reorder stage
 * DELETE /api/service-recipient-stages/[id] — delete custom stage
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const stage = await prisma.serviceRecipientStage.findFirst({
      where: { id: params.id, businessId: auth.businessId },
    });
    if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    if (body.name !== undefined) {
      if (stage.isBuiltIn) return NextResponse.json({ error: "לא ניתן לשנות שם שלב מובנה" }, { status: 400 });
      if (typeof body.name !== "string" || body.name.trim().length === 0 || body.name.length > 50) {
        return NextResponse.json({ error: "שם שלב לא חוקי (1–50 תווים)" }, { status: 400 });
      }
    }

    const updated = await prisma.serviceRecipientStage.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH stage error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const stage = await prisma.serviceRecipientStage.findFirst({
      where: { id: params.id, businessId: auth.businessId },
    });
    if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (stage.isBuiltIn) return NextResponse.json({ error: "לא ניתן למחוק שלב מובנה" }, { status: 400 });

    await prisma.serviceRecipientStage.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE stage error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
