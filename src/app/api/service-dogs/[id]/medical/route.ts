import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const protocols = await prisma.serviceDogMedicalProtocol.findMany({
      where: { serviceDogId: params.id },
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(protocols);
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/medical error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת פרוטוקולים רפואיים" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { protocolKey, protocolLabel, category, phase, dueDate, notes } = body;

    if (!protocolKey || !protocolLabel || !category) {
      return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
    }

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const protocol = await prisma.serviceDogMedicalProtocol.create({
      data: {
        serviceDogId: params.id,
        businessId: DEMO_BUSINESS_ID,
        phase: phase || dog.phase,
        protocolKey,
        protocolLabel,
        category,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        status: "PENDING",
      },
    });

    return NextResponse.json(protocol, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs/[id]/medical error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת פרוטוקול רפואי" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { protocolId, status, completedDate, expiryDate, notes } = body;

    if (!protocolId) {
      return NextResponse.json({ error: "נדרש מזהה פרוטוקול" }, { status: 400 });
    }

    const protocol = await prisma.serviceDogMedicalProtocol.findFirst({
      where: { id: protocolId, serviceDogId: params.id, businessId: DEMO_BUSINESS_ID },
    });

    if (!protocol) {
      return NextResponse.json({ error: "פרוטוקול לא נמצא" }, { status: 404 });
    }

    const updated = await prisma.serviceDogMedicalProtocol.update({
      where: { id: protocolId },
      data: {
        ...(status !== undefined && { status }),
        ...(completedDate !== undefined && { completedDate: completedDate ? new Date(completedDate) : null }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id]/medical error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון פרוטוקול רפואי" }, { status: 500 });
  }
}
