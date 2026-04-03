export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושרת",
  completed: "הושלמה",
  cancelled: "בוטלה",
  canceled: "בוטלה",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  sale: "מוצרים",
  products: "מוצרים",
  appointment: "תור",
  training: "אילוף",
  boarding: "פנסיון",
  grooming: "טיפוח",
  service_dog: "כלבי שירות",
};

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const VALID_ORDER_STATUSES = ["draft", "confirmed", "completed", "cancelled", "canceled"];
  const where: Record<string, unknown> = { businessId: authResult.businessId };
  if (status && status !== "ALL") {
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
    }
    where.status = status;
  }
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to + "T23:59:59");
    where.createdAt = createdAt;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      lines: { select: { name: true, quantity: true, unitPrice: true, lineTotal: true } },
      payments: { select: { amount: true, status: true, method: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: (string | number)[][] = [
    [
      "מס' הזמנה",
      "לקוח",
      "טלפון",
      "מייל",
      "סוג",
      "סטטוס",
      "פריטים",
      'סה"כ לתשלום (₪)',
      "שולם (₪)",
      "יתרה (₪)",
      "תאריך יצירה",
    ],
  ];

  for (const o of orders) {
    const paidAmount = o.payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, o.total - paidAmount);
    const itemsSummary = o.lines.map((l) => `${l.name} ×${l.quantity}`).join(" | ");
    const dateStr = new Date(o.createdAt).toLocaleDateString("he-IL");

    rows.push([
      `#${o.id.slice(-8).toUpperCase()}`,
      o.customer.name,
      o.customer.phone,
      o.customer.email ?? "",
      ORDER_TYPE_LABELS[o.orderType] ?? o.orderType,
      STATUS_LABEL[o.status] ?? o.status,
      itemsSummary,
      o.total,
      paidAmount,
      remaining,
      dateStr,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, // order #
    { wch: 22 }, // customer
    { wch: 14 }, // phone
    { wch: 24 }, // email
    { wch: 10 }, // type
    { wch: 10 }, // status
    { wch: 45 }, // items
    { wch: 14 }, // total
    { wch: 12 }, // paid
    { wch: 12 }, // remaining
    { wch: 14 }, // date
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "הזמנות");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders_${today}.xlsx"`,
    },
  });
}
