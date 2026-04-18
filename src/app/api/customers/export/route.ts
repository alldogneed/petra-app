export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import * as XLSX from "xlsx";

// GET /api/customers/export
// Returns an XLSX workbook with all customers and their pets.
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const { session } = authResult;
  logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.EXPORT_CUSTOMERS);

  try {
    const customers = await prisma.customer.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { name: "asc" },
      take: 10000, // Safety limit to prevent memory exhaustion
      include: {
        pets: {
          select: {
            name: true,
            species: true,
            breed: true,
            gender: true,
            weight: true,
          },
        },
        _count: {
          select: { appointments: true },
        },
      },
    });

    const SOURCE_LABELS: Record<string, string> = {
      referral: "המלצה מלקוח", google: "גוגל", instagram: "אינסטגרם",
      facebook: "פייסבוק", tiktok: "טיקטוק", signage: "שלט / מעבר ברחוב", other: "אחר",
    };

    const headers = [
      "שם לקוח", "טלפון", "אימייל", "כתובת", "תגיות", "מקור הגעה",
      "הערות", "תורים", "תאריך הצטרפות",
      "שם חיית מחמד", "סוג", "גזע", "מין", "משקל (ק״ג)",
    ];

    const rows: (string | number)[][] = [headers];

    for (const c of customers) {
      let tags = "";
      try {
        const parsed = JSON.parse(c.tags || "[]");
        tags = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
      } catch {
        tags = "";
      }

      const joinedDate = new Date(c.createdAt).toLocaleDateString("he-IL", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });

      const customerBase: (string | number)[] = [
        c.name,
        c.phone,
        c.email ?? "",
        c.address ?? "",
        tags,
        c.source ? (SOURCE_LABELS[c.source] ?? c.source) : "",
        c.notes ?? "",
        c._count.appointments,
        joinedDate,
      ];

      if (c.pets.length === 0) {
        rows.push([...customerBase, "", "", "", "", ""]);
      } else {
        for (const pet of c.pets) {
          const speciesLabel = pet.species === "dog" ? "כלב" : pet.species === "cat" ? "חתול" : "אחר";
          rows.push([
            ...customerBase,
            pet.name,
            speciesLabel,
            pet.breed ?? "",
            pet.gender === "male" ? "זכר" : pet.gender === "female" ? "נקבה" : (pet.gender ?? ""),
            pet.weight != null ? pet.weight : "",
          ]);
        }
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 22 }, // שם לקוח
      { wch: 15 }, // טלפון
      { wch: 25 }, // אימייל
      { wch: 25 }, // כתובת
      { wch: 20 }, // תגיות
      { wch: 18 }, // מקור
      { wch: 30 }, // הערות
      { wch: 8  }, // תורים
      { wch: 14 }, // תאריך
      { wch: 16 }, // שם חיה
      { wch: 8  }, // סוג
      { wch: 14 }, // גזע
      { wch: 8  }, // מין
      { wch: 12 }, // משקל
    ];

    XLSX.utils.book_append_sheet(wb, ws, "לקוחות");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="customers_${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Customer export error:", error);
    return NextResponse.json({ error: "שגיאה בייצוא לקוחות" }, { status: 500 });
  }
}
