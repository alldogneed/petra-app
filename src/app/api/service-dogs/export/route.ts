export const dynamic = "force-dynamic";
/**
 * GET /api/service-dogs/export
 * Downloads an XLSX file with all service dogs and their key details.
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";
import { computeMedicalComplianceStatus } from "@/lib/service-dog-engine";

const PHASE_LABELS: Record<string, string> = {
  PUPPY: "גור",
  SELECTION: "בחירה",
  IN_TRAINING: "באימון",
  ADVANCED_TRAINING: "אימון מתקדם",
  CERTIFIED: "מוסמך",
  RETIRED: "בדימוס",
  DECERTIFIED: "שלילת הסמכה",
};

const TRAINING_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "טרם החל",
  IN_PROGRESS: "בתהליך",
  PENDING_CERT: "ממתין להסמכה",
  CERTIFIED: "הוסמך",
  FAILED: "לא עבר",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  MOBILITY: "ניידות",
  PSYCHIATRIC: "פסיכיאטרי",
  GUIDE: "נחייה",
  AUTISM: "אוטיזם",
  ALERT: "התרעה",
  OTHER: "אחר",
};

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  green: "תקין",
  amber: "ממתין",
  red: "באיחור",
};

const GENDER_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
};

const MILESTONE_KEY_LABELS: Record<string, string> = {
  PUPPY_FOUNDATION: "יסודות גור",
  PUBLIC_ACCESS_READY: "מוכן לגישה ציבורית",
  TASK_CERTIFIED: "מוסמך משימות",
  JOINT_TRAINING_COMPLETE: "אימון משותף הושלם",
};

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("he-IL");
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
            gender: true,
            birthDate: true,
            microchip: true,
          },
        },
        medicalProtocols: true,
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { recipient: { select: { name: true } } },
          take: 1,
        },
        insurances: {
          where: { isActive: true },
          select: { provider: true, policyNumber: true, renewalDate: true },
          take: 1,
        },
        milestones: {
          select: { milestoneKey: true, achievedAt: true },
          orderBy: { achievedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const headers = [
      "שם כלב",
      "גזע",
      "מין",
      "תאריך לידה",
      "מיקרוצ'יפ",
      "שלב",
      "סוג שירות",
      "סטטוס אימון",
      "שעות אימון",
      "מספר הסמכה",
      "גוף מסמיך",
      "תאריך הסמכה",
      "תפוגת הסמכה",
      "מספר רישיון עירוני",
      "תפוגת רישיון עירוני",
      "מספר יוחסין",
      "מחיר קנייה",
      "מקור קנייה",
      "ציות רפואי %",
      "סטטוס ציות רפואי",
      "פרוטוקולים שהושלמו",
      "פרוטוקולים סה״כ",
      "פרוטוקולים באיחור",
      "זכאי משובץ",
      "מבטחת",
      "מספר פוליסה",
      "תחידוש ביטוח",
      "אבן דרך אחרונה",
      "הערות",
    ];

    const rows: (string | number)[][] = [headers];

    for (const dog of dogs) {
      const compliance = computeMedicalComplianceStatus(dog.medicalProtocols, dog.phase);
      const placement = dog.placements[0];
      const insurance = dog.insurances[0];
      const milestone = dog.milestones[0];

      rows.push([
        dog.pet.name,
        dog.pet.breed || "",
        GENDER_LABELS[dog.pet.gender || ""] || dog.pet.gender || "",
        fmt(dog.pet.birthDate),
        dog.pet.microchip || "",
        PHASE_LABELS[dog.phase] || dog.phase,
        SERVICE_TYPE_LABELS[dog.serviceType || ""] || dog.serviceType || "",
        TRAINING_STATUS_LABELS[dog.trainingStatus] || dog.trainingStatus,
        dog.trainingTotalHours,
        dog.registrationNumber || "",
        dog.certifyingBody || "",
        fmt(dog.certificationDate),
        fmt(dog.certificationExpiry),
        dog.licenseNumber || "",
        fmt(dog.licenseExpiry),
        dog.pedigreeNumber || "",
        dog.purchasePrice ?? "",
        dog.purchaseSource || "",
        compliance.compliancePercent,
        COMPLIANCE_STATUS_LABELS[compliance.status] || compliance.status,
        compliance.completedCount,
        compliance.totalProtocols,
        compliance.overdueCount,
        placement ? placement.recipient.name : "",
        insurance?.provider || "",
        insurance?.policyNumber || "",
        fmt(insurance?.renewalDate),
        milestone ? (MILESTONE_KEY_LABELS[milestone.milestoneKey] || milestone.milestoneKey) : "",
        dog.notes || "",
      ]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!cols"] = [
      { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 18 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "כלבי שירות");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="service-dogs-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/service-dogs/export error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
