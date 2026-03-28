export const dynamic = "force-dynamic";
/**
 * GET /api/service-recipients/export/by-funding?source=BITUACH_LEUMI
 * GET /api/service-recipients/export/by-funding?source=MINISTRY_OF_DEFENSE
 *
 * Exports recipients filtered by funding source with columns:
 * שם, ת"ז, כתובת, תאריך פנייה ראשונית, שלב זכאי, הערות
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import * as XLSX from "xlsx";

const FUNDING_LABELS: Record<string, string> = {
  MINISTRY_OF_DEFENSE: "משרד הביטחון",
  BITUACH_LEUMI: "ביטוח לאומי",
  PRIVATE: "פרטי",
  OTHER: "אחר",
};

const STATUS_LABELS: Record<string, string> = {
  LEAD: "ליד",
  INTAKE: "קבלה",
  APPROVED: "מאושר",
  WAITLIST: "רשימת המתנה",
  MATCHED: "שובץ",
  JOINT_TRAINING: "אימון משותף",
  ACTIVE: "פעיל",
  CLOSED: "סגור",
};

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("he-IL");
}

const ALLOWED_SOURCES = ["BITUACH_LEUMI", "MINISTRY_OF_DEFENSE"];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const membership = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    if (membership && !hasTenantPermission(membership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לייצא זכאים" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") ?? "";
    if (!ALLOWED_SOURCES.includes(source)) {
      return NextResponse.json({ error: "מקור מימון לא חוקי" }, { status: 400 });
    }

    const recipients = await prisma.serviceDogRecipient.findMany({
      where: {
        businessId: authResult.businessId,
        fundingSource: source,
      },
      orderBy: { createdAt: "asc" },
    });

    const headers = ["שם", "ת\"ז", "כתובת", "תאריך פנייה ראשונית", "שלב זכאי", "הערות"];

    const rows: (string | number)[][] = [headers];
    for (const r of recipients) {
      rows.push([
        r.name,
        r.idNumber || "",
        r.address || "",
        fmt(r.waitlistDate),
        STATUS_LABELS[r.status] || r.status,
        r.notes || "",
      ]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // RTL sheet view
    if (!ws["!opts"]) ws["!opts"] = {};
    (ws as Record<string, unknown>)["!sheetView"] = [{ rightToLeft: true }];

    ws["!cols"] = [
      { wch: 22 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 35 },
    ];

    const sheetName = FUNDING_LABELS[source] ?? source;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);
    const fileLabel = source === "BITUACH_LEUMI" ? "bituach-leumi" : "defense";

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="recipients-${fileLabel}-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/service-recipients/export/by-funding error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
