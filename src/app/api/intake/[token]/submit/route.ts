export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:intake:submit", ip, RATE_LIMITS.STRICT_TOKEN);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const tokenHash = crypto.createHash("sha256").update(params.token).digest("hex");

    const form = await prisma.intakeForm.findUnique({
      where: { tokenHash },
    });

    if (!form) {
      return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    if (form.expiresAt < new Date()) {
      return NextResponse.json({ error: "הטופס פג תוקף" }, { status: 410 });
    }

    if (form.status === "SUBMITTED") {
      return NextResponse.json({ error: "הטופס כבר מולא" }, { status: 409 });
    }

    const body = await request.json();
    const { dog, health, behavior, medications } = body;

    // Create or update pet
    let petId = form.dogId;

    if (!petId && dog) {
      // Create customer if needed
      let customerId = form.customerId;
      if (!customerId && dog.customerName && dog.customerPhone) {
        let customer = await prisma.customer.findFirst({
          where: { businessId: form.businessId, phone: dog.customerPhone },
        });
        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              businessId: form.businessId,
              name: dog.customerName,
              phone: dog.customerPhone,
            },
          });
        }
        customerId = customer.id;
      }

      if (customerId) {
        const pet = await prisma.pet.create({
          data: {
            customerId,
            name: dog.name,
            species: "dog",
            breed: dog.breed || null,
            gender: dog.gender || null,
            weight: dog.weight ? parseFloat(dog.weight) : null,
            birthDate: dog.birthDate ? new Date(dog.birthDate) : null,
            foodNotes: health?.foodNotes || null,
          },
        });
        petId = pet.id;
      }
    }

    // Update food notes on existing pet
    if (petId && health?.foodNotes) {
      await prisma.pet.update({
        where: { id: petId },
        data: { foodNotes: health.foodNotes },
      });
    }

    // Save health data
    if (petId && health) {
      await prisma.dogHealth.upsert({
        where: { petId },
        create: {
          petId,
          allergies: health.allergies || null,
          medicalConditions: health.medicalConditions || null,
          vetName: health.vetName || null,
          vetPhone: health.vetPhone || null,
          neuteredSpayed: health.neuteredSpayed ?? null,
          originInfo: health.originInfo || null,
          timeWithOwner: health.timeWithOwner || null,
        },
        update: {
          allergies: health.allergies || null,
          medicalConditions: health.medicalConditions || null,
          vetName: health.vetName || null,
          vetPhone: health.vetPhone || null,
          neuteredSpayed: health.neuteredSpayed ?? null,
          originInfo: health.originInfo || null,
          timeWithOwner: health.timeWithOwner || null,
        },
      });
    }

    // Save behavior data
    if (petId && behavior) {
      await prisma.dogBehavior.upsert({
        where: { petId },
        create: {
          petId,
          dogAggression: behavior.dogAggression || false,
          humanAggression: behavior.humanAggression || false,
          leashReactivity: behavior.leashReactivity || false,
          leashPulling: behavior.leashPulling || false,
          jumping: behavior.jumping || false,
          separationAnxiety: behavior.separationAnxiety || false,
          excessiveBarking: behavior.excessiveBarking || false,
          destruction: behavior.destruction || false,
          resourceGuarding: behavior.resourceGuarding || false,
          fears: behavior.fears || false,
          badWithKids: behavior.badWithKids || false,
          houseSoiling: behavior.houseSoiling || false,
          biteHistory: behavior.biteHistory || false,
          biteDetails: behavior.biteDetails || null,
          triggers: behavior.triggers || null,
          priorTraining: behavior.priorTraining || false,
          priorTrainingDetails: behavior.priorTrainingDetails || null,
        },
        update: {
          dogAggression: behavior.dogAggression || false,
          humanAggression: behavior.humanAggression || false,
          leashReactivity: behavior.leashReactivity || false,
          leashPulling: behavior.leashPulling || false,
          jumping: behavior.jumping || false,
          separationAnxiety: behavior.separationAnxiety || false,
          excessiveBarking: behavior.excessiveBarking || false,
          destruction: behavior.destruction || false,
          resourceGuarding: behavior.resourceGuarding || false,
          fears: behavior.fears || false,
          badWithKids: behavior.badWithKids || false,
          houseSoiling: behavior.houseSoiling || false,
          biteHistory: behavior.biteHistory || false,
          biteDetails: behavior.biteDetails || null,
          triggers: behavior.triggers || null,
          priorTraining: behavior.priorTraining || false,
          priorTrainingDetails: behavior.priorTrainingDetails || null,
        },
      });
    }

    // Save medications
    if (petId && medications && medications.length > 0) {
      // Delete existing and replace
      await prisma.dogMedication.deleteMany({ where: { petId } });
      await prisma.dogMedication.createMany({
        data: medications.map((med: { medName: string; dosage?: string; frequency?: string; instructions?: string }) => ({
          petId: petId!,
          medName: med.medName,
          dosage: med.dosage || null,
          frequency: med.frequency || null,
          instructions: med.instructions || null,
        })),
      });
    }

    // Update form status
    await prisma.intakeForm.update({
      where: { id: form.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submissionJson: JSON.stringify(body),
        dogId: petId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST intake submit error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הטופס" }, { status: 500 });
  }
}
