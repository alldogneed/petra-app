export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { computeMedicalComplianceStatus, computeADIProgress } from "@/lib/service-dog-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        pet: true,
        medicalProtocols: { orderBy: { createdAt: "asc" } },
        trainingLogs: { orderBy: { sessionDate: "desc" }, take: 20 },
        complianceEvents: { orderBy: { eventAt: "desc" }, take: 20 },
        placements: {
          include: { recipient: true },
          orderBy: { createdAt: "desc" },
        },
        idCards: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const medicalCompliance = computeMedicalComplianceStatus(dog.medicalProtocols, dog.phase);
    const trainingProgress = computeADIProgress(
      dog.trainingStartDate,
      dog.trainingTotalHours,
      dog.trainingTargetHours,
      dog.trainingTargetMonths
    );

    return NextResponse.json({
      ...dog,
      medicalCompliance,
      trainingProgress,
    });
  } catch (error) {
    console.error("GET /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת כלב שירות" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    const existing = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const updated = await prisma.serviceDogProfile.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.serviceType !== undefined && { serviceType: body.serviceType }),
        ...(body.registrationNumber !== undefined && { registrationNumber: body.registrationNumber }),
        ...(body.certifyingBody !== undefined && { certifyingBody: body.certifyingBody }),
        ...(body.certificationDate !== undefined && { certificationDate: body.certificationDate ? new Date(body.certificationDate) : null }),
        ...(body.certificationExpiry !== undefined && { certificationExpiry: body.certificationExpiry ? new Date(body.certificationExpiry) : null }),
        ...(body.trainingTargetHours !== undefined && { trainingTargetHours: body.trainingTargetHours }),
        ...(body.trainingTargetMonths !== undefined && { trainingTargetMonths: body.trainingTargetMonths }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: { pet: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון כלב שירות" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    await prisma.serviceDogProfile.delete({ where: { id: params.id, businessId: authResult.businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת כלב שירות" }, { status: 500 });
  }
}
