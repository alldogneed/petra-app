import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/health-alerts
// Returns pets with expired or expiring vaccinations within the next 30 days.
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Pets that have a rabies validity date set and it's expiring soon / expired
    const healthRecords = await prisma.dogHealth.findMany({
      where: {
        pet: { customer: { businessId: DEMO_BUSINESS_ID } },
        rabiesValidUntil: { lte: cutoff },
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { rabiesValidUntil: "asc" },
    });

    // Pets with NO health record at all (unknown vaccination status)
    const allPets = await prisma.pet.findMany({
      where: {
        customer: { businessId: DEMO_BUSINESS_ID },
        health: null,
        species: "dog",
      },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      take: 20,
    });

    const alerts = healthRecords.map((h) => ({
      petId: h.pet.id,
      petName: h.pet.name,
      species: h.pet.species,
      breed: h.pet.breed,
      customerId: h.pet.customer.id,
      customerName: h.pet.customer.name,
      customerPhone: h.pet.customer.phone,
      rabiesLastDate: h.rabiesLastDate,
      rabiesValidUntil: h.rabiesValidUntil,
      rabiesUnknown: h.rabiesUnknown,
      status: getVaccinationStatus(h.rabiesValidUntil, now),
    }));

    return NextResponse.json({
      alerts,
      noRecord: allPets.map((p) => ({
        petId: p.id,
        petName: p.name,
        species: p.species,
        breed: p.breed,
        customerId: p.customer.id,
        customerName: p.customer.name,
        customerPhone: p.customer.phone,
        status: "unknown" as const,
      })),
      totalAlerts: alerts.length,
      expired: alerts.filter((a) => a.status === "expired").length,
      expiringSoon: alerts.filter((a) => a.status === "expiring_soon").length,
    });
  } catch (error) {
    console.error("GET health-alerts error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התראות בריאות" }, { status: 500 });
  }
}

function getVaccinationStatus(
  validUntil: Date | null,
  now: Date
): "expired" | "expiring_soon" | "valid" {
  if (!validUntil) return "expired";
  const diff = validUntil.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_soon";
  return "valid";
}
