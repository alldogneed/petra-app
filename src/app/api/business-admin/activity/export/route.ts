export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { actionLabel } from "@/lib/activity-actions";
import { getBusinessActivityForExport } from "@/services/business";
import {
  parseActivityQuery,
  formatIsraelDateTime,
  sanitizeXlsxCell,
  entityTypeLabel,
  israelYmd,
} from "@/lib/business-admin-activity";

const EXPORT_RATE_LIMIT = { max: 5, windowMs: 60 * 1000 };

/**
 * GET /api/business-admin/activity/export — owner-only .xlsx of the activity log.
 * Same filters as /api/business-admin/activity (cursor/take ignored), max 5000 rows.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const businessId = user.businessId;

    const rl = rateLimit("export:activity", businessId, EXPORT_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות ייצוא. נסה שוב בעוד דקה." }, { status: 429 });
    }

    const parsed = parseActivityQuery(new URL(request.url).searchParams);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const rows = await getBusinessActivityForExport(businessId, prisma, parsed.value);

    const aoa: string[][] = [["תאריך ושעה", "משתמש", "פעולה", "סוג", "פריט"]];
    for (const r of rows) {
      aoa.push([
        formatIsraelDateTime(r.createdAt),
        sanitizeXlsxCell(r.userName),
        sanitizeXlsxCell(actionLabel(r.action)),
        sanitizeXlsxCell(entityTypeLabel(r.entityType)),
        sanitizeXlsxCell(r.entityLabel),
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 12 }, { wch: 32 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, "יומן פעילות");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    await logActivity(user.id, user.name, "EXPORT_ACTIVITY", { businessId, entityLabel: "יומן פעילות" });

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="petra-activity-${israelYmd()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("business-admin/activity/export GET error:", error);
    return NextResponse.json({ error: "שגיאה בייצוא יומן הפעילות" }, { status: 500 });
  }
}
