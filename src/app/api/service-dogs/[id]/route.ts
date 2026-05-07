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
        pet: {
          include: {
            health: true,
            behavior: true,
            medications: { orderBy: { createdAt: "desc" } },
          },
        },
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

    let parsedDocuments: unknown[] = [];
    try { parsedDocuments = JSON.parse((dog.documents as string) || "[]"); } catch { parsedDocuments = []; }

    return NextResponse.json({
      ...dog,
      documents: parsedDocuments,
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

    // Numeric range validation
    if (body.trainingTargetHours != null) {
      const v = Number(body.trainingTargetHours);
      if (!isFinite(v) || v < 1 || v > 10000) return NextResponse.json({ error: "שעות יעד לא חוקיות (1–10000)" }, { status: 400 });
    }
    if (body.trainingTotalHours != null) {
      const v = Number(body.trainingTotalHours);
      if (!isFinite(v) || v < 0 || v > 100000) return NextResponse.json({ error: "סה\"כ שעות לא חוקי (0–100000)" }, { status: 400 });
    }
    if (body.purchasePrice != null) {
      const v = parseFloat(body.purchasePrice);
      if (!isFinite(v) || v < 0 || v > 9999999) return NextResponse.json({ error: "מחיר לא חוקי" }, { status: 400 });
    }

    // JSON array size limits (max 100 items)
    if (body.documents !== undefined) {
      let docs: unknown;
      try { docs = typeof body.documents === "string" ? JSON.parse(body.documents) : body.documents; } catch { docs = []; }
      if (Array.isArray(docs) && docs.length > 100) return NextResponse.json({ error: "יותר מדי מסמכים (מקסימום 100)" }, { status: 400 });
    }
    if (body.trainingTests !== undefined) {
      let tests: unknown;
      try { tests = typeof body.trainingTests === "string" ? JSON.parse(body.trainingTests) : body.trainingTests; } catch { tests = []; }
      if (Array.isArray(tests) && tests.length > 100) return NextResponse.json({ error: "יותר מדי בחינות (מקסימום 100)" }, { status: 400 });
    }

    // URL validation for dogPhoto
    if (body.dogPhoto != null && body.dogPhoto !== "") {
      try { const u = new URL(body.dogPhoto); if (u.protocol !== "https:") throw new Error(); } catch {
        return NextResponse.json({ error: "כתובת תמונה לא חוקית" }, { status: 400 });
      }
    }

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
        ...(body.trainingTargetHours !== undefined && body.trainingTargetHours != null && { trainingTargetHours: Number(body.trainingTargetHours) }),
        ...(body.trainingTotalHours !== undefined && { trainingTotalHours: body.trainingTotalHours != null ? Number(body.trainingTotalHours) : 0 }),
        ...(body.trainingTargetMonths !== undefined && { trainingTargetMonths: body.trainingTargetMonths }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.documents !== undefined && { documents: typeof body.documents === "string" ? body.documents : JSON.stringify(body.documents) }),
        ...(body.trainingTests !== undefined && { trainingTests: body.trainingTests }),
        // New acquisition / license / logistics fields
        ...(body.pedigreeNumber !== undefined && { pedigreeNumber: body.pedigreeNumber }),
        ...(body.purchasePrice !== undefined && { purchasePrice: body.purchasePrice != null ? parseFloat(body.purchasePrice) : null }),
        ...(body.purchaseSource !== undefined && { purchaseSource: body.purchaseSource }),
        ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber }),
        ...(body.licenseExpiry !== undefined && { licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : null }),
        ...(body.maintenanceNotes !== undefined && { maintenanceNotes: body.maintenanceNotes }),
        ...(body.yardGroup !== undefined && { yardGroup: body.yardGroup }),
        ...(body.feedingInstructions !== undefined && { feedingInstructions: body.feedingInstructions }),
        ...(body.dogPhoto !== undefined && { dogPhoto: body.dogPhoto }),
        ...(body.currentLocation !== undefined && { currentLocation: body.currentLocation }),
        ...(body.intakeDate !== undefined && { intakeDate: body.intakeDate ? new Date(body.intakeDate) : null }),
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
