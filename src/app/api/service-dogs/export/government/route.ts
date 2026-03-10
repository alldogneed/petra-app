export const dynamic = "force-dynamic";
/**
 * GET /api/service-dogs/export/government
 * Generates the Ministry of Agriculture service dog report XLSX
 * in the exact 34-column format required for official registration.
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Map system phases to ministry status values
const PHASE_TO_STATUS: Record<string, string> = {
  PUPPY: "פעיל",
  SELECTION: "פעיל",
  IN_TRAINING: "פעיל",
  ADVANCED_TRAINING: "פעיל",
  CERTIFIED: "פעיל",
  RETIRED: "מוות",
  DECERTIFIED: "אבד",
};

// Map gender to ministry values
const GENDER_MAP: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Load business info (used as owner for unplaced dogs)
    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { name: true, phone: true, email: true, address: true },
    });

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
            color: true,
            isNeutered: true,
          },
        },
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: {
            recipient: {
              select: {
                name: true,
                phone: true,
                email: true,
                address: true,
                idNumber: true,
                customer: {
                  select: {
                    name: true,
                    phone: true,
                    email: true,
                    address: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Header rows — row 1 (group labels spanning columns), row 2 (row number description), row 3 (field names)
    // We'll output two rows: group header row + field names row, then data rows
    const groupHeaderRow = [
      "נתוני קובץ", "", // A-B
      "נתוני כלב", "", "", "", "", "", "", "", "", "", "", "", "", "", // C-Q (15 cols)
      "נתוני בעלים", "", "", "", "", "", "", "", "", "", "", // R-AB (11 cols)
      "נתוני אירוע", "", "", "", "", "", // AC-AH (6 cols)
    ];

    const fieldNameRow = [
      "שם מרכז הכשרה",            // A
      "מספר תנועה",                // B
      "מספר שבב",                  // C
      "מספר רישיון כלב מהרשות",   // D
      "סוג בעל חיים",              // E
      "שם כלב",                    // F
      "מין",                       // G
      "גזע",                       // H
      "סטטוס",                     // I
      "תאריך סטטוס",               // J
      "נחייה",                     // K
      "מערכת ביטחון",              // L
      "צבע",                       // M
      "סומן בחול",                 // N
      "שנה לידה",                  // O
      "חודש לידה",                 // P
      "עיקור",                     // Q
      "זהות בעלים",                // R
      "שם בעלים",                  // S
      "כתובת",                     // T
      "סמל ישוב",                  // U
      "כתובת לדואר",               // V
      "מיקוד",                     // W
      "טלפון בעלים",               // X
      "הסתר טלפון",                // Y
      "פקס",                       // Z
      "נייד",                      // AA
      "אימייל",                    // AB
      "אירוע",                     // AC
      "תאריך מסירה, חידוש או ביטול", // AD
      "בביטול סיבת ביטול",         // AE
      "בביטול - פרטים נוספים",     // AF
      "מסירה חדשה / חידוש תוקף / שלילה", // AG
      "תאריך סיום תוקף תעודת כלב סיוע",  // AH
    ];

    const dataRows: (string | number)[][] = [];

    dogs.forEach((dog, idx) => {
      const movementNumber = idx + 1;
      const placement = dog.placements[0];

      // Owner data — use customer if placed, otherwise use business
      let ownerName = "";
      let ownerPhone = "";
      let ownerMobile = "";
      let ownerEmail = "";
      let ownerAddress = "";

      let ownerIdNumber = "";
      if (placement?.recipient) {
        const r = placement.recipient;
        // Use recipient fields directly; fall back to linked customer if empty
        ownerName = r.name || r.customer?.name || "";
        ownerPhone = r.phone || r.customer?.phone || "";
        ownerEmail = r.email || r.customer?.email || "";
        ownerAddress = r.address || r.customer?.address || "";
        ownerIdNumber = r.idNumber || "";
      } else {
        ownerName = business?.name ?? "";
        ownerPhone = business?.phone ?? "";
        ownerEmail = business?.email ?? "";
        ownerAddress = business?.address ?? "";
      }

      const birthDate = dog.pet.birthDate;
      const birthYear = birthDate ? new Date(birthDate).getFullYear() : "";
      const birthMonth = birthDate
        ? String(new Date(birthDate).getMonth() + 1).padStart(2, "0")
        : "";

      const status = PHASE_TO_STATUS[dog.phase] ?? "פעיל";
      const statusDate = fmtDate(dog.phaseChangedAt);
      const eventType = "כלב סיוע";
      const deliveryType = dog.certificationDate ? "חידוש תוקף" : "מסירה";
      const certExpiry = fmtDate(dog.certificationExpiry);
      const certDate = fmtDate(dog.certificationDate);

      dataRows.push([
        business?.name ?? "",     // A — Training center name (from business settings)
        movementNumber,           // B — Movement number
        dog.pet.microchip ?? "",  // C — Microchip
        dog.licenseNumber ?? "",  // D — License number
        "כלב",                    // E — Animal type
        dog.pet.name,             // F — Dog name
        GENDER_MAP[dog.pet.gender ?? ""] ?? (dog.pet.gender ?? ""), // G — Sex
        dog.pet.breed ?? "",      // H — Breed
        status,                   // I — Status
        statusDate,               // J — Status date
        "לא",                    // K — Guide dog (נחייה)
        "לא",                    // L — Security dog
        dog.pet.color ?? "",      // M — Color
        "לא",                    // N — Marked in sand
        birthYear,                // O — Birth year
        birthMonth,               // P — Birth month
        dog.pet.isNeutered === true ? "כן" : dog.pet.isNeutered === false ? "לא" : "", // Q — Neutered
        ownerIdNumber,            // R — Owner national ID
        ownerName,                // S — Owner name
        ownerAddress,             // T — Address
        "",                       // U — Locality code (not stored)
        "",                       // V — Postal address
        "",                       // W — Zip
        ownerPhone,               // X — Owner phone
        "לא",                    // Y — Hide phone
        "",                       // Z — Fax
        ownerMobile,              // AA — Mobile
        ownerEmail,               // AB — Email
        eventType,                // AC — Event type
        certDate || statusDate,   // AD — Delivery/renewal date
        "",                       // AE — Cancellation reason / minor name
        "",                       // AF — Minor ID
        deliveryType,             // AG — New delivery / renewal / revocation
        certExpiry,               // AH — Certificate expiry
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([groupHeaderRow, fieldNameRow, ...dataRows]);

    // Style group header row — merge cells manually isn't supported in xlsx simply, but column widths help
    ws["!cols"] = [
      { wch: 22 }, { wch: 10 },  // A-B
      { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, // C-Q
      { wch: 14 }, { wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 24 }, // R-AB
      { wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 24 }, // AC-AH
    ];

    XLSX.utils.book_append_sheet(wb, ws, "נתונים");

    // Add reference/lookup sheet (תשתית)
    const infraRows = [
      ["סטטוס כלב", "זויג", "סוג בעל חיים", "כן לא", "אירועים", "כלב סיוע", "מסירה חידוש"],
      ["פעיל", "זכר", "כלב", "כן", "כלב סיוע", "כן", "מסירה"],
      ["מוות", "נקבה", "", "לא", "", "לא", "חידוש תוקף"],
      ["אבד", "", "", "", "", "", "שלילה"],
      ["יציאה לחו\"ל"],
      ["בהסגר"],
      ["נמצא"],
      ["נעלם"],
      ["עבר דירה"],
      ["עבר בעלות"],
    ];
    const wsInfra = XLSX.utils.aoa_to_sheet(infraRows);
    XLSX.utils.book_append_sheet(wb, wsInfra, "תשתית");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="service-dogs-gov-report-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/service-dogs/export/government error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
