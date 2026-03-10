import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
// @ts-ignore
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  const { businessId } = auth;

  const pets = await prisma.pet.findMany({
    where: {
      OR: [
        { customer: { businessId } },
        { businessId },
      ],
    },
    include: {
      customer: { select: { name: true, phone: true } },
      health: {
        select: {
          rabiesValidUntil: true,
          medicalConditions: true,
          allergies: true,
        },
      },
      medications: {
        where: {
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
        select: { medName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const now = new Date();

  const rows = pets.map((pet) => {
    let age = "";
    if (pet.birthDate) {
      const bd = new Date(pet.birthDate);
      const months =
        (now.getFullYear() - bd.getFullYear()) * 12 +
        (now.getMonth() - bd.getMonth());
      age = months < 24 ? `${months} חודשים` : `${Math.floor(months / 12)} שנים`;
    }

    const SPECIES_LABELS: Record<string, string> = {
      dog: "כלב",
      cat: "חתול",
      other: "אחר",
    };

    const GENDER_LABELS: Record<string, string> = {
      male: "זכר",
      female: "נקבה",
    };

    const rabies = pet.health?.rabiesValidUntil
      ? new Date(pet.health.rabiesValidUntil).toLocaleDateString("he-IL")
      : "";

    const activeMeds = pet.medications.map((m) => m.medName).join(", ");

    return {
      שם: pet.name,
      סוג: SPECIES_LABELS[pet.species] ?? pet.species,
      גזע: pet.breed ?? "",
      מין: GENDER_LABELS[pet.gender ?? ""] ?? "",
      גיל: age,
      "משקל (ק״ג)": pet.weight ?? "",
      לקוח: pet.customer?.name ?? "",
      טלפון: pet.customer?.phone ?? "",
      "כלבת – תוקף": rabies,
      "מצבים רפואיים": pet.health?.medicalConditions ?? "",
      אלרגיות: pet.health?.allergies ?? "",
      "תרופות פעילות": activeMeds,
      "הערות רפואיות": pet.medicalNotes ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "חיות מחמד");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pets-export.xlsx"`,
    },
  });
}
