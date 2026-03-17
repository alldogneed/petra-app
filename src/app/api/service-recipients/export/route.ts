export const dynamic = "force-dynamic";
/**
 * GET /api/service-recipients/export
 * Downloads an XLSX file with all service dog recipients and their key details.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import * as XLSX from "xlsx";

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

const FUNDING_LABELS: Record<string, string> = {
  MINISTRY_OF_DEFENSE: "משרד הביטחון",
  BITUACH_LEUMI: "ביטוח לאומי",
  PRIVATE: "פרטי",
  OTHER: "אחר",
};

const DISABILITY_LABELS: Record<string, string> = {
  PTSD: "PTSD",
  VISUAL: "לקות ראייה",
  HEARING: "לקות שמיעה",
  MOBILITY: "לקות תנועה",
  AUTISM: "אוטיזם",
  DIABETES: "סוכרת",
  EPILEPSY: "אפילפסיה",
  OTHER: "אחר",
};

const PLACEMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "ממתין",
  TRIAL: "תקופת ניסיון",
  ACTIVE: "פעיל",
  SUSPENDED: "מושהה",
  TERMINATED: "הסתיים",
  COMPLETED: "הושלם",
};

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("he-IL");
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Staff cannot export recipients
    const membership = authResult.session.memberships.find((m) => m.businessId === authResult.businessId && m.isActive);
    if (membership && !hasTenantPermission(membership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לייצא זכאים" }, { status: 403 });
    }

    const recipients = await prisma.serviceDogRecipient.findMany({
      where: { businessId: authResult.businessId },
      include: {
        customer: { select: { name: true, phone: true } },
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: {
            serviceDog: {
              include: {
                pet: { select: { name: true, breed: true } },
              },
            },
          },
          orderBy: { placementDate: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const headers = [
      "שם",
      "טלפון",
      "מייל",
      "ת.ז.",
      "כתובת",
      "שלב בפיפליין",
      "סוג מוגבלות",
      "הערות מוגבלות",
      "מקור מימון",
      "תאריך פנייה ראשונית",
      "תאריך קבלה",
      "תאריך אישור",
      "כלב משובץ",
      "גזע כלב",
      "סטטוס שיבוץ",
      "תאריך שיבוץ",
      "תאריך הסמכה",
      "לקוח מקושר",
      "טלפון לקוח",
      "הערות",
    ];

    const rows: (string | number)[][] = [headers];

    for (const r of recipients) {
      const placement = r.placements[0];
      rows.push([
        r.name,
        r.phone || "",
        r.email || "",
        r.idNumber || "",
        r.address || "",
        STATUS_LABELS[r.status] || r.status,
        DISABILITY_LABELS[r.disabilityType || ""] || r.disabilityType || "",
        r.disabilityNotes || "",
        FUNDING_LABELS[r.fundingSource || ""] || r.fundingSource || "",
        fmt(r.waitlistDate),
        fmt(r.intakeDate),
        fmt(r.approvedAt),
        placement ? placement.serviceDog.pet.name : "",
        placement ? placement.serviceDog.pet.breed || "" : "",
        placement ? PLACEMENT_STATUS_LABELS[placement.status] || placement.status : "",
        placement ? fmt(placement.placementDate) : "",
        fmt(r.handoverDate),
        r.customer?.name || "",
        r.customer?.phone || "",
        r.notes || "",
      ]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!cols"] = [
      { wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 25 },
      { wch: 16 }, { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "זכאים");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="service-recipients-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/service-recipients/export error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
