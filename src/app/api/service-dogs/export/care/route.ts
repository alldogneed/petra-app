export const dynamic = "force-dynamic";
/**
 * GET /api/service-dogs/export/care
 * Exports two-sheet XLSX for service dogs:
 *   Sheet 1 — "האכלות"   : dogs that have feeding data entered
 *   Sheet 2 — "תרופות"   : dogs that have medications entered (one row per medication)
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL");
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dogs = await prisma.serviceDogProfile.findMany({
      where: { businessId: authResult.businessId },
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
            foodBrand: true,
            foodGramsPerDay: true,
            foodFrequency: true,
            foodNotes: true,
            medications: {
              orderBy: { createdAt: "asc" },
              select: {
                medName: true,
                dosage: true,
                frequency: true,
                times: true,
                instructions: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Sheet 1: האכלות ──────────────────────────────────────────────────────
    const feedingHeader = [
      "שם כלב", "גזע", "מותג מזון", "גרם ליום", "תדירות האכלה", "הערות האכלה",
    ];
    const feedingRows: (string | number)[][] = [feedingHeader];

    dogs
      .filter((d) =>
        d.pet.foodBrand || d.pet.foodGramsPerDay || d.pet.foodFrequency || d.pet.foodNotes
      )
      .forEach((d) => {
        feedingRows.push([
          d.pet.name,
          d.pet.breed ?? "",
          d.pet.foodBrand ?? "",
          d.pet.foodGramsPerDay ?? "",
          d.pet.foodFrequency ?? "",
          d.pet.foodNotes ?? "",
        ]);
      });

    // ── Sheet 2: תרופות ──────────────────────────────────────────────────────
    const medsHeader = [
      "שם כלב", "גזע", "שם תרופה", "מינון", "תדירות", "שעות מתן",
      "הוראות מיוחדות", "תאריך התחלה", "תאריך סיום",
    ];
    const medsRows: (string | number)[][] = [medsHeader];

    dogs
      .filter((d) => d.pet.medications.length > 0)
      .forEach((d) => {
        d.pet.medications.forEach((med) => {
          let timesStr = "";
          try {
            const parsed = JSON.parse(med.times ?? "[]");
            if (Array.isArray(parsed)) timesStr = parsed.join(", ");
          } catch {
            timesStr = med.times ?? "";
          }
          medsRows.push([
            d.pet.name,
            d.pet.breed ?? "",
            med.medName,
            med.dosage ?? "",
            med.frequency ?? "",
            timesStr,
            med.instructions ?? "",
            fmtDate(med.startDate),
            fmtDate(med.endDate),
          ]);
        });
      });

    // ── Build workbook ───────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const wsFeed = XLSX.utils.aoa_to_sheet(feedingRows);
    wsFeed["!cols"] = [
      { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsFeed, "האכלות");

    const wsMeds = XLSX.utils.aoa_to_sheet(medsRows);
    wsMeds["!cols"] = [
      { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 28 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMeds, "תרופות");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="service-dogs-care-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/service-dogs/export/care error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
