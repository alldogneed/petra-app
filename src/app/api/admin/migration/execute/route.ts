export const dynamic = "force-dynamic";
/**
 * POST /api/admin/migration/execute
 * Admin-only: execute a validated import batch.
 * Body: { batchId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, RawCustomerRow, RawPetRow } from "@/lib/import-utils";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const guard = await requirePlatformPermission(req, PLATFORM_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;

  try {
    const { batchId } = await req.json();
    if (!batchId) return NextResponse.json({ error: "batchId נדרש" }, { status: 400 });

    const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) return NextResponse.json({ error: "מנה לא נמצאה" }, { status: 404 });
    if (batch.status === "imported") return NextResponse.json({ error: "מנה כבר יובאה" }, { status: 409 });
    if (batch.status === "rolled_back") return NextResponse.json({ error: "מנה בוטלה" }, { status: 409 });

    const businessId = batch.businessId;
    let stats: {
      customers: RawCustomerRow[];
      pets: RawPetRow[];
      totalCustomers: number;
      totalPets: number;
    };
    try {
      stats = JSON.parse(batch.statsJson);
    } catch {
      return NextResponse.json({ error: "נתוני המנה פגומים" }, { status: 400 });
    }

    const createdCustomerIds: string[] = [];
    const createdPetIds: string[] = [];
    const phoneNormToCustomerId = new Map<string, string>();

    const existingCustomers = await prisma.customer.findMany({
      where: { businessId },
      select: { id: true, phone: true, phoneNorm: true, notes: true },
    });
    for (const c of existingCustomers) {
      const norm = c.phoneNorm ?? normalizePhone(c.phone)?.phoneNorm ?? "";
      if (norm) phoneNormToCustomerId.set(norm, c.id);
    }

    for (const row of stats.customers) {
      const normResult = normalizePhone(row.phone!);
      if (!normResult) continue;
      const { phoneRaw, phoneNorm } = normResult;
      const existingId = phoneNormToCustomerId.get(phoneNorm);
      if (existingId) {
        const existing = existingCustomers.find((c) => c.id === existingId);
        await prisma.customer.update({
          where: { id: existingId },
          data: { phoneNorm, notes: existing?.notes ? `${existing.notes}\n[מוזג מיבוא מנהל]` : "[מוזג מיבוא מנהל]" },
        });
        phoneNormToCustomerId.set(phoneNorm, existingId);
      } else {
        const newCustomer = await prisma.customer.create({
          data: { businessId, name: row.full_name!, phone: phoneRaw, phoneNorm, email: row.email ?? null, address: row.city ?? null, notes: row.notes ?? null, source: "import" },
          select: { id: true },
        });
        createdCustomerIds.push(newCustomer.id);
        phoneNormToCustomerId.set(phoneNorm, newCustomer.id);
      }
    }

    for (const row of stats.pets) {
      const customerId = phoneNormToCustomerId.get(row.owner_phone ?? "");
      if (!customerId) continue;
      const newPet = await prisma.pet.create({
        data: { customerId, name: row.pet_name!, species: "dog", breed: row.breed ?? null, gender: row.sex ?? null, medicalNotes: row.notes ?? null },
        select: { id: true },
      });
      createdPetIds.push(newPet.id);
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "imported", statsJson: JSON.stringify({ ...stats, createdCustomerIds, createdPetIds, importedAt: new Date().toISOString() }) },
    });

    return NextResponse.json({
      success: true,
      batchId,
      createdCustomers: createdCustomerIds.length,
      mergedCustomers: stats.customers.length - createdCustomerIds.length,
      createdPets: createdPetIds.length,
    });
  } catch (error) {
    console.error("Admin migration execute error:", error);
    return NextResponse.json({ error: "שגיאה בייבוא" }, { status: 500 });
  }
}
