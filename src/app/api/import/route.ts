export const dynamic = "force-dynamic";
/**
 * GET  /api/import  – רשימת 20 ה-ImportBatch האחרונים
 * POST /api/import  – dry-run validation או ייבוא אמיתי של לקוחות/חיות מחמד
 *   Body: { rows: Array<{name, phone, email?, petName?, petBreed?, petSpecies?}>, dryRun: boolean, sourceFilename?: string }
 *   Return: { total, valid, errors: [{row, field, message}], created? }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportRow {
  name?: string;
  phone?: string;
  email?: string;
  petName?: string;
  petBreed?: string;
  petSpecies?: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

// ── Validation helpers ────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function validateRow(row: ImportRow, index: number): RowError[] {
  const errs: RowError[] = [];
  const rowNum = index + 1;

  if (!row.name || row.name.trim().length < 2) {
    errs.push({ row: rowNum, field: "name", message: "שם חובה (לפחות 2 תווים)" });
  }

  if (!row.phone || row.phone.trim() === "") {
    errs.push({ row: rowNum, field: "phone", message: "טלפון חובה" });
  } else {
    const digits = normalizePhone(row.phone);
    if (digits.length < 9) {
      errs.push({ row: rowNum, field: "phone", message: "מספר טלפון לא תקין (לפחות 9 ספרות)" });
    }
  }

  if (row.email && row.email.trim() !== "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email.trim())) {
      errs.push({ row: rowNum, field: "email", message: "כתובת אימייל לא תקינה" });
    }
  }

  return errs;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isGuardError(authResult)) return authResult;

  try {
    const batches = await prisma.importBatch.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const now = new Date();
    return NextResponse.json(
      batches.map((b) => {
        let stats: Record<string, unknown> = {};
        try {
          stats = JSON.parse(b.statsJson);
        } catch {}
        return {
          id: b.id,
          sourceFilename: b.sourceFilename,
          status: b.status,
          createdAt: b.createdAt,
          rollbackDeadline: b.rollbackDeadline,
          canRollback:
            b.status === "imported" && now < new Date(b.rollbackDeadline),
          total: (stats.total as number) ?? 0,
          valid: (stats.valid as number) ?? 0,
          created: (stats.created as number) ?? null,
          issueCount: b._count.issues,
        };
      })
    );
  } catch (error) {
    console.error("Import GET error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת רשימת הייבואים" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await req.json();
    const rows: ImportRow[] = body.rows ?? [];
    const dryRun: boolean = body.dryRun !== false; // default true
    const sourceFilename: string = body.sourceFilename ?? "import.csv";

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "נדרש מערך rows שאינו ריק" }, { status: 400 });
    }

    // ── Validate all rows ────────────────────────────────────────────────────
    const allErrors: RowError[] = [];
    let validCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const errs = validateRow(rows[i], i);
      if (errs.length > 0) {
        allErrors.push(...errs);
      } else {
        validCount++;
      }
    }

    const total = rows.length;

    // ── Dry-run: return stats only ───────────────────────────────────────────
    if (dryRun) {
      return NextResponse.json({
        total,
        valid: validCount,
        errors: allErrors,
      });
    }

    // ── Real import ──────────────────────────────────────────────────────────
    const createdCustomerIds: string[] = [];
    const createdPetIds: string[] = [];
    const importErrors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errs = validateRow(row, i);
      if (errs.length > 0) {
        importErrors.push(...errs);
        continue;
      }

      try {
        // Create customer
        const customer = await prisma.customer.create({
          data: {
            businessId: DEMO_BUSINESS_ID,
            name: row.name!.trim(),
            phone: row.phone!.trim(),
            email: row.email?.trim() || null,
            source: "import",
          },
          select: { id: true },
        });
        createdCustomerIds.push(customer.id);

        // Create pet if petName provided
        if (row.petName && row.petName.trim() !== "") {
          const pet = await prisma.pet.create({
            data: {
              customerId: customer.id,
              name: row.petName.trim(),
              species: row.petSpecies?.trim() || "dog",
              breed: row.petBreed?.trim() || null,
            },
            select: { id: true },
          });
          createdPetIds.push(pet.id);
        }
      } catch (rowErr) {
        console.error(`Import row ${i + 1} error:`, rowErr);
        importErrors.push({
          row: i + 1,
          field: "general",
          message: "שגיאה פנימית בשמירת השורה",
        });
      }
    }

    // Save ImportBatch record
    const rollbackDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const statsJson = JSON.stringify({
      total,
      valid: validCount,
      created: createdCustomerIds.length,
      errors: importErrors.length,
      createdCustomerIds,
      createdPetIds,
    });

    const batch = await prisma.importBatch.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        sourceFilename,
        status: "imported",
        statsJson,
        rollbackDeadline,
      },
    });

    // Save ImportRowIssue records for each error
    if (importErrors.length > 0) {
      await prisma.importRowIssue.createMany({
        data: importErrors.map((e) => ({
          batchId: batch.id,
          rowNumber: e.row,
          entityType: "customer",
          issueCode: e.field,
          message: e.message,
          rawJson: JSON.stringify(rows[e.row - 1] ?? {}),
        })),
      });
    }

    return NextResponse.json({
      total,
      valid: validCount,
      errors: importErrors,
      created: createdCustomerIds.length,
      createdPets: createdPetIds.length,
      batchId: batch.id,
    });
  } catch (error) {
    console.error("Import POST error:", error);
    return NextResponse.json({ error: "שגיאה פנימית בשרת" }, { status: 500 });
  }
}
