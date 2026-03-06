export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets/birthdays?days=14
// Returns pets whose birthday (month+day) falls within the next N days.
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "14", 10);

    const pets = await prisma.pet.findMany({
      where: {
        customer: { businessId: authResult.businessId },
        birthDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        birthDate: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    const now = new Date();
    const upcoming: Array<{
      petId: string;
      petName: string;
      species: string;
      breed: string | null;
      customerId: string;
      customerName: string;
      customerPhone: string;
      birthDate: string;
      nextBirthday: string;
      daysUntil: number;
      age: number;
    }> = [];

    for (const pet of pets) {
      if (!pet.birthDate) continue;

      const bd = new Date(pet.birthDate);
      // Next birthday this year
      const nextBd = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      if (nextBd < now) {
        nextBd.setFullYear(now.getFullYear() + 1);
      }
      const daysUntil = Math.round(
        (nextBd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil > days) continue;

      const age =
        nextBd.getFullYear() -
        bd.getFullYear() -
        (nextBd.getMonth() < bd.getMonth() ||
        (nextBd.getMonth() === bd.getMonth() && nextBd.getDate() < bd.getDate())
          ? 1
          : 0);

      upcoming.push({
        petId: pet.id,
        petName: pet.name,
        species: pet.species,
        breed: pet.breed,
        customerId: pet.customer?.id ?? "",
        customerName: pet.customer?.name ?? "",
        customerPhone: pet.customer?.phone ?? "",
        birthDate: pet.birthDate.toISOString(),
        nextBirthday: nextBd.toISOString(),
        daysUntil,
        age,
      });
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ birthdays: upcoming, total: upcoming.length });
  } catch (error) {
    console.error("GET pets/birthdays error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת ימי הולדת" }, { status: 500 });
  }
}
