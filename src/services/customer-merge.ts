/**
 * Customer merge service — merge a duplicate customer ("source") INTO the
 * customer that stays ("target").
 *
 * The WHAT lives in `src/lib/customer-merge-plan.ts` (pure, schema-tested);
 * this file executes it. Rules:
 *  - NO $transaction (Supabase PgBouncer) — every step runs sequentially.
 *  - Every step is idempotent: re-pointing `source → target` twice is a no-op,
 *    the field merge dedupes, so a merge that failed midway is completed by
 *    simply running it again (the source exists until the very last step).
 *  - Before deleting the source we recount every relation; anything left
 *    (would be cascade-deleted) aborts the merge instead.
 *  - Both ids are validated non-empty strings and verified to belong to the
 *    business BEFORE any updateMany (an undefined in a Prisma where = cross-tenant).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { ServiceError } from "./types";
import {
  MERGE_RELATIONS, CUSTOMER_ENTITY_TYPE, buildCustomerMergeUpdate, emptyMergeCounts,
  phoneTail, totalMergeCount, type MergeCounts, type MergeRelationKey,
} from "@/lib/customer-merge-plan";

type DbClient = PrismaClient;

export { ServiceError };

const CUSTOMER_SELECT = {
  id: true, name: true, phone: true, phoneNorm: true, email: true, address: true, idNumber: true,
  secondContactName: true, secondContactPhone: true, notes: true, tags: true, documents: true,
} as const;

function assertId(v: unknown, label: string): asserts v is string {
  if (typeof v !== "string" || v.trim() === "" || v.length > 64) {
    throw new ServiceError(`מזהה ${label} לא תקין`, "VALIDATION");
  }
}

interface RelationHandler {
  count: (db: DbClient, businessId: string, customerId: string) => Promise<number>;
  repoint: (db: DbClient, businessId: string, sourceId: string, targetId: string) => Promise<number>;
}

/**
 * One handler per plan row. `Record<MergeRelationKey, …>` makes TypeScript fail
 * if a row is added to MERGE_RELATIONS without a handler here.
 * Models with a non-nullable businessId always filter by it; the others filter
 * through a relation to a business-owned row (or a globally-unique uuid that was
 * verified to belong to this business).
 */
const HANDLERS: Record<MergeRelationKey, RelationHandler> = {
  pets: {
    count: (db, businessId, id) => db.pet.count({ where: { customerId: id, customer: { businessId } } }),
    repoint: async (db, businessId, s, t) =>
      (await db.pet.updateMany({ where: { customerId: s, customer: { businessId } }, data: { customerId: t } })).count,
  },
  appointments: {
    count: (db, businessId, id) => db.appointment.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.appointment.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  payments: {
    count: (db, businessId, id) => db.payment.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.payment.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  orders: {
    count: (db, businessId, id) => db.order.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.order.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  bookings: {
    count: (db, businessId, id) => db.booking.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.booking.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  boardingStays: {
    count: (db, businessId, id) => db.boardingStay.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.boardingStay.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  leads: {
    count: (db, businessId, id) => db.lead.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.lead.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  trainingPrograms: {
    count: (db, businessId, id) => db.trainingProgram.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.trainingProgram.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  trainingGroupParticipants: {
    // Unique is (trainingGroupId, dogId) — the dog moves with its owner, so no collision.
    count: (db, businessId, id) =>
      db.trainingGroupParticipant.count({ where: { customerId: id, trainingGroup: { businessId } } }),
    repoint: async (db, businessId, s, t) =>
      (await db.trainingGroupParticipant.updateMany({
        where: { customerId: s, trainingGroup: { businessId } },
        data: { customerId: t },
      })).count,
  },
  trainingGroupAttendance: {
    count: (db, businessId, id) =>
      db.trainingGroupAttendance.count({ where: { customerId: id, session: { trainingGroup: { businessId } } } }),
    repoint: async (db, businessId, s, t) =>
      (await db.trainingGroupAttendance.updateMany({
        where: { customerId: s, session: { trainingGroup: { businessId } } },
        data: { customerId: t },
      })).count,
  },
  scheduledMessages: {
    count: (db, businessId, id) => db.scheduledMessage.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.scheduledMessage.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  intakeForms: {
    count: (db, businessId, id) => db.intakeForm.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.intakeForm.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  contractRequests: {
    count: (db, businessId, id) => db.contractRequest.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.contractRequest.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  invoiceJobs: {
    count: (db, businessId, id) => db.invoiceJob.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.invoiceJob.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  invoiceDocuments: {
    count: (db, businessId, id) => db.invoiceDocument.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.invoiceDocument.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  serviceDogRecipients: {
    count: (db, businessId, id) => db.serviceDogRecipient.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.serviceDogRecipient.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  timelineEvents: {
    count: (db, businessId, id) => db.timelineEvent.count({ where: { businessId, customerId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.timelineEvent.updateMany({ where: { businessId, customerId: s }, data: { customerId: t } })).count,
  },
  tasks: {
    count: (db, businessId, id) =>
      db.task.count({ where: { businessId, relatedEntityType: CUSTOMER_ENTITY_TYPE, relatedEntityId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.task.updateMany({
        where: { businessId, relatedEntityType: CUSTOMER_ENTITY_TYPE, relatedEntityId: s },
        data: { relatedEntityId: t },
      })).count,
  },
  taskRecurrenceRules: {
    count: (db, businessId, id) =>
      db.taskRecurrenceRule.count({ where: { businessId, relatedEntityType: CUSTOMER_ENTITY_TYPE, relatedEntityId: id } }),
    repoint: async (db, businessId, s, t) =>
      (await db.taskRecurrenceRule.updateMany({
        where: { businessId, relatedEntityType: CUSTOMER_ENTITY_TYPE, relatedEntityId: s },
        data: { relatedEntityId: t },
      })).count,
  },
  onboardingProgress: {
    // Keyed by userId (no businessId). The id is a uuid already verified to be
    // this business's customer, so matching on it cannot touch another tenant.
    count: (db, _businessId, id) => db.onboardingProgress.count({ where: { lastCustomerId: id } }),
    repoint: async (db, _businessId, s, t) =>
      (await db.onboardingProgress.updateMany({ where: { lastCustomerId: s }, data: { lastCustomerId: t } })).count,
  },
};

async function loadPair(db: DbClient, businessId: string, targetId: unknown, sourceId: unknown) {
  assertId(businessId, "עסק");
  assertId(targetId, "לקוח");
  assertId(sourceId, "לקוח כפול");
  if (targetId === sourceId) throw new ServiceError("לא ניתן למזג לקוח עם עצמו", "VALIDATION");

  const [target, source] = await Promise.all([
    db.customer.findFirst({ where: { id: targetId, businessId }, select: CUSTOMER_SELECT }),
    db.customer.findFirst({ where: { id: sourceId, businessId }, select: CUSTOMER_SELECT }),
  ]);
  if (!target) throw new ServiceError("הלקוח לא נמצא", "NOT_FOUND");
  if (!source) throw new ServiceError("הלקוח הכפול לא נמצא", "NOT_FOUND");
  return { target, source };
}

async function countAll(db: DbClient, businessId: string, customerId: string): Promise<MergeCounts> {
  const counts = emptyMergeCounts();
  // Sequential on purpose — keeps the pooled connection count low.
  for (const r of MERGE_RELATIONS) {
    counts[r.key] = await HANDLERS[r.key].count(db, businessId, customerId);
  }
  return counts;
}

export interface MergePreview {
  target: { id: string; name: string; phone: string };
  source: { id: string; name: string; phone: string; email: string | null };
  counts: MergeCounts;
  total: number;
}

export async function previewCustomerMerge(
  businessId: string, db: DbClient, targetId: unknown, sourceId: unknown,
): Promise<MergePreview> {
  const { target, source } = await loadPair(db, businessId, targetId, sourceId);
  const counts = await countAll(db, businessId, source.id);
  return {
    target: { id: target.id, name: target.name, phone: target.phone },
    source: { id: source.id, name: source.name, phone: source.phone, email: source.email },
    counts,
    total: totalMergeCount(counts),
  };
}

export interface MergeResult {
  target: { id: string; name: string };
  source: { id: string; name: string; phone: string };
  moved: MergeCounts;
}

export async function mergeCustomers(
  businessId: string, db: DbClient, targetId: unknown, sourceId: unknown,
): Promise<MergeResult> {
  const { target, source } = await loadPair(db, businessId, targetId, sourceId);
  const s = source.id;
  const t = target.id;

  // 1. Re-point every referencing row (idempotent).
  const moved = emptyMergeCounts();
  for (const r of MERGE_RELATIONS) {
    moved[r.key] = await HANDLERS[r.key].repoint(db, businessId, s, t);
  }

  // 2. Field-level merge onto the target (idempotent — dedupes tags/docs/notes).
  const update = buildCustomerMergeUpdate(target, source);
  if (Object.keys(update).length > 0) {
    await db.customer.updateMany({ where: { id: t, businessId }, data: update });
  }

  // 3. Safety net: nothing may still reference the source (FK cascades would delete it).
  const leftover = await countAll(db, businessId, s);
  if (totalMergeCount(leftover) > 0) {
    const what = Object.entries(leftover).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(", ");
    console.error(`[customer-merge] leftover rows on source ${s}: ${what}`);
    throw new ServiceError("המיזוג לא הושלם — נסה שוב", "CONFLICT", { leftover });
  }

  // 4. Delete the source (scoped by business).
  await db.customer.deleteMany({ where: { id: s, businessId } });

  // 5. Journal line on the target (rule 8: no title field).
  await db.timelineEvent.create({
    data: {
      type: "note",
      description: `מוזג לקוח כפול: ${source.name} (${source.phone})`.slice(0, 2000),
      businessId,
      customerId: t,
    },
  });

  return {
    target: { id: t, name: target.name },
    source: { id: s, name: source.name, phone: source.phone },
    moved,
  };
}

// ─── Duplicate candidates ────────────────────────────────────────────────────

export interface MergeCandidate {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  petNames: string[];
  /** Why it was suggested (empty-q mode only). */
  match: "phone" | "email" | "name" | null;
}

const CANDIDATE_LIMIT = 10;

export async function findMergeCandidates(
  businessId: string, db: DbClient, targetId: unknown, rawQ: unknown,
): Promise<MergeCandidate[]> {
  assertId(businessId, "עסק");
  assertId(targetId, "לקוח");
  const target = await db.customer.findFirst({
    where: { id: targetId, businessId },
    select: { id: true, name: true, phone: true, phoneNorm: true, email: true },
  });
  if (!target) throw new ServiceError("הלקוח לא נמצא", "NOT_FOUND");

  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const select = {
    id: true, name: true, phone: true, phoneNorm: true, email: true,
    pets: { select: { name: true }, take: 5, orderBy: { createdAt: "asc" as const } },
  };
  type Row = { id: string; name: string; phone: string; phoneNorm: string | null; email: string | null; pets: { name: string }[] };
  const toCandidate = (c: Row, match: MergeCandidate["match"]): MergeCandidate => ({
    id: c.id, name: c.name, phone: c.phone, email: c.email, petNames: c.pets.map((p) => p.name), match,
  });

  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.CustomerWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    if (digits.length >= 3) {
      or.push({ phone: { contains: digits } });
      // phoneNorm is 972XXXXXXXXX — strip a leading 0 so "0501…" matches.
      or.push({ phoneNorm: { contains: digits.replace(/^0/, "") } });
    }
    const rows = await db.customer.findMany({
      where: { businessId, id: { not: target.id }, OR: or },
      select, orderBy: { name: "asc" }, take: CANDIDATE_LIMIT,
    });
    return rows.map((r) => toCandidate(r, null));
  }

  // Empty q → likely duplicates first: same phone / same email / same name.
  const tail = phoneTail(target.phoneNorm ?? target.phone);
  const or: Prisma.CustomerWhereInput[] = [{ name: { equals: target.name.trim(), mode: "insensitive" } }];
  if (tail) or.push({ phoneNorm: { endsWith: tail } }, { phone: { contains: tail.slice(-7) } });
  if (target.email?.trim()) or.push({ email: { equals: target.email.trim(), mode: "insensitive" } });

  const likely = await db.customer.findMany({
    where: { businessId, id: { not: target.id }, OR: or },
    select, orderBy: { createdAt: "desc" }, take: 50,
  });

  const scored = likely
    .map((c) => {
      let match: MergeCandidate["match"] = null;
      let score = 0;
      if (tail && phoneTail(c.phoneNorm ?? c.phone) === tail) { match = "phone"; score = 3; }
      else if (target.email && c.email && c.email.trim().toLowerCase() === target.email.trim().toLowerCase()) { match = "email"; score = 2; }
      else if (c.name.trim().toLowerCase() === target.name.trim().toLowerCase()) { match = "name"; score = 1; }
      return { c, match, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_LIMIT);

  const out = scored.map((x) => toCandidate(x.c, x.match));
  if (out.length < CANDIDATE_LIMIT) {
    const recent = await db.customer.findMany({
      where: { businessId, id: { notIn: [target.id, ...out.map((o) => o.id)] } },
      select, orderBy: { createdAt: "desc" }, take: CANDIDATE_LIMIT - out.length,
    });
    out.push(...recent.map((r) => toCandidate(r, null)));
  }
  return out;
}
