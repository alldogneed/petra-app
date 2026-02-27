export const dynamic = 'force-dynamic';
/**
 * POST /api/import/parse
 * Accepts a multipart file upload (customers CSV/XLSX + optional pets).
 * Parses, validates, stores draft ImportBatch+issues in DB, returns preview stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { parseImportFile, normalizePhone } from "@/lib/import-utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isGuardError(authResult)) return authResult;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const includePetsStr = formData.get("includePets") as string | null;
    const includePets = includePetsStr === "true";

    if (!file) {
      return NextResponse.json({ error: "קובץ לא סופק" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse the file
    const parseResult = parseImportFile(buffer, file.name, includePets);

    // Check for duplicates within file (by phoneNorm)
    const phoneNormMap = new Map<string, number>(); // phoneNorm -> first row
    let inFileDuplicates = 0;
    const dedupedCustomers = parseResult.customers.filter((c) => {
      const norm = normalizePhone(c.phone!)!;
      const key = `${DEMO_BUSINESS_ID}::${norm.phoneNorm}`;
      if (phoneNormMap.has(key)) {
        inFileDuplicates++;
        return false; // drop duplicate rows from file — will merge on execute
      }
      phoneNormMap.set(key, c.rowNumber);
      return true;
    });

    // Check against existing DB customers
    const existingPhones = await prisma.customer.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      select: { id: true, phoneNorm: true, phone: true },
    });
    const existingNorms = new Set(existingPhones.map((c) => c.phoneNorm ?? normalizePhone(c.phone)?.phoneNorm ?? ""));

    let dbDuplicates = 0;
    for (const c of dedupedCustomers) {
      const norm = normalizePhone(c.phone!)?.phoneNorm ?? "";
      if (existingNorms.has(norm)) dbDuplicates++;
    }

    // Validate pets have matching owner phones (in file or DB)
    const allPhoneNorms = new Set([
      ...dedupedCustomers.map((c) => normalizePhone(c.phone!)?.phoneNorm ?? ""),
      ...existingPhones.map((c) => c.phoneNorm ?? normalizePhone(c.phone)?.phoneNorm ?? ""),
    ]);

    const validPets = parseResult.pets.filter((p) => allPhoneNorms.has(p.owner_phone ?? ""));
    const orphanPetCount = parseResult.pets.length - validPets.length;
    const orphanIssues = parseResult.pets
      .filter((p) => !allPhoneNorms.has(p.owner_phone ?? ""))
      .map((p) => ({
        rowNumber: p.rowNumber,
        entityType: "pet" as const,
        issueCode: "OWNER_NOT_FOUND",
        message: `לא נמצא לקוח עם טלפון ${p.owner_phone}`,
        raw: p.raw,
      }));

    const allIssues = [...parseResult.issues, ...orphanIssues];

    // Create draft ImportBatch
    const rollbackDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const batch = await prisma.importBatch.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        sourceFilename: file.name,
        status: "validated",
        rollbackDeadline,
        statsJson: JSON.stringify({
          totalCustomers: dedupedCustomers.length,
          totalPets: validPets.length,
          skippedRows: parseResult.issues.length + inFileDuplicates,
          inFileDuplicates,
          dbDuplicates,
          orphanPets: orphanPetCount,
          // Store rows for execute step
          customers: dedupedCustomers,
          pets: validPets,
        }),
        issues: {
          create: allIssues.slice(0, 500).map((issue) => ({
            rowNumber: issue.rowNumber,
            entityType: issue.entityType,
            issueCode: issue.issueCode,
            message: issue.message,
            rawJson: JSON.stringify(issue.raw),
          })),
        },
      },
    });

    return NextResponse.json({
      batchId: batch.id,
      stats: {
        totalCustomers: dedupedCustomers.length,
        totalPets: validPets.length,
        skippedRows: parseResult.issues.length + inFileDuplicates,
        inFileDuplicates,
        dbDuplicates,
        orphanPets: orphanPetCount,
      },
      topIssues: allIssues.slice(0, 10).map((i) => ({
        row: i.rowNumber,
        type: i.entityType,
        code: i.issueCode,
        message: i.message,
      })),
      customerMappingConfidence: parseResult.customerMappingConfidence,
      petMappingConfidence: parseResult.petMappingConfidence,
    });
  } catch (error) {
    console.error("Import parse error:", error);
    return NextResponse.json({ error: "שגיאה בניתוח הקובץ" }, { status: 500 });
  }
}
