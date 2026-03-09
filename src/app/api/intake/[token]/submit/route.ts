export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const str255 = z.string().max(255).optional();
const str1000 = z.string().max(1000).optional();

const IntakeSubmitSchema = z.object({
  dog: z.object({
    customerName: z.string().min(1).max(100).optional(),
    customerPhone: z.string().max(20).optional(),
    name: z.string().min(1).max(100),
    breed: str255,
    gender: str255,
    weight: z.union([z.string().max(20), z.number()]).transform(v => String(v)).optional(),
    birthDate: z.string().max(30).optional(),
  }).optional(),
  health: z.object({
    allergies: str1000,
    medicalConditions: str1000,
    surgeriesHistory: str1000,
    activityLimitations: str1000,
    vetName: str255,
    vetPhone: z.string().max(20).optional(),
    neuteredSpayed: z.boolean().optional().nullable(),
    originInfo: str255,
    timeWithOwner: str255,
    foodNotes: str1000,
  }).optional(),
  behavior: z.object({
    dogAggression: z.boolean().optional(),
    humanAggression: z.boolean().optional(),
    leashReactivity: z.boolean().optional(),
    leashPulling: z.boolean().optional(),
    jumping: z.boolean().optional(),
    separationAnxiety: z.boolean().optional(),
    excessiveBarking: z.boolean().optional(),
    destruction: z.boolean().optional(),
    resourceGuarding: z.boolean().optional(),
    fears: z.boolean().optional(),
    badWithKids: z.boolean().optional(),
    houseSoiling: z.boolean().optional(),
    biteHistory: z.boolean().optional(),
    biteDetails: str1000,
    triggers: str1000,
    customIssues: str1000,
    priorTraining: z.boolean().optional(),
    priorTrainingDetails: str1000,
  }).optional(),
  medications: z.array(z.object({
    medName: z.string().min(1).max(200),
    dosage: str255,
    frequency: str255,
    instructions: str255,
  })).max(20).optional(),
});

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

    // Guard: reject oversized payloads before touching DB (100 KB limit)
    const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
    if (contentLength > 100_000) {
      return NextResponse.json({ error: "הטופס גדול מדי" }, { status: 413 });
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

    const rawBody = await request.json();
    const parsed = IntakeSubmitSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }
    const body = rawBody; // keep original for submissionJson
    const { dog, health, behavior, medications } = parsed.data;

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
          surgeriesHistory: health.surgeriesHistory || null,
          activityLimitations: health.activityLimitations || null,
          vetName: health.vetName || null,
          vetPhone: health.vetPhone || null,
          neuteredSpayed: health.neuteredSpayed ?? null,
          originInfo: health.originInfo || null,
          timeWithOwner: health.timeWithOwner || null,
        },
        update: {
          allergies: health.allergies || null,
          medicalConditions: health.medicalConditions || null,
          surgeriesHistory: health.surgeriesHistory || null,
          activityLimitations: health.activityLimitations || null,
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
          customIssues: behavior.customIssues ? JSON.stringify([behavior.customIssues]) : null,
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
          customIssues: behavior.customIssues ? JSON.stringify([behavior.customIssues]) : null,
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
        submissionJson: JSON.stringify(body).slice(0, 100_000), // hard cap 100 KB
        dogId: petId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST intake submit error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הטופס" }, { status: 500 });
  }
}
