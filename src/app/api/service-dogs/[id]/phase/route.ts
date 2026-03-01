export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { SERVICE_DOG_PHASES } from "@/lib/service-dogs";
import {
  diffProtocolsForPhaseChange,
  createComplianceEvent,
} from "@/lib/service-dog-engine";

const VALID_PHASES = SERVICE_DOG_PHASES.map((p) => p.id);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { phase } = body;

    if (!phase || !VALID_PHASES.includes(phase)) {
      return NextResponse.json({ error: "שלב לא חוקי" }, { status: 400 });
    }

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        pet: true,
        medicalProtocols: {
          where: { status: { in: ["COMPLETED", "WAIVED"] } },
        },
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const oldPhase = dog.phase;
    if (oldPhase === phase) {
      return NextResponse.json({ error: "הכלב כבר בשלב זה" }, { status: 400 });
    }

    const completedKeys = dog.medicalProtocols.map((p) => p.protocolKey);
    const newProtocols = diffProtocolsForPhaseChange(phase, completedKeys);

    // Transaction: update phase + create new protocols + compliance event
    const [updated] = await prisma.$transaction([
      prisma.serviceDogProfile.update({
        where: { id: params.id },
        data: {
          phase,
          phaseChangedAt: new Date(),
          // Auto-update training status on certification/decertification
          ...(phase === "CERTIFIED" && { trainingStatus: "CERTIFIED" }),
          ...(phase === "DECERTIFIED" && { trainingStatus: "FAILED" }),
          ...(phase === "IN_TRAINING" && dog.trainingStatus === "NOT_STARTED"
            ? { trainingStatus: "IN_PROGRESS", trainingStartDate: new Date() }
            : {}),
        },
        include: { pet: true },
      }),
      // Create new medical protocols
      ...(newProtocols.length > 0
        ? [
            prisma.serviceDogMedicalProtocol.createMany({
              data: newProtocols.map((p) => ({
                serviceDogId: params.id,
                businessId: authResult.businessId,
                phase,
                protocolKey: p.key,
                protocolLabel: p.label,
                category: p.category,
                status: "PENDING",
              })),
            }),
          ]
        : []),
    ]);

    // Create compliance event (outside transaction for simplicity)
    const phaseLabel = SERVICE_DOG_PHASES.find((p) => p.id === phase)?.label || phase;
    const oldPhaseLabel = SERVICE_DOG_PHASES.find((p) => p.id === oldPhase)?.label || oldPhase;

    let eventType = "PHASE_CHANGED";
    if (phase === "CERTIFIED") eventType = "CERTIFIED";
    else if (phase === "DECERTIFIED") eventType = "DECERTIFIED";
    else if (phase === "RETIRED") eventType = "DOG_RETIRED";

    await createComplianceEvent(
      params.id,
      authResult.businessId,
      eventType,
      `${dog.pet.name}: שינוי שלב מ${oldPhaseLabel} ל${phaseLabel}`
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id]/phase error:", error);
    return NextResponse.json({ error: "שגיאה בשינוי שלב" }, { status: 500 });
  }
}
