export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sessionHasTenantPermission, TENANT_PERMS } from "@/lib/permissions";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { rateLimit } from "@/lib/rate-limit";
import { parseCustomerFilters, compareCustomerNames } from "@/lib/customer-filters";
import { computeCustomerBalances, type CustomerBalance } from "@/lib/customer-balance";
import { listCustomerIds } from "@/services/customer-list";
import { canReadCustomers } from "@/lib/customer-access";
import * as XLSX from "xlsx";

const EXPORT_RATE_LIMIT = { max: 5, windowMs: 60 * 1000 }; // 5 exports per minute
const EXPORT_CAP = 10_000;
const MAX_SELECTED_IDS = 2_000;
const CHUNK = 1_000;

// GET /api/customers/export
// Returns an XLSX workbook with customers and their pets.
// Honours the list filters (same params as GET /api/customers — src/lib/customer-filters.ts),
// or `ids=<comma list>` (selected rows). Adds a balance column with FINANCE_READ.
export async function GET(request: NextRequest) {
  return exportCustomers(request, null);
}

// POST /api/customers/export { ids: string[] } — selected rows (a long id list doesn't fit in a URL).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids = body && Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : null;
  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "לא נבחרו לקוחות" }, { status: 400 });
  }
  return exportCustomers(request, ids);
}

async function exportCustomers(request: NextRequest, bodyIds: string[] | null) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  if (!sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.DATA_EXPORT)) {
    return NextResponse.json({ error: "אין לך הרשאה לייצא נתונים" }, { status: 403 });
  }
  // The export IS the customer file (name, phone, address…) — same gate as viewing the list.
  if (!canReadCustomers(authResult.session, authResult.businessId)) {
    return NextResponse.json({ error: "אין הרשאה לצפות בלקוחות" }, { status: 403 });
  }

  // Rate limit exports to prevent abuse
  const rl = rateLimit("export:customers", authResult.businessId, EXPORT_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות ייצוא. נסה שוב בעוד דקה." }, { status: 429 });
  }

  const { session, businessId } = authResult;
  const canSeeFinance = sessionHasTenantPermission(session, businessId, TENANT_PERMS.FINANCE_READ);
  const { searchParams } = new URL(request.url);
  const filters = parseCustomerFilters(searchParams);
  const rawIds = bodyIds ?? searchParams.get("ids")?.split(",") ?? null;
  const selectedIds = rawIds
    ? Array.from(new Set(rawIds.slice(0, MAX_SELECTED_IDS * 2).map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 64))).slice(0, MAX_SELECTED_IDS)
    : null;

  await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.EXPORT_CUSTOMERS, {
    businessId,
    entityLabel: selectedIds ? `לקוחות נבחרים (${selectedIds.length})` : "לקוחות",
  });

  try {
    // Ordered ids: selected rows (scoped to this business below) or the filtered list.
    const orderedIds = selectedIds
      ? selectedIds
      : await listCustomerIds(businessId, prisma, { ...filters, includeFinance: canSeeFinance }, EXPORT_CAP);

    const customers = [];
    for (let i = 0; i < orderedIds.length; i += CHUNK) {
      const chunk = orderedIds.slice(i, i + CHUNK);
      if (chunk.length === 0) continue;
      const rows = await prisma.customer.findMany({
      where: { businessId, id: { in: chunk } },
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
      customers.push(...rows);
    }
    if (selectedIds) {
      customers.sort(compareCustomerNames);
    } else {
      const pos = new Map(orderedIds.map((id, i) => [id, i]));
      customers.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    }

    const balances = new Map<string, CustomerBalance>();
    if (canSeeFinance) {
      const ids = customers.map((c) => c.id);
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const m = await computeCustomerBalances(prisma, businessId, chunk);
        m.forEach((v, k) => balances.set(k, v));
      }
    }

    const SOURCE_LABELS: Record<string, string> = {
      referral: "המלצה מלקוח", google: "גוגל", instagram: "אינסטגרם",
      facebook: "פייסבוק", tiktok: "טיקטוק", signage: "שלט / מעבר ברחוב", other: "אחר",
    };

    const headers = [
      "שם לקוח", "טלפון", "אימייל", "כתובת", "תגיות", "מקור הגעה",
      "הערות", "תורים", "תאריך הצטרפות",
      ...(canSeeFinance ? ["יתרת חוב (₪)", "סה״כ שולם (₪)"] : []),
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
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jerusalem",
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
        ...(canSeeFinance
          ? [balances.get(c.id)?.outstanding ?? 0, balances.get(c.id)?.totalPaid ?? 0]
          : []),
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
      ...(canSeeFinance ? [{ wch: 12 }, { wch: 12 }] : []),
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
