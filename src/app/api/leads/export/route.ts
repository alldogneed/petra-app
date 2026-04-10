export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/leads/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns UTF-8 CSV (with BOM for Excel) of all leads in the date range.
// Includes ALL leads regardless of stage/status (won, lost, active).
export async function GET(request: NextRequest) {
  try {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId: authResult.businessId };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    };
  }

  // Fetch leads + stages in parallel
  const [leads, stages] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        callLogs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
      select: { id: true, name: true, isWon: true, isLost: true },
    }),
  ]);

  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const SOURCE_LABELS: Record<string, string> = {
    referral: "המלצה מלקוח", google: "גוגל", instagram: "אינסטגרם",
    facebook: "פייסבוק", tiktok: "טיקטוק", signage: "שלט / מעבר ברחוב",
    website: "אתר אינטרנט", manual: "הוספה ידנית", other: "אחר",
  };

  const LOST_REASON_LABELS: Record<string, string> = {
    price: "מחיר", competition: "מתחרה", competitor: "מתחרה",
    no_response: "אין מענה", not_interested: "לא מעוניין",
    timing: "תזמון לא מתאים", location: "מרחק / אזור", other: "אחר",
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const headers = [
    "שם", "טלפון", "אימייל", "עיר", "שירות מבוקש", "מקור הגעה",
    "שלב", "סטטוס", "הערות", "תאריך יצירה", "תאריך סגירה",
    "סיבת אובדן", "יצירת קשר אחרונה",
  ];

  const rows: string[][] = leads.map((l) => {
    const stage = stageMap.get(l.stage);
    const stageName = stage?.name ?? l.stage ?? "";
    const isWon = !!(l.wonAt || stage?.isWon);
    const isLost = !!(l.lostAt || stage?.isLost);
    const statusLabel = isWon ? "נסגר - זכה" : isLost ? "נסגר - אבד" : "פעיל";

    return [
      l.name,
      l.phone ?? "",
      l.email ?? "",
      l.city ?? "",
      l.requestedService ?? "",
      l.source ? (SOURCE_LABELS[l.source] ?? l.source) : "",
      stageName,
      statusLabel,
      l.notes ?? "",
      formatDate(l.createdAt),
      formatDate(l.wonAt ?? l.lostAt),
      l.lostReasonCode ? (LOST_REASON_LABELS[l.lostReasonCode] ?? l.lostReasonCode) : "",
      l.callLogs[0] ? formatDate(l.callLogs[0].createdAt) : "",
    ];
  });

  const escape = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `\t${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const csvLines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  const bom = "\uFEFF";
  const csv = bom + csvLines.join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  const rangeLabel = from || to ? `_${from ?? ""}${to ? "_עד_" + to : ""}` : "";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads_export${rangeLabel}_${today}.csv"`,
    },
  });
  } catch (error) {
    console.error("GET leads/export error:", error);
    return NextResponse.json({ error: "שגיאה בייצוא לידים" }, { status: 500 });
  }
}
