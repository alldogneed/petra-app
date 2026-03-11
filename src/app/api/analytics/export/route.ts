export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import * as XLSX from "xlsx";

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("he-IL");
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "₪0";
  return `₪${n.toLocaleString("he-IL")}`;
}

const APPOINTMENT_STATUS: Record<string, string> = {
  scheduled: "מתוכנן",
  confirmed: "מאושר",
  completed: "הושלם",
  COMPLETED: "הושלם",
  canceled: "בוטל",
  no_show: "לא הגיע",
};

const PAYMENT_METHOD: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ׳ק",
  bit: "ביט",
  paybox: "פייבוקס",
  other: "אחר",
};

const PAYMENT_STATUS: Record<string, string> = {
  paid: "שולם",
  pending: "ממתין",
  partial: "חלקי",
  canceled: "בוטל",
  refunded: "הוחזר",
};

const ORDER_STATUS: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושרת",
  completed: "הושלמה",
  canceled: "בוטלה",
};

const TRAINING_TYPE: Record<string, string> = {
  HOME: "אילוף ביתי",
  BOARDING: "אילוף בפנסיון",
  SERVICE_DOG: "כלב שירות",
};

const TRAINING_STATUS: Record<string, string> = {
  ACTIVE: "פעיל",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
  PAUSED: "מושהה",
};

const BOARDING_STATUS: Record<string, string> = {
  reserved: "הזמנה",
  active: "פעיל",
  completed: "הושלם",
  canceled: "בוטל",
};

const TASK_CATEGORY: Record<string, string> = {
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  LEADS: "לידים",
  GENERAL: "כללי",
  HEALTH: "בריאות",
  MEDICATION: "תרופות",
  FEEDING: "האכלה",
};

const TASK_PRIORITY: Record<string, string> = {
  LOW: "נמוכה",
  MEDIUM: "בינונית",
  HIGH: "גבוהה",
  URGENT: "דחוף",
};

const TASK_STATUS: Record<string, string> = {
  OPEN: "פתוחה",
  COMPLETED: "הושלמה",
  CANCELED: "בוטלה",
};

const PET_GENDER: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  unknown: "לא ידוע",
};

const PET_SPECIES: Record<string, string> = {
  dog: "כלב",
  cat: "חתול",
  other: "אחר",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam || !toParam) {
      return new Response(JSON.stringify({ error: "חובה לציין טווח תאריכים (from, to)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);
    // Set toDate to end of day
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return new Response(JSON.stringify({ error: "תאריכים לא תקינים" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Run all queries in parallel
    const [
      customers,
      appointments,
      payments,
      orders,
      leads,
      leadStages,
      trainingPrograms,
      boardingStays,
      tasks,
      pets,
    ] = await Promise.all([
      // 1. Customers created in range
      prisma.customer.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        include: {
          _count: { select: { pets: true, appointments: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 2. Appointments in range
      prisma.appointment.findMany({
        where: { businessId, date: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { name: true } },
          pet: { select: { name: true } },
          service: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      }),
      // 3. Payments in range
      prisma.payment.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 4. Orders in range
      prisma.order.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { name: true } },
          lines: true,
          payments: { select: { amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 5. Leads in range
      prisma.lead.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
      }),
      // Lead stages for name lookup
      prisma.leadStage.findMany({
        where: { businessId },
        select: { id: true, name: true },
      }),
      // 6. Training programs started in range
      prisma.trainingProgram.findMany({
        where: { businessId, startDate: { gte: fromDate, lte: toDate } },
        include: {
          dog: { select: { name: true } },
          customer: { select: { name: true } },
          sessions: { select: { id: true } },
        },
        orderBy: { startDate: "desc" },
      }),
      // 7. Boarding stays in range
      prisma.boardingStay.findMany({
        where: { businessId, checkIn: { gte: fromDate, lte: toDate } },
        include: {
          pet: { select: { name: true } },
          customer: { select: { name: true } },
          room: { select: { name: true } },
        },
        orderBy: { checkIn: "desc" },
      }),
      // 8. Tasks in range
      prisma.task.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
      }),
      // 9. Pets created in range
      prisma.pet.findMany({
        where: {
          OR: [
            { customer: { businessId } },
            { businessId },
          ],
          createdAt: { gte: fromDate, lte: toDate },
        },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const stageMap = new Map(leadStages.map((s) => [s.id, s.name]));

    const wb = XLSX.utils.book_new();
    const fromLabel = fmt(fromDate);
    const toLabel = fmt(toDate);

    // ── Sheet 1: Summary ──
    const totalRevenue = payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    const summaryRows = [
      ["סיכום דוח", `${fromLabel} – ${toLabel}`],
      [],
      ["מדד", "ערך"],
      ["לקוחות חדשים", customers.length],
      ["תורים", appointments.length],
      ["תורים שהושלמו", appointments.filter((a) => a.status === "completed" || a.status === "COMPLETED").length],
      ["תורים שבוטלו", appointments.filter((a) => a.status === "canceled").length],
      ["הכנסות (שולם)", fmtCurrency(totalRevenue)],
      ["מספר תשלומים", payments.length],
      ["הזמנות", orders.length],
      ["לידים חדשים", leads.length],
      ["לידים שנסגרו (won)", leads.filter((l) => l.wonAt).length],
      ["לידים שאבדו (lost)", leads.filter((l) => l.lostAt).length],
      ["תוכניות אילוף", trainingPrograms.length],
      ["שהיות בפנסיון", boardingStays.length],
      ["משימות", tasks.length],
      ["משימות שהושלמו", tasks.filter((t) => t.status === "COMPLETED").length],
      ["חיות מחמד חדשות", pets.length],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "סיכום");

    // ── Sheet 2: Customers ──
    const customerHeaders = ["שם", "טלפון", "מייל", "כתובת", "תגיות", "תאריך הצטרפות", "מספר חיות", "מספר תורים"];
    const customerRows: (string | number)[][] = [customerHeaders];
    for (const c of customers) {
      const tags = c.tags ? (Array.isArray(c.tags) ? (c.tags as string[]).join(", ") : String(c.tags)) : "";
      customerRows.push([
        c.name,
        c.phone || "",
        c.email || "",
        c.address || "",
        tags,
        fmt(c.createdAt),
        c._count.pets,
        c._count.appointments,
      ]);
    }
    const wsCustomers = XLSX.utils.aoa_to_sheet(customerRows);
    wsCustomers["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsCustomers, "לקוחות");

    // ── Sheet 3: Appointments ──
    const apptHeaders = ["תאריך", "שעת התחלה", "שעת סיום", "סטטוס", "לקוח", "חיית מחמד", "שירות", "הערות"];
    const apptRows: (string | number)[][] = [apptHeaders];
    for (const a of appointments) {
      apptRows.push([
        fmt(a.date),
        a.startTime || "",
        a.endTime || "",
        APPOINTMENT_STATUS[a.status] ?? a.status,
        a.customer?.name ?? "",
        a.pet?.name ?? "",
        a.service?.name ?? "",
        a.notes || "",
      ]);
    }
    const wsAppt = XLSX.utils.aoa_to_sheet(apptRows);
    wsAppt["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsAppt, "תורים");

    // ── Sheet 4: Payments ──
    const payHeaders = ["סכום", "אמצעי תשלום", "סטטוס", "לקוח", "תאריך תשלום", "הערות"];
    const payRows: (string | number)[][] = [payHeaders];
    for (const p of payments) {
      payRows.push([
        p.amount,
        PAYMENT_METHOD[p.method] ?? p.method ?? "",
        PAYMENT_STATUS[p.status] ?? p.status,
        p.customer?.name ?? "",
        fmt(p.paidAt || p.createdAt),
        p.notes || "",
      ]);
    }
    const wsPay = XLSX.utils.aoa_to_sheet(payRows);
    wsPay["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsPay, "תשלומים");

    // ── Sheet 5: Orders ──
    const orderHeaders = ["מס׳ הזמנה", "לקוח", "סטטוס", "פריטים", "סה״כ", "שולם", "יתרה", "תאריך"];
    const orderRows: (string | number)[][] = [orderHeaders];
    for (const o of orders) {
      const linesSummary = o.lines.map((l) => l.name).filter(Boolean).join(", ");
      const paidAmount = o.payments
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      const total = o.total ?? 0;
      orderRows.push([
        o.id.slice(0, 8),
        o.customer?.name ?? "",
        ORDER_STATUS[o.status] ?? o.status,
        linesSummary,
        total,
        paidAmount,
        Math.max(0, total - paidAmount),
        fmt(o.createdAt),
      ]);
    }
    const wsOrders = XLSX.utils.aoa_to_sheet(orderRows);
    wsOrders["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsOrders, "הזמנות");

    // ── Sheet 6: Leads ──
    const leadHeaders = ["שם", "טלפון", "מקור", "שלב", "תאריך יצירה", "תאריך סגירה", "סיבת אובדן"];
    const leadRows: (string | number)[][] = [leadHeaders];
    for (const l of leads) {
      leadRows.push([
        l.name,
        l.phone || "",
        l.source || "",
        stageMap.get(l.stage) ?? l.stage ?? "",
        fmt(l.createdAt),
        l.wonAt || l.lostAt ? fmt(l.wonAt || l.lostAt) : "",
        l.lostReasonCode || l.lostReasonText || "",
      ]);
    }
    const wsLeads = XLSX.utils.aoa_to_sheet(leadRows);
    wsLeads["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsLeads, "לידים");

    // ── Sheet 7: Training Programs ──
    const trainingHeaders = ["שם תוכנית", "כלב", "לקוח", "סוג", "סטטוס", "מפגשים מתוכננים", "מפגשים שבוצעו", "מחיר", "תאריך התחלה"];
    const trainingRows: (string | number)[][] = [trainingHeaders];
    for (const tp of trainingPrograms) {
      trainingRows.push([
        tp.name || "",
        tp.dog?.name ?? "",
        tp.customer?.name ?? "",
        TRAINING_TYPE[tp.trainingType] ?? tp.trainingType ?? "",
        TRAINING_STATUS[tp.status] ?? tp.status,
        tp.totalSessions ?? "",
        tp.sessions.length,
        tp.price ?? "",
        fmt(tp.startDate),
      ]);
    }
    const wsTraining = XLSX.utils.aoa_to_sheet(trainingRows);
    wsTraining["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsTraining, "אילוף");

    // ── Sheet 8: Boarding Stays ──
    const boardingHeaders = ["חיית מחמד", "לקוח", "חדר", "כניסה", "יציאה", "סטטוס", "הערות"];
    const boardingRows: (string | number)[][] = [boardingHeaders];
    for (const bs of boardingStays) {
      boardingRows.push([
        bs.pet?.name ?? "",
        bs.customer?.name ?? "",
        bs.room?.name ?? "",
        fmt(bs.checkIn),
        fmt(bs.checkOut),
        BOARDING_STATUS[bs.status] ?? bs.status,
        bs.notes || "",
      ]);
    }
    const wsBoarding = XLSX.utils.aoa_to_sheet(boardingRows);
    wsBoarding["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsBoarding, "פנסיון");

    // ── Sheet 9: Tasks ──
    const taskHeaders = ["כותרת", "תיאור", "קטגוריה", "עדיפות", "סטטוס", "תאריך יעד", "הושלם בתאריך"];
    const taskRows: (string | number)[][] = [taskHeaders];
    for (const t of tasks) {
      taskRows.push([
        t.title || "",
        t.description || "",
        TASK_CATEGORY[t.category] ?? t.category ?? "",
        TASK_PRIORITY[t.priority] ?? t.priority ?? "",
        TASK_STATUS[t.status] ?? t.status,
        t.dueDate ? fmt(t.dueDate) : t.dueAt ? fmt(t.dueAt) : "",
        t.completedAt ? fmt(t.completedAt) : "",
      ]);
    }
    const wsTasks = XLSX.utils.aoa_to_sheet(taskRows);
    wsTasks["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsTasks, "משימות");

    // ── Sheet 10: Pets ──
    const petHeaders = ["שם", "סוג", "גזע", "מין", "תאריך לידה", "משקל", "בעלים"];
    const petRows: (string | number)[][] = [petHeaders];
    for (const p of pets) {
      petRows.push([
        p.name,
        PET_SPECIES[p.species] ?? p.species ?? "",
        p.breed || "",
        p.gender ? (PET_GENDER[p.gender] ?? p.gender) : "",
        p.birthDate ? fmt(p.birthDate) : "",
        p.weight ?? "",
        p.customer?.name ?? "",
      ]);
    }
    const wsPets = XLSX.utils.aoa_to_sheet(petRows);
    wsPets["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsPets, "חיות מחמד");

    // ── Write buffer & respond ──
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="petra-report-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/export error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא הדוח" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
