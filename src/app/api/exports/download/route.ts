/**
 * GET /api/exports/download
 * Generates and returns a real XLSX or CSV file for download.
 * Query params: type (customers|pets|both), format (xlsx|csv), from, to
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "customers"; // customers | pets | both
    const format = searchParams.get("format") || "xlsx"; // xlsx | csv
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (from) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(from) };
    if (to) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(to + "T23:59:59") };

    const wb = XLSX.utils.book_new();

    // --- Customers sheet ---
    if (type === "customers" || type === "both") {
      const customers = await prisma.customer.findMany({
        where: { businessId: DEMO_BUSINESS_ID, ...dateFilter },
        include: { _count: { select: { pets: true } } },
        orderBy: { createdAt: "desc" },
      });

      const customerData = [
        ["שם", "טלפון", "מייל", "כתובת", "תגיות", "תאריך הצטרפות", "מס׳ חיות"],
        ...customers.map((c) => [
          c.name,
          c.phone,
          c.email || "",
          c.address || "",
          c.tags || "",
          c.createdAt ? new Date(c.createdAt).toLocaleDateString("he-IL") : "",
          c._count.pets,
        ]),
      ];

      const customerSheet = XLSX.utils.aoa_to_sheet(customerData);
      // Set column widths
      customerSheet["!cols"] = [
        { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, customerSheet, "לקוחות");
    }

    // --- Pets sheet ---
    if (type === "pets" || type === "both") {
      const pets = await prisma.pet.findMany({
        where: {
          customer: { businessId: DEMO_BUSINESS_ID },
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
          p.customer.name,
          p.customer.phone,
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
