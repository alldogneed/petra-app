export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets?search=&species=&q=
// Returns all pets for the business with customer info
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || searchParams.get("q") || "";
    const species = searchParams.get("species") || "";

    const where: Record<string, unknown> = {
      customer: { businessId: authResult.businessId },
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { breed: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
    }

    if (species) {
      where.species = species;
    }

    const pets = await prisma.pet.findMany({
      where,
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        gender: true,
        weight: true,
        birthDate: true,
        tags: true,
        createdAt: true,
        customer: {
          select: { id: true, name: true, phone: true },
        },
        health: {
          select: {
            neuteredSpayed: true,
            rabiesValidUntil: true,
            rabiesUnknown: true,
            allergies: true,
            medicalConditions: true,
          },
        },
        medications: {
          select: { id: true, medName: true, frequency: true, endDate: true },
          where: {
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
        },
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: { name: "asc" },
      take: 200,
    });

    const now = new Date();
    const enriched = pets.map((p) => {
      let vaccinationStatus: "ok" | "expiring" | "expired" | "unknown" = "unknown";
      if (p.health?.rabiesUnknown) {
        vaccinationStatus = "unknown";
      } else if (p.health?.rabiesValidUntil) {
        const daysUntil = Math.round(
          (new Date(p.health.rabiesValidUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntil < 0) vaccinationStatus = "expired";
        else if (daysUntil <= 30) vaccinationStatus = "expiring";
        else vaccinationStatus = "ok";
      }

      return {
        ...p,
        activeMedicationCount: p.medications.length,
        vaccinationStatus,
      };
    });

    return NextResponse.json({ pets: enriched, total: enriched.length });
  } catch (error) {
    console.error("GET /api/pets error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיות" }, { status: 500 });
  }
}
