export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";
import { formatDate } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const stays = await prisma.boardingStay.findMany({
      where: {
        businessId: authResult.businessId,
        status: { in: ["reserved", "checked_in"] },
      },
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
            species: true,
            foodNotes: true,
            medicalNotes: true,
            medications: {
              select: { medName: true, dosage: true, frequency: true, times: true },
            },
            serviceDogProfile: { select: { id: true } },
          },
        },
        customer: { select: { name: true, phone: true } },
        room: { select: { name: true } },
      },
      orderBy: { checkIn: "asc" },
    });

    const rows = stays.map((s) => {
      const meds = s.pet.medications
        .map((m) => `${m.medName} ${m.dosage ?? ""} ${m.frequency ?? ""}`.trim())
        .join("; ");

      return {
        "חדר": s.room?.name ?? "",
        "שם הכלב": s.pet.name,
        "גזע": s.pet.breed ?? "",
        "בעלים": s.customer?.name ?? "כלב שירות",
        "טלפון": s.customer?.phone ?? "",
        "כניסה": formatDate(s.checkIn.toISOString()),
        "יציאה": s.checkOut ? formatDate(s.checkOut.toISOString()) : "",
        "סטטוס": s.status === "checked_in" ? "שוהה" : "הזמנה",
        "תרופות": meds || "אין",
        "הוראות האכלה": s.pet.foodNotes ?? "",
        "צרכים רפואיים": s.pet.medicalNotes ?? "",
        "דקות אימון יומי": s.dailyTrainingMinutes ?? "",
        "כלב שירות": s.pet.serviceDogProfile ? "כן" : "",
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 24 },
      { wch: 24 }, { wch: 16 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "שהיות פעילות");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="boarding-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET boarding/export error:", error);
    return NextResponse.json({ error: "שגיאה בייצוא" }, { status: 500 });
  }
}
