/**
 * PayCall call from a number that belongs to an existing CUSTOMER → no new lead.
 * The call is recorded on the customer instead, through the existing services
 * (addCustomerNote = timeline MANUAL_NOTE, createTask with relatedEntityType CUSTOMER —
 * the same functions behind MCP add_client_note / create_task):
 *   - missed call   → note + a "לחזור ללקוח" task (normal priority; one open task at a time)
 *   - answered call → note with the summary (+ a task for the agreed next step, if any)
 * Idempotent on the PayCall call id: the note carries `call_id:<ID>`.
 */
import prisma from "@/lib/prisma";
import { addCustomerNote, createTask, findCustomersByPhone } from "@/services/clients";

export interface CallCustomer {
  id: string;
  name: string;
  /** How many customers share this phone (the most recently updated one is used). */
  matches: number;
}

/** `call_id:12` must not match `call_id:123`. */
export function hasCallIdToken(text: string, callId: string): boolean {
  const escaped = callId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`call_id:${escaped}(?![0-9A-Za-z])`).test(text);
}

export async function findCustomerForCall(businessId: string, phone: string): Promise<CallCustomer | null> {
  const rows = await findCustomersByPhone(businessId, prisma, phone);
  if (!rows.length) return null;
  return { id: rows[0].id, name: rows[0].name, matches: rows.length };
}

/** True when a customer timeline note of this business already carries this call id. */
export async function callIdLoggedOnCustomer(businessId: string, callId: string): Promise<boolean> {
  const rows = await prisma.timelineEvent.findMany({
    where: { businessId, description: { contains: `call_id:${callId}` } },
    select: { description: true },
    take: 5,
  });
  return rows.some((r) => hasCallIdToken(r.description, callId));
}

/** The customer timeline note of this call (exact call_id match), or null. */
export async function findCustomerNoteForCall(
  businessId: string,
  callId: string
): Promise<{ id: string; customerId: string | null; description: string } | null> {
  const rows = await prisma.timelineEvent.findMany({
    where: { businessId, description: { contains: `call_id:${callId}` } },
    select: { id: true, customerId: true, description: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  return rows.find((r) => hasCallIdToken(r.description, callId)) ?? null;
}

const CALLBACK_TITLE_PREFIX = "לחזור ללקוח";

/** Text of the customer note (≤ 2000 chars — addCustomerNote's limit). */
export function customerCallNote(p: {
  kind: "missed" | "answered";
  callId: string;
  dateLabel: string;
  detail?: string | null;
  matches?: number;
}): string {
  const head =
    p.kind === "missed"
      ? `[paycall] שיחה שלא נענתה מהלקוח ב-${p.dateLabel} • call_id:${p.callId}`
      : `[paycall-answered] שיחה שנענתה ב-${p.dateLabel} • call_id:${p.callId}`;
  const shared = p.matches && p.matches > 1 ? `(המספר רשום אצל ${p.matches} לקוחות)` : null;
  const text = [head, p.detail?.trim() || null, shared].filter(Boolean).join("\n");
  return text.length <= 2000 ? text : `${text.slice(0, 1997)}...`;
}

/** Missed call from a customer: note + one open callback task (normal priority). */
export async function logMissedCallOnCustomer(
  businessId: string,
  customer: CallCustomer,
  call: { callId: string; dateLabel: string; disposition: string; phone: string }
): Promise<{ taskCreated: boolean }> {
  await addCustomerNote(
    businessId,
    prisma,
    customer.id,
    customerCallNote({ kind: "missed", callId: call.callId, dateLabel: call.dateLabel, detail: `סטטוס: ${call.disposition}`, matches: customer.matches })
  );
  const open = await prisma.task.findFirst({
    where: {
      businessId,
      relatedEntityType: "CUSTOMER",
      relatedEntityId: customer.id,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      title: { startsWith: CALLBACK_TITLE_PREFIX },
    },
    select: { id: true },
  });
  if (open) return { taskCreated: false };
  await createTask(businessId, prisma, {
    title: `${CALLBACK_TITLE_PREFIX}: ${customer.name}`,
    description: `שיחה שלא נענתה ב-${call.dateLabel} מ-${call.phone}`,
    category: "GENERAL",
    priority: "MEDIUM",
    dueAt: new Date().toISOString(),
    relatedEntityType: "CUSTOMER",
    relatedEntityId: customer.id,
  });
  return { taskCreated: true };
}

/** Answered call from a customer: note with the summary; a task when a next step was agreed. */
export async function logAnsweredCallOnCustomer(
  businessId: string,
  customer: CallCustomer,
  call: { callId: string; dateLabel: string; summary: string; nextStep?: string | null; followUpAt?: Date | null },
  /** A note already written for this call (the "summary pending" placeholder) → updated in place. */
  existingNoteId?: string | null
): Promise<{ taskCreated: boolean }> {
  const text = customerCallNote({ kind: "answered", callId: call.callId, dateLabel: call.dateLabel, detail: call.summary, matches: customer.matches });
  if (existingNoteId) {
    await prisma.timelineEvent.updateMany({ where: { id: existingNoteId, businessId }, data: { description: text } });
  } else {
    await addCustomerNote(businessId, prisma, customer.id, text);
  }
  if (!call.nextStep) return { taskCreated: false };
  await createTask(businessId, prisma, {
    title: `המשך טיפול: ${customer.name}`,
    description: `מה סוכם בשיחה מ-${call.dateLabel}: ${call.nextStep}`.slice(0, 4900),
    category: "GENERAL",
    priority: "MEDIUM",
    dueAt: (call.followUpAt ?? new Date()).toISOString(),
    relatedEntityType: "CUSTOMER",
    relatedEntityId: customer.id,
  });
  return { taskCreated: true };
}
