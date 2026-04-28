export const dynamic = 'force-dynamic';
/**
 * GET /api/exports/download
 * Generates and returns a real XLSX or CSV file for download.
 * Query params: type (customers|pets|both), format (xlsx|csv), from, to
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";

// Map ExportJob.exportType → download "type" param
const EXPORT_TYPE_MAP: Record<string, string> = {
  customers: "customers",
  dogs: "pets",
  customers_dogs: "both",
  pets: "pets",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    let type = searchParams.get("type") || "customers"; // customers | pets | both
    let format = searchParams.get("format") || "xlsx"; // xlsx | csv
    let from = searchParams.get("from");
    let to = searchParams.get("to");

    // If jobId provided, look up the export job for its params
    if (jobId) {
      const job = await prisma.exportJob.findFirst({
        where: { id: jobId, businessId: authResult.businessId },
      });
      if (!job) {
        return new Response(JSON.stringify({ error: "ייצוא לא נמצא" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      type = EXPORT_TYPE_MAP[job.exportType] || "customers";
      format = job.format || "xlsx";
      from = job.filterFromDate ? job.filterFromDate.toISOString().slice(0, 10) : null;
      to = job.filterToDate ? job.filterToDate.toISOString().slice(0, 10) : null;

      // Mark job as downloaded
      await prisma.exportJob.update({
        where: { id: jobId },
        data: { status: "completed" },
      }).catch((err) => console.error("Failed to mark export job as completed:", err));
    }

    // Validate date params
    if (from && isNaN(new Date(from).getTime())) {
      return new Response(JSON.stringify({ error: "תאריך התחלה לא תקין" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (to && isNaN(new Date(to + "T23:59:59").getTime())) {
      return new Response(JSON.stringify({ error: "תאריך סיום לא תקין" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (from) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(from) };
    if (to) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(to + "T23:59:59") };

    const wb = XLSX.utils.book_new();

    // --- Customers sheet ---
    if (type === "customers" || type === "both") {
      const customers = await prisma.customer.findMany({
        where: { businessId: authResult.businessId, ...dateFilter },
        include: {
          pets: { select: { name: true, species: true, breed: true, gender: true, weight: true } },
          _count: { select: { appointments: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const customerRows: (string | number)[][] = [
        ["שם לקוח", "טלפון", "מייל", "כתובת", "תגיות", "תאריך הצטרפות", "תורים", "שם חיית מחמד", "סוג", "גזע", "מין", "משקל (ק״ג)"],
      ];

      for (const c of customers) {
        const base: (string | number)[] = [
          c.name,
          c.phone,
          c.email || "",
          c.address || "",
          c.tags || "",
          c.createdAt ? new Date(c.createdAt).toLocaleDateString("he-IL") : "",
          c._count.appointments,
        ];
        if (c.pets.length === 0) {
          customerRows.push([...base, "", "", "", "", ""]);
        } else {
          for (const pet of c.pets) {
            const speciesLabel = pet.species === "dog" ? "כלב" : pet.species === "cat" ? "חתול" : "אחר";
            customerRows.push([
              ...base,
              pet.name,
              speciesLabel,
              pet.breed || "",
              pet.gender || "",
              pet.weight != null ? pet.weight : "",
            ]);
          }
        }
      }

      const customerSheet = XLSX.utils.aoa_to_sheet(customerRows);
      customerSheet["!cols"] = [
        { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 8 },
        { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, customerSheet, "לקוחות");
    }

    // --- Pets sheet ---
    if (type === "pets" || type === "both") {
      const pets = await prisma.pet.findMany({
        where: {
          customer: { businessId: authResult.businessId },
          ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
        },
        include: { customer: { select: { name: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      });

      const petData = [
        ["שם", "סוג", "גזע", "מין", "משקל", "שם בעלים", "טלפון בעלים"],
        ...pets.map((p) => [
          p.name,
          p.species === "dog" ? "כלב" : p.species === "cat" ? "חתול" : "אחר",
          p.breed || "",
          p.gender || "",
          p.weight ? String(p.weight) : "",
          p.customer?.name ?? "",
          p.customer?.phone ?? "",
        ]),
      ];

      const petSheet = XLSX.utils.aoa_to_sheet(petData);
      petSheet["!cols"] = [
        { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, petSheet, "חיות מחמד");
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const typeLabel = type === "both" ? "all" : type;

    if (format === "csv") {
      // For CSV, export first sheet only
      const sheetName = wb.SheetNames[0];
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      const bom = "\uFEFF"; // UTF-8 BOM for Hebrew
      const csvBuffer = new TextEncoder().encode(bom + csv);

      return new Response(csvBuffer, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="petra_${typeLabel}_${dateStr}.csv"`,
        },
      });
    }

    // XLSX
    const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
    return new Response(new Uint8Array(xlsxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="petra_${typeLabel}_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export download error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בהורדת הייצוא" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
