export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isValidAutomationTrigger } from "@/lib/automation-triggers";

// PATCH /api/automations/[id] – update an automation rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.automationRule.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const body = await request.json();
    const { name, trigger, triggerOffset, templateId, isActive } = body;

    // ── Validate fields ──
    if (name !== undefined && (typeof name !== "string" || name.length === 0 || name.length > 200)) {
      return NextResponse.json({ error: "שם אוטומציה לא תקין (מקסימום 200 תווים)" }, { status: 400 });
    }
    if (trigger !== undefined && !isValidAutomationTrigger(trigger)) {
      return NextResponse.json({ error: "סוג טריגר לא חוקי" }, { status: 400 });
    }
    if (triggerOffset !== undefined && (typeof triggerOffset !== "number" || triggerOffset < 0 || triggerOffset > 8760)) {
      return NextResponse.json({ error: "ערך triggerOffset לא תקין" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "ערך isActive לא תקין" }, { status: 400 });
    }

    // Verify templateId belongs to this business (prevent IDOR)
    if (templateId !== undefined) {
      const template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, businessId: authResult.businessId },
      });
      if (!template) {
        return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });
      }
    }

    const updated = await prisma.automationRule.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(name !== undefined && { name }),
        ...(trigger !== undefined && { trigger }),
        ...(triggerOffset !== undefined && { triggerOffset }),
        ...(templateId !== undefined && { templateId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        template: { select: { id: true, name: true, channel: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH automation error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון אוטומציה" }, { status: 500 });
  }
}

// DELETE /api/automations/[id] – delete an automation rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.automationRule.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    await prisma.automationRule.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE automation error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת אוטומציה" }, { status: 500 });
  }
}
