export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { parseServiceDogFile } from "@/lib/import-utils";
import { seedMedicalProtocols } from "@/lib/service-dog-engine";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-dogs:import", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const dryRun = formData.get("dryRun") !== "false";

    if (!file) {
      return NextResponse.json({ error: "נדרש קובץ" }, { status: 400 });
    }

    const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_IMPORT_SIZE) {
      return NextResponse.json({ error: "קובץ גדול מדי – מקסימום 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { dogs, issues, confidence } = parseServiceDogFile(buffer, file.name);

    if (dryRun) {
      return NextResponse.json({
        total: dogs.length + issues.filter((i) => i.issueCode === "MISSING_NAME").length,
        valid: dogs.length,
        issues,
        confidence,
      });
    }

    // ── Execute import ──────────────────────────────────────────────
    const createdIds: string[] = [];
    const importErrors: typeof issues = [];

    for (const dog of dogs) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const pet = await tx.pet.create({
            data: {
              name: dog.name,
              species: "dog",
              breed: dog.breed || null,
              gender: dog.gender || null,
              birthDate: dog.birthDate ? new Date(dog.birthDate) : null,
              microchip: dog.microchip || null,
              businessId,
            },
          });

          const initialPhase = dog.phase || "SELECTION";

          const profile = await tx.serviceDogProfile.create({
            data: {
              petId: pet.id,
              businessId,
              phase: initialPhase,
              serviceType: dog.serviceType || null,
              currentLocation: dog.location || "TRAINER",
              notes: dog.notes || null,
            },
          });

          await tx.trainingProgram.create({
            data: {
              businessId,
              dogId: pet.id,
              customerId: null,
              name: `הכשרת כלב שירות — ${dog.name}`,
              programType: "SD_FOUNDATION",
              trainingType: "SERVICE_DOG",
              status: "ACTIVE",
              startDate: new Date(),
            },
          });

          return profile;
        });

        // Seed medical protocols outside transaction
        await seedMedicalProtocols(result.id, businessId, result.phase);
        createdIds.push(result.id);
      } catch (err) {
        console.error(`Import service dog row ${dog.rowNumber} error:`, err);
        importErrors.push({
          rowNumber: dog.rowNumber,
          entityType: "service_dog",
          issueCode: "CREATE_ERROR",
          message: "שגיאה פנימית בשמירת השורה",
          raw: dog.raw,
        });
      }
    }

    // Save ImportBatch
    const rollbackDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const allIssues = [...issues, ...importErrors];
    const statsJson = JSON.stringify({
      total: dogs.length,
      valid: dogs.length,
      created: createdIds.length,
      errors: allIssues.length,
      createdIds,
    });

    const batch = await prisma.importBatch.create({
      data: {
        businessId,
        sourceFilename: file.name,
        status: "imported",
        statsJson,
        rollbackDeadline,
      },
    });

    if (allIssues.length > 0) {
      await prisma.importRowIssue.createMany({
        data: allIssues.map((e) => ({
          batchId: batch.id,
          rowNumber: e.rowNumber,
          entityType: "service_dog",
          issueCode: e.issueCode,
          message: e.message,
          rawJson: JSON.stringify(e.raw),
        })),
      });
    }

    return NextResponse.json({
      total: dogs.length,
      valid: dogs.length,
      created: createdIds.length,
      issues: allIssues,
      batchId: batch.id,
    });
  } catch (error) {
    console.error("POST /api/service-dogs/import error:", error);
    return NextResponse.json({ error: "שגיאה פנימית בשרת" }, { status: 500 });
  }
}
