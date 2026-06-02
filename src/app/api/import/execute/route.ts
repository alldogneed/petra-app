export const dynamic = 'force-dynamic';
/**
 * POST /api/import/execute
 * Executes a validated import batch: creates customers+pets in DB.
 * Body: { batchId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, RawCustomerRow, RawPetRow } from "@/lib/import-utils";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeName } from "@/lib/validation";

/** Strip HTML tags and limit string length to prevent stored XSS and oversized values */
function sanitizeField(value: string | null | undefined, maxLen = 500): string | null {
  if (!value) return null;
  return value.replace(/<[^>]*>/g, "").replace(/[<>{}[\]]/g, "").trim().slice(0, maxLen) || null;
}

export async function POST(req: NextRequest) {
  const authResult = await requireBusinessAuth(req);
  if (isGuardError(authResult)) return authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("api:import:execute", ip, { max: 3, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

  try {
    const { batchId } = await req.json();
    if (!batchId) return NextResponse.json({ error: "batchId נדרש" }, { status: 400 });

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, businessId: authResult.businessId },
    });
    if (!batch) return NextResponse.json({ error: "מנה לא נמצאה" }, { status: 404 });
    if (batch.status === "imported") return NextResponse.json({ error: "מנה כבר יובאה" }, { status: 409 });
    if (batch.status === "rolled_back") return NextResponse.json({ error: "מנה בוטלה" }, { status: 409 });

    let stats: {
      customers: RawCustomerRow[];
      pets: RawPetRow[];
      totalCustomers: number;
      totalPets: number;
      skippedRows: number;
      inFileDuplicates: number;
      dbDuplicates: number;
    };
    try {
      stats = JSON.parse(batch.statsJson);
    } catch {
      return NextResponse.json({ error: "נתוני מנה פגומים" }, { status: 500 });
    }

    const createdCustomerIds: string[] = [];
    const createdPetIds: string[] = [];
    const phoneNormToCustomerId = new Map<string, string>();

    // Load existing customers for merge
    const existingCustomers = await prisma.customer.findMany({
      where: { businessId: authResult.businessId },
      select: { id: true, phone: true, phoneNorm: true, notes: true },
    });
    for (const c of existingCustomers) {
      const norm = c.phoneNorm ?? normalizePhone(c.phone)?.phoneNorm ?? "";
      if (norm) phoneNormToCustomerId.set(norm, c.id);
    }

    // Import customers
    for (const row of stats.customers) {
      const normResult = normalizePhone(row.phone!);
      if (!normResult) continue;
      const { phoneRaw, phoneNorm } = normResult;

      const existingId = phoneNormToCustomerId.get(phoneNorm);

      if (existingId) {
        // Merge: update empty fields only
        const existing = existingCustomers.find((c) => c.id === existingId);
        const mergeNote = `[מוזג מיבוא ${batch.id.slice(0, 8)}]`;
        await prisma.customer.update({
          where: { id: existingId },
          data: {
            phoneNorm,
            notes: existing?.notes
              ? `${existing.notes}\n${mergeNote}`
              : mergeNote,
          },
        });
        phoneNormToCustomerId.set(phoneNorm, existingId);
      } else {
        // Create new customer
        const newCustomer = await prisma.customer.create({
          data: {
            businessId: authResult.businessId,
            name: sanitizeName(row.full_name || ""),
            phone: phoneRaw,
            phoneNorm,
            email: sanitizeField(row.email, 254),
            address: sanitizeField(row.city, 200),
            notes: sanitizeField(row.notes, 2000),
            source: "import",
          },
          select: { id: true },
        });
        createdCustomerIds.push(newCustomer.id);
        phoneNormToCustomerId.set(phoneNorm, newCustomer.id);
      }
    }

    // Import pets
    for (const row of stats.pets) {
      const customerId = phoneNormToCustomerId.get(row.owner_phone ?? "");
      if (!customerId) continue;

      const newPet = await prisma.pet.create({
        data: {
          customerId,
          name: sanitizeName(row.pet_name || ""),
          species: "dog", // default; user can change later
          breed: sanitizeField(row.breed, 100),
          gender: sanitizeField(row.sex, 20),
          medicalNotes: sanitizeField(row.notes, 2000),
        },
        select: { id: true },
      });
      createdPetIds.push(newPet.id);
    }

    // Update batch status
    const finalStats = {
      ...stats,
      createdCustomerIds,
      createdPetIds,
      importedAt: new Date().toISOString(),
    };
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "imported",
        statsJson: JSON.stringify(finalStats),
      },
    });

    return NextResponse.json({
      success: true,
      batchId,
      createdCustomers: createdCustomerIds.length,
      mergedCustomers: stats.customers.length - createdCustomerIds.length,
      createdPets: createdPetIds.length,
    });
  } catch (error) {
    console.error("Import execute error:", error);
    return NextResponse.json({ error: "שגיאה בייבוא" }, { status: 500 });
  }
}
