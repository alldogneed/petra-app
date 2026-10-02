/**
 * Business-admin "data health" (בריאות נתונים) — read-only checks that surface
 * data-quality problems for the business owner.
 *
 * Every query is strictly scoped by businessId and bounded (count + take ≤ 10,
 * or a raw GROUP BY … LIMIT 10). All checks run in parallel.
 * Customer-controlled strings are returned as plain text (UI renders as text);
 * phones are masked to the last 4 digits.
 */

import { Prisma } from "@prisma/client";
import type { DbClient } from "./supabase";
import { israelStartOfToday } from "@/lib/mcp/helpers";
import {
  DATA_HEALTH_MAX_ITEMS as TAKE,
  cleanLabel,
  computeHealthScore,
  expiredVaccineLabels,
  maskPhone,
  sortChecks,
  vaccineExpiryCutoffs,
  type DataHealthCheck,
  type DataHealthReport,
} from "@/lib/data-health";

const DAY_MS = 86_400_000;
/** Upper bound on DogHealth rows scanned for the expired-vaccinations check. */
const EXPIRED_SCAN_CAP = 2000;

const heDate = (d: Date) => d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });

function petOwnership(businessId: string): Prisma.PetWhereInput[] {
  return [{ customer: { businessId } }, { businessId }];
}

// ─── 1. Customers without a phone ───────────────────────────────────────────

async function customersNoPhone(businessId: string, db: DbClient): Promise<DataHealthCheck> {
  // phone is non-nullable; "blank" = empty or whitespace-only (raw for the trim).
  const [countRows, rows] = await Promise.all([
    db.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM "Customer"
      WHERE "businessId" = ${businessId} AND btrim("phone") = ''`,
    db.$queryRaw<{ id: string; name: string; createdAt: Date }[]>`
      SELECT "id", "name", "createdAt" FROM "Customer"
      WHERE "businessId" = ${businessId} AND btrim("phone") = ''
      ORDER BY "createdAt" DESC LIMIT ${TAKE}`,
  ]);
  return {
    key: "customers_no_phone",
    title: "לקוחות ללא טלפון",
    description: "לקוחות שאין להם מספר טלפון — אי אפשר לשלוח להם תזכורות או וואטסאפ.",
    severity: "high",
    count: Number(countRows[0]?.c ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      label: cleanLabel(r.name),
      sublabel: `נוצר ${heDate(r.createdAt)}`,
      href: `/customers/${r.id}`,
    })),
    fixHint: "פתחו את כרטיס הלקוח והוסיפו מספר טלפון.",
  };
}

// ─── 2. Duplicate customers (same normalized phone) ─────────────────────────

async function duplicateCustomers(businessId: string, db: DbClient): Promise<DataHealthCheck> {
  // Key = phoneNorm, else the same normalization as services/clients.ts phoneToNorm():
  // digits only, leading 0 → 972. Keys shorter than 9 digits are ignored (junk).
  const rows = await db.$queryRaw<{ key: string; c: number; ids: string[]; names: string[]; phone: string; total: bigint }[]>`
    WITH k AS (
      SELECT "id", "name", "phone", "createdAt",
        COALESCE(
          NULLIF("phoneNorm", ''),
          CASE
            WHEN regexp_replace("phone", '\\D', '', 'g') LIKE '0%'
              THEN '972' || substring(regexp_replace("phone", '\\D', '', 'g') FROM 2)
            ELSE regexp_replace("phone", '\\D', '', 'g')
          END
        ) AS key
      FROM "Customer"
      WHERE "businessId" = ${businessId}
    )
    SELECT key,
      COUNT(*)::int AS c,
      (array_agg("id" ORDER BY "createdAt" ASC))[1:5] AS ids,
      (array_agg("name" ORDER BY "createdAt" ASC))[1:5] AS names,
      (array_agg("phone" ORDER BY "createdAt" ASC))[1] AS phone,
      COUNT(*) OVER () AS total
    FROM k
    WHERE length(key) >= 9
    GROUP BY key
    HAVING COUNT(*) > 1
    ORDER BY c DESC, key ASC
    LIMIT ${TAKE}`;

  return {
    key: "duplicate_customers",
    title: "לקוחות כפולים",
    description: "כמה כרטיסי לקוח עם אותו מספר טלפון — היסטוריה, תשלומים ותזכורות מתפצלים ביניהם.",
    severity: "medium",
    count: Number(rows[0]?.total ?? 0),
    items: rows.map((r) => {
      const names = r.names.map((n) => cleanLabel(n, 30));
      const more = r.c > names.length ? ` ועוד ${r.c - names.length}` : "";
      return {
        id: r.ids[0],
        label: names.join(", ") + more,
        sublabel: `${r.c} כרטיסים · טלפון ${maskPhone(r.phone || r.key)}`,
        href: `/customers/${r.ids[0]}`,
      };
    }),
    fixHint: "בדקו את הכרטיסים, העבירו את המידע לכרטיס אחד ומחקו את הכפילות.",
  };
}

// ─── 3. Dogs with no vaccination record ─────────────────────────────────────

async function petsNoVaccinations(businessId: string, db: DbClient): Promise<DataHealthCheck> {
  const where: Prisma.PetWhereInput = {
    AND: [
      { OR: petOwnership(businessId) },
      { species: "dog" },
      // Service dogs are tracked in the service-dog vaccinations module (medical protocols).
      { serviceDogProfile: { is: null } },
      {
        OR: [
          { health: { is: null } },
          {
            health: {
              is: {
                rabiesLastDate: null, rabiesValidUntil: null, dhppLastDate: null,
                dhppPuppy1Date: null, dhppPuppy2Date: null, dhppPuppy3Date: null, bordatellaDate: null,
              },
            },
          },
        ],
      },
    ],
  };
  const [count, pets] = await Promise.all([
    db.pet.count({ where }),
    db.pet.findMany({
      where,
      select: { id: true, name: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: TAKE,
    }),
  ]);
  return {
    key: "pets_no_vaccinations",
    title: "כלבים ללא רישום חיסונים",
    description: "כלבים שלא הוזן להם אף חיסון (כלבת / משושה / שעלת) — אין מעקב תוקף ואין התראות.",
    severity: "medium",
    count,
    items: pets.map((p) => ({
      id: p.id,
      label: cleanLabel(p.name),
      sublabel: p.customer?.name ? `בעלים: ${cleanLabel(p.customer.name, 40)}` : undefined,
      href: `/pets/${p.id}`,
    })),
    fixHint: "בכרטיס הכלב ← בריאות, הזינו תאריכי חיסונים (או סמנו כלבת \"לא ידוע\").",
  };
}

// ─── 4. Expired vaccinations ────────────────────────────────────────────────

async function expiredVaccinations(businessId: string, db: DbClient, todayStart: Date): Promise<DataHealthCheck> {
  const cut = vaccineExpiryCutoffs(todayStart);
  const healths = await db.dogHealth.findMany({
    where: {
      pet: { OR: petOwnership(businessId) },
      OR: [
        { rabiesValidUntil: { lt: cut.rabies }, rabiesUnknown: false },
        { dhppLastDate: { lt: cut.dhppAdult } },
        { dhppLastDate: null, dhppPuppy3Date: { lt: cut.puppy3 } },
        {
          dhppLastDate: null, dhppPuppy3Date: null,
          OR: [{ dhppPuppy2Date: { lt: cut.puppyShort } }, { dhppPuppy2Date: null, dhppPuppy1Date: { lt: cut.puppyShort } }],
        },
      ],
    },
    select: {
      rabiesValidUntil: true, rabiesUnknown: true, dhppLastDate: true,
      dhppPuppy1Date: true, dhppPuppy2Date: true, dhppPuppy3Date: true, bordatellaDate: true,
      pet: { select: { id: true, name: true, customer: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "asc" },
    take: EXPIRED_SCAN_CAP,
  });

  const failing = healths
    .map((h) => ({ h, labels: expiredVaccineLabels(h, todayStart) }))
    .filter((x) => x.labels.length > 0);

  return {
    key: "expired_vaccinations",
    title: "חיסונים שפג תוקפם",
    description: "כלבים שחיסון הכלבת או המשושה שלהם פג — חשוב במיוחד לפני פנסיון או אילוף קבוצתי.",
    severity: "medium",
    count: failing.length,
    items: failing.slice(0, TAKE).map(({ h, labels }) => ({
      id: h.pet.id,
      label: cleanLabel(h.pet.name),
      sublabel: `פג: ${labels.join(", ")}${h.pet.customer?.name ? ` · בעלים: ${cleanLabel(h.pet.customer.name, 40)}` : ""}`,
      href: `/pets/${h.pet.id}`,
    })),
    fixHint: "עדכנו את תאריך החיסון האחרון בכרטיס הכלב, או שלחו לבעלים תזכורת לחדש.",
  };
}

// ─── 5. WhatsApp connection in error ────────────────────────────────────────

async function whatsappConnectionError(businessId: string, db: DbClient): Promise<DataHealthCheck> {
  const conn = await db.whatsAppConnection.findFirst({
    where: { businessId, status: "error" },
    select: { id: true, displayPhone: true, verifiedName: true, updatedAt: true },
  });
  return {
    key: "whatsapp_connection_error",
    title: "חיבור וואטסאפ בשגיאה",
    description: "המספר העסקי המחובר נכשל — הודעות נשלחות כרגע מהמספר של פטרה.",
    severity: "high",
    count: conn ? 1 : 0,
    items: conn
      ? [{
          id: conn.id,
          label: conn.verifiedName ? cleanLabel(conn.verifiedName, 40) : "חיבור וואטסאפ עסקי",
          sublabel: `${conn.displayPhone ? `${maskPhone(conn.displayPhone)} · ` : ""}עודכן ${heDate(conn.updatedAt)}`,
          href: "/settings?tab=integrations",
        }]
      : [],
    fixHint: "בהגדרות ← אינטגרציות, נתקו וחברו מחדש את מספר הוואטסאפ.",
  };
}

// ─── 6. Tasks overdue by more than 7 days ───────────────────────────────────

async function overdueTasksOld(businessId: string, db: DbClient, todayStart: Date): Promise<DataHealthCheck> {
  const cutoff = new Date(todayStart.getTime() - 7 * DAY_MS);
  const where: Prisma.TaskWhereInput = {
    businessId,
    status: "OPEN",
    OR: [{ dueDate: { lt: cutoff } }, { dueDate: null, dueAt: { lt: cutoff } }],
  };
  const [count, tasks] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      select: { id: true, title: true, dueDate: true, dueAt: true },
      orderBy: [{ dueDate: "asc" }, { dueAt: "asc" }],
      take: TAKE,
    }),
  ]);
  return {
    key: "overdue_tasks_old",
    title: "משימות באיחור של יותר משבוע",
    description: "משימות פתוחות שתאריך היעד שלהן עבר לפני יותר מ-7 ימים.",
    severity: "low",
    count,
    items: tasks.map((t) => {
      const due = t.dueDate ?? t.dueAt;
      return {
        id: t.id,
        label: cleanLabel(t.title),
        sublabel: due ? `יעד: ${heDate(due)}` : undefined,
        href: "/tasks",
      };
    }),
    fixHint: "סמנו כבוצעו, דחו לתאריך חדש או בטלו משימות שכבר לא רלוונטיות.",
  };
}

// ─── 7. Open leads without a follow-up date ─────────────────────────────────

async function leadsNoFollowup(businessId: string, db: DbClient, todayStart: Date): Promise<DataHealthCheck> {
  const closedStages = await db.leadStage.findMany({
    where: { businessId, OR: [{ isWon: true }, { isLost: true }] },
    select: { id: true },
  });
  const where: Prisma.LeadWhereInput = {
    businessId,
    wonAt: null,
    lostAt: null,
    nextFollowUpAt: null,
    createdAt: { lt: new Date(todayStart.getTime() - 3 * DAY_MS) },
    ...(closedStages.length ? { stage: { notIn: closedStages.map((s) => s.id) } } : {}),
  };
  const [count, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      select: { id: true, name: true, createdAt: true, phone: true },
      orderBy: { createdAt: "asc" },
      take: TAKE,
    }),
  ]);
  return {
    key: "leads_no_followup",
    title: "לידים פתוחים ללא תאריך מעקב",
    description: "לידים שנפתחו לפני יותר מ-3 ימים, עדיין פתוחים, ואין להם תאריך מעקב — קל לשכוח אותם.",
    severity: "medium",
    count,
    items: leads.map((l) => ({
      id: l.id,
      label: cleanLabel(l.name),
      sublabel: `נוצר ${heDate(l.createdAt)}${maskPhone(l.phone) ? ` · ${maskPhone(l.phone)}` : ""}`,
      href: "/leads",
    })),
    fixHint: "בכרטיס הליד קבעו תאריך מעקב, או סגרו אותו כזכייה / הפסד.",
  };
}

// ─── 8 (extra). Past appointments still "scheduled"/"confirmed" ─────────────

async function staleAppointments(businessId: string, db: DbClient, todayStart: Date): Promise<DataHealthCheck> {
  const where: Prisma.AppointmentWhereInput = {
    businessId,
    status: { in: ["scheduled", "confirmed"] },
    date: { lt: new Date(todayStart.getTime() - 2 * DAY_MS) },
  };
  const [count, appts] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      select: {
        id: true, date: true, startTime: true, customerId: true,
        customer: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: TAKE,
    }),
  ]);
  return {
    key: "stale_appointments",
    title: "תורים שעברו ולא עודכן סטטוס",
    description: "תורים שהתקיימו לפני יותר מיומיים ועדיין מסומנים \"מתוכנן\" — דוחות ההכנסות והנוכחות לא מדויקים.",
    severity: "low",
    count,
    items: appts.map((a) => ({
      id: a.id,
      label: cleanLabel(a.customer?.name),
      sublabel: `${heDate(a.date)} ${a.startTime}${a.service?.name ? ` · ${cleanLabel(a.service.name, 30)}` : ""}`,
      href: `/customers/${a.customerId}`,
    })),
    fixHint: "סמנו את התורים כהושלמו, בוטלו או לא הגיע.",
  };
}

// ─── 9 (extra). Customers without any pet ───────────────────────────────────

async function customersNoPets(businessId: string, db: DbClient, todayStart: Date): Promise<DataHealthCheck> {
  // Grace period of 7 days — a new customer's dog is often added a bit later.
  const where: Prisma.CustomerWhereInput = {
    businessId,
    pets: { none: {} },
    createdAt: { lt: new Date(todayStart.getTime() - 7 * DAY_MS) },
  };
  const [count, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      select: { id: true, name: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: TAKE,
    }),
  ]);
  return {
    key: "customers_no_pets",
    title: "לקוחות ללא כלב",
    description: "לקוחות שלא משויכת אליהם אף חיית מחמד — אי אפשר לקבוע להם פנסיון, אילוף או מעקב חיסונים.",
    severity: "low",
    count,
    items: customers.map((c) => ({
      id: c.id,
      label: cleanLabel(c.name),
      sublabel: maskPhone(c.phone) || undefined,
      href: `/customers/${c.id}`,
    })),
    fixHint: "הוסיפו את הכלב בכרטיס הלקוח (או מחקו לקוחות שנפתחו בטעות).",
  };
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function getDataHealth(businessId: string, db: DbClient): Promise<DataHealthReport> {
  const todayStart = israelStartOfToday();
  const checks = await Promise.all([
    customersNoPhone(businessId, db),
    duplicateCustomers(businessId, db),
    petsNoVaccinations(businessId, db),
    expiredVaccinations(businessId, db, todayStart),
    whatsappConnectionError(businessId, db),
    overdueTasksOld(businessId, db, todayStart),
    leadsNoFollowup(businessId, db, todayStart),
    staleAppointments(businessId, db, todayStart),
    customersNoPets(businessId, db, todayStart),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    score: computeHealthScore(checks),
    checks: sortChecks(checks),
  };
}
