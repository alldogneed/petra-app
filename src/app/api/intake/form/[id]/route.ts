export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// NOTE: this lives under /api/intake/form/[id] (not /api/intake/[id]) because
// Next.js does not allow two different dynamic slug names ([token] vs [id])
// at the same path level — /api/intake/[token] is the public token route.

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const form = await prisma.intakeForm.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: {
        id: true,
        status: true,
        phoneE164: true,
        submittedAt: true,
        submissionJson: true,
        createdAt: true,
        expiresAt: true,
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(form);
  } catch (error) {
    console.error("GET intake form error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הטופס" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const form = await prisma.intakeForm.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true },
    });

    if (!form) {
      return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    await prisma.intakeForm.delete({ where: { id: form.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE intake form error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת הטופס" }, { status: 500 });
  }
}
