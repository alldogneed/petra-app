export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import type { VaccinePlan } from "@/lib/vaccine-plan";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { vaccinePlan: true },
    });

    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });
    return NextResponse.json(dog.vaccinePlan || {});
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { vaccinePlan } = body as { vaccinePlan: VaccinePlan };

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const updated = await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: { vaccinePlan: vaccinePlan as object },
      select: { vaccinePlan: true },
    });

    return NextResponse.json(updated.vaccinePlan);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת תוכנית חיסונים" }, { status: 500 });
  }
}

// POST — mark a specific entry as done
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { planType, treatmentKey, index, doneDate } = body as {
      planType: "adults" | "puppies";
      treatmentKey: string;
      index: number;
      doneDate: string | null; // ISO date string or null to undo
    };

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { medicalProtocols: { where: { protocolKey: treatmentKey } } },
    });
    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const currentPlan = (dog.vaccinePlan as VaccinePlan) || {};
    const section = planType === "adults" ? currentPlan.adults : currentPlan.puppies;
    if (!section) return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 400 });

    const entries = (section as Record<string, Array<{ planned: string | null; done: string | null }>>)[treatmentKey];
    if (!entries || index >= entries.length) return NextResponse.json({ error: "ערך לא נמצא" }, { status: 400 });

    // Update the plan
    entries[index] = { ...entries[index], done: doneDate };
    (section as Record<string, unknown>)[treatmentKey] = entries;
    const newPlan: VaccinePlan = planType === "adults"
      ? { ...currentPlan, adults: section as VaccinePlan["adults"] }
      : { ...currentPlan, puppies: section as VaccinePlan["puppies"] };

    await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: { vaccinePlan: newPlan as object },
    });

    // Also update the matching ServiceDogMedicalProtocol if it exists
    if (doneDate && dog.medicalProtocols.length > 0) {
      const proto = dog.medicalProtocols[0];
      await prisma.serviceDogMedicalProtocol.update({
        where: { id: proto.id },
        data: { completedDate: new Date(doneDate), status: "COMPLETED" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע חיסון" }, { status: 500 });
  }
}
