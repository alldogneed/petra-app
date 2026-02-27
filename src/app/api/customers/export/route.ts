export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/customers/export
// Returns a UTF-8 CSV (with BOM for Excel) of all customers.
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  const customers = await prisma.customer.findMany({
    where: { businessId: DEMO_BUSINESS_ID },
    orderBy: { name: "asc" },
    select: {
      name: true,
      phone: true,
      email: true,
      address: true,
      tags: true,
      createdAt: true,
      _count: {
        select: {
          pets: true,
          appointments: true,
        },
      },
    },
  });

  const headers = ["שם", "טלפון", "אימייל", "כתובת", "תגיות", "חיות מחמד", "תורים", "תאריך הצטרפות"];

  const rows = customers.map((c) => {
    let tags = "";
    try {
      const parsed = JSON.parse(c.tags || "[]");
      tags = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
    } catch {
      tags = "";
    }

    const joinedDate = new Date(c.createdAt).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return [
      c.name,
      c.phone,
      c.email ?? "",
      c.address ?? "",
      tags,
      String(c._count.pets),
      String(c._count.appointments),
      joinedDate,
    ];
  });

  // CSV escape: wrap in quotes and double any internal quotes
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const csvLines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  // BOM (0xEF 0xBB 0xBF) ensures Excel opens Hebrew correctly
  const bom = "\uFEFF";
  const csv = bom + csvLines.join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers_${today}.csv"`,
    },
  });
}
