export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

// GET /api/customers/export
// Returns a UTF-8 CSV (with BOM for Excel) of all customers.
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  // Audit log: record who exported customer data and when
  const { session } = authResult;
  logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.EXPORT_CUSTOMERS);

  const customers = await prisma.customer.findMany({
    where: { businessId: authResult.businessId },
    orderBy: { name: "asc" },
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

  const headers = [
    "שם לקוח", "טלפון", "אימייל", "כתובת", "תגיות", "תורים", "תאריך הצטרפות",
    "שם חיית מחמד", "סוג", "גזע", "מין", "משקל (ק״ג)",
  ];

  const rows: string[][] = [];
  for (const c of customers) {
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

    const customerBase = [
      c.name,
      c.phone,
      c.email ?? "",
      c.address ?? "",
      tags,
      String(c._count.appointments),
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
          pet.gender ?? "",
          pet.weight != null ? String(pet.weight) : "",
        ]);
      }
    }
  }

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
