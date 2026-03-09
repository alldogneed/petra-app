export const dynamic = "force-dynamic";
/**
 * POST /api/admin/migration/parse
 * Admin-only: parse a CSV/XLSX file for a target business and return preview stats.
 * Form fields: targetBusinessId (string), file (File)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseImportFile, normalizePhone } from "@/lib/import-utils";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const guard = await requirePlatformPermission(req, PLATFORM_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;

  try {
    const formData = await req.formData();
    const targetBusinessId = formData.get("targetBusinessId") as string | null;
    const file = formData.get("file") as File | null;

    if (!targetBusinessId) return NextResponse.json({ error: "targetBusinessId נדרש" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "קובץ לא סופק" }, { status: 400 });

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: targetBusinessId },
      select: { id: true, name: true },
    });
    if (!business) return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const parseResult = parseImportFile(buffer, file.name, true);

    // Dedup within file
    const phoneNormMap = new Map<string, number>();
    let inFileDuplicates = 0;
    const dedupedCustomers = parseResult.customers.filter((c) => {
      const norm = normalizePhone(c.phone!)?.phoneNorm;
      if (!norm) return true;
      const key = `${targetBusinessId}::${norm}`;
      if (phoneNormMap.has(key)) { inFileDuplicates++; return false; }
      phoneNormMap.set(key, c.rowNumber);
      return true;
    });

    // Check against existing DB customers
    const existingPhones = await prisma.customer.findMany({
      where: { businessId: targetBusinessId },
      select: { id: true, phoneNorm: true, phone: true },
    });
    const existingNorms = new Set(existingPhones.map((c) => c.phoneNorm ?? normalizePhone(c.phone)?.phoneNorm ?? ""));
    let dbDuplicates = 0;
    for (const c of dedupedCustomers) {
      if (existingNorms.has(normalizePhone(c.phone!)?.phoneNorm ?? "")) dbDuplicates++;
    }

    const allPhoneNorms = new Set([
      ...dedupedCustomers.map((c) => normalizePhone(c.phone!)?.phoneNorm ?? ""),
      ...existingPhones.map((c) => c.phoneNorm ?? normalizePhone(c.phone)?.phoneNorm ?? ""),
    ]);
    const validPets = parseResult.pets.filter((p) => allPhoneNorms.has(p.owner_phone ?? ""));
    const orphanPetCount = parseResult.pets.length - validPets.length;
    const orphanIssues = parseResult.pets
      .filter((p) => !allPhoneNorms.has(p.owner_phone ?? ""))
      .map((p) => ({ rowNumber: p.rowNumber, entityType: "pet" as const, issueCode: "OWNER_NOT_FOUND", message: `לא נמצא לקוח עם טלפון ${p.owner_phone}`, raw: p.raw }));

    const allIssues = [...parseResult.issues, ...orphanIssues];

    const rollbackDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const batch = await prisma.importBatch.create({
      data: {
        businessId: targetBusinessId,
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
      businessName: business.name,
      stats: {
        totalCustomers: dedupedCustomers.length,
        totalPets: validPets.length,
        skippedRows: parseResult.issues.length + inFileDuplicates,
        inFileDuplicates,
        dbDuplicates,
        orphanPets: orphanPetCount,
      },
      topIssues: allIssues.slice(0, 10).map((i) => ({ row: i.rowNumber, type: i.entityType, code: i.issueCode, message: i.message })),
    });
  } catch (error) {
    console.error("Admin migration parse error:", error);
    return NextResponse.json({ error: "שגיאה בניתוח הקובץ" }, { status: 500 });
  }
}
