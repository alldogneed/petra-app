/**
 * AllDog WhatsApp bot — item 40 (Or, 28/10): the DB side of
 *   1. a request that is not about the caller's dog → one question at most, one closing line,
 *      a task "פנייה כללית: <שם> – <נושא>" for Or (linked to the customer / lead when the number
 *      has one), the conversation in its journal, an alert to Or — never a new lead;
 *   2. a customer already in touch with a rep → the conversation goes to the rep (handoff),
 *      a journal line; "התקשרתי חזרה ולא ענו" → an URGENT task for the rep.
 * Pure rules: general-rules.ts. State = one system row per conversation (no DDL):
 *   kind "general_inquiry" (waMessageId general:<conv>) and kind "with_rep" (with-rep:<conv>).
 * Conversation status "general" (plain string) while a general request is open: the idle-summary
 * cron, the reminder (nudge) and the partial closing only look at active / handoff, so no lead
 * is ever created for it.
 */
import prisma from "@/lib/prisma";
import { maskPhone } from "@/lib/whatsapp-failure";
import { addLeadCallLog, createLeadTask, findLeadByPhone, isPlaceholderLeadName } from "@/lib/alldog/leads";
import { addCustomerNote, createTask, findCustomersByPhone } from "@/services/clients";
import { GENERAL_KIND_LABELS, generalTaskTitle, looksLikeName, typedNameOf, type GeneralKind } from "@/lib/alldog-bot/general-rules";

const LOG = "[alldog-bot]";
export const GENERAL_STATUS = "general";
const GENERAL_KIND = "general_inquiry";
const WITH_REP_KIND = "with_rep";

export interface GeneralState {
  kind: GeneralKind;
  stage: "asked" | "closed";
  name: string | null;
  topic: string | null;
  asked: { topic: boolean; name: boolean };
  taskId: string | null;
  ackSent: boolean;
  at: string;
}

function appUrl(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

function localPhone(waId: string): string {
  return waId.startsWith("972") ? `0${waId.slice(3)}` : waId;
}

export async function readGeneralState(conversationId: string): Promise<GeneralState | null> {
  const row = await prisma.waBotMessage.findFirst({ where: { conversationId, role: "system", kind: GENERAL_KIND }, select: { text: true } });
  if (!row) return null;
  try {
    return JSON.parse(row.text) as GeneralState;
  } catch {
    return null;
  }
}

export async function saveGeneralState(conversationId: string, state: GeneralState): Promise<void> {
  const key = `general:${conversationId}`;
  await prisma.waBotMessage.upsert({
    where: { waMessageId: key },
    create: { conversationId, role: "system", kind: GENERAL_KIND, text: JSON.stringify(state), waMessageId: key },
    update: { text: JSON.stringify(state) },
  });
}

export async function clearGeneralState(conversationId: string): Promise<void> {
  await prisma.waBotMessage.deleteMany({ where: { conversationId, role: "system", kind: GENERAL_KIND } }).catch(() => {});
}

/** Who this number is in Petra: an existing customer, an active lead, and the best known name. */
export async function generalContact(conv: { businessId: string; phone: string; profileName: string | null }, texts: string[]) {
  const customers = await findCustomersByPhone(conv.businessId, prisma, localPhone(conv.phone)).catch(() => []);
  const customer = customers[0] ?? null;
  const lead = customer ? null : await findLeadByPhone(conv.businessId, conv.phone).catch(() => null);
  const typed = texts.map(typedNameOf).find(Boolean) ?? null;
  const name =
    customer?.name ||
    (lead && !isPlaceholderLeadName(lead.name) ? lead.name : null) ||
    typed ||
    (looksLikeName(conv.profileName) ? conv.profileName : null);
  return { customer, lead: lead ? { id: lead.id, name: lead.name } : null, name };
}

/**
 * Close a general request: the task for Or + the conversation in the customer's / lead's journal +
 * an alert to Or. No lead is created. Returns the task id (null when the task failed). Never throws.
 */
export async function finishGeneralInquiry(input: {
  conv: { id: string; businessId: string; phone: string; profileName: string | null };
  kind: GeneralKind;
  name: string | null;
  topic: string;
  transcript: Array<{ role: string; text: string }>;
}): Promise<string | null> {
  const { conv, kind } = input;
  try {
    const contact = await generalContact(conv, []);
    const name = input.name || contact.name || localPhone(conv.phone);
    const lines = input.transcript.map((m) => `${m.role === "user" ? "לקוח" : m.role === "human" ? "נציגה" : "בוט"}: ${m.text.replace(/\s+/g, " ").slice(0, 400)}`);
    const description = [
      "לטיפול: אור (הבעלים)",
      `סוג: ${GENERAL_KIND_LABELS[kind]}`,
      `טלפון: ${localPhone(conv.phone)}`,
      contact.customer ? `לקוח קיים: ${contact.customer.name}` : null,
      "",
      "השיחה בוואטסאפ:",
      ...lines,
    ]
      .filter((l) => l !== null)
      .join("\n")
      .slice(0, 4900);
    const priority = kind === "billing" || kind === "complaint" || kind === "own_trainer" ? "HIGH" : "MEDIUM";
    const title = generalTaskTitle(name, kind, input.topic);
    let taskId: string | null = null;
    if (contact.lead) {
      const t = await createLeadTask(conv.businessId, contact.lead.id, { title, description, priority });
      taskId = (t as { id?: string } | null)?.id ?? null;
    } else {
      const t = await createTask(conv.businessId, prisma, {
        title,
        description,
        category: "GENERAL",
        priority,
        dueAt: new Date().toISOString(),
        ...(contact.customer ? { relatedEntityType: "CUSTOMER", relatedEntityId: contact.customer.id } : {}),
      });
      taskId = (t as { id?: string } | null)?.id ?? null;
    }
    // The conversation in the journal of whoever this number is (never a new lead).
    const note = [`[וואטסאפ · בוט] פנייה כללית לאור: ${GENERAL_KIND_LABELS[kind]}`, ...lines].join("\n");
    if (contact.customer) await addCustomerNote(conv.businessId, prisma, contact.customer.id, note.slice(0, 2000)).catch(() => {});
    else if (contact.lead) await addLeadCallLog(contact.lead.id, note).catch(() => {});

    const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
    await notifyOwnerAllDog({
      title: `וואטסאפ: פנייה כללית – ${GENERAL_KIND_LABELS[kind]}`,
      lines: [`${name} · ${maskPhone(conv.phone)}`, `"${input.topic.replace(/\s+/g, " ").slice(0, 300)}"`],
      url: taskId ? `${appUrl()}/tasks?task=${taskId}` : `${appUrl()}/tasks`,
    }).catch(() => {});
    console.log(`${LOG} general request (${kind}) → task for Or (${maskPhone(conv.phone)})`);
    return taskId;
  } catch (err) {
    console.error(`${LOG} general request failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** A later message of a closed general request → added to its task. Never throws. */
export async function appendToGeneralTask(businessId: string, taskId: string | null, texts: string[]): Promise<void> {
  if (!taskId) return;
  try {
    const task = await prisma.task.findFirst({ where: { id: taskId, businessId }, select: { description: true } });
    if (!task) return;
    const add = texts.map((t) => `לקוח: ${t.replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
    await prisma.task.update({ where: { id: taskId }, data: { description: `${task.description ?? ""}\n${add}`.slice(0, 5000) } });
  } catch (err) {
    console.error(`${LOG} general follow-up failed:`, err instanceof Error ? err.message : err);
  }
}

// ─── 2. With a rep ────────────────────────────────────────────────────────────

/** The customer said they are in touch with a rep (this handoff). */
export async function markWithRep(conversationId: string, why: string): Promise<void> {
  const key = `with-rep:${conversationId}`;
  await prisma.waBotMessage
    .upsert({
      where: { waMessageId: key },
      create: { conversationId, role: "system", kind: WITH_REP_KIND, text: JSON.stringify({ why, at: new Date().toISOString() }), waMessageId: key },
      update: { text: JSON.stringify({ why, at: new Date().toISOString() }) },
    })
    .catch(() => {});
}

/** Is the current handoff one the customer reported ("already with a rep")? Only since the handoff started. */
export async function isWithRep(conversationId: string, handoffAt: Date | null): Promise<boolean> {
  const row = await prisma.waBotMessage.findFirst({ where: { conversationId, role: "system", kind: WITH_REP_KIND }, select: { text: true } });
  if (!row) return false;
  try {
    const at = Date.parse((JSON.parse(row.text) as { at?: string }).at ?? "");
    return !handoffAt || (!isNaN(at) && at >= handoffAt.getTime() - 60_000);
  } catch {
    return false;
  }
}

/** The conversation goes to the rep (status handoff, the customer's messages so far already "seen"). */
export async function handToRep(conversationId: string): Promise<void> {
  const now = new Date();
  await prisma.waBotConversation.updateMany({
    where: { id: conversationId, status: { in: ["active", "handoff"] } },
    data: { status: "handoff", handoffAt: now, handoffNotifiedAt: now },
  });
}

/** "התקשרתי חזרה ולא ענו": an URGENT task for the rep + a journal line. Never throws. */
export async function repMissedTask(input: { businessId: string; leadId: string | null; name: string; phone: string; text: string }): Promise<void> {
  try {
    if (!input.leadId) return;
    await addLeadCallLog(input.leadId, `[וואטסאפ · בוט] ⚠ הלקוח ניסה לחזור לנציגה ולא נענה: "${input.text.replace(/\s+/g, " ").slice(0, 300)}"`);
    await createLeadTask(input.businessId, input.leadId, {
      title: `דחוף: ${input.name} ניסה לחזור לנציגה ולא נענה – לחזור אליו`,
      description: [`הלקוח כתב בוואטסאפ: "${input.text.replace(/\s+/g, " ").slice(0, 500)}"`, "הבוט אמר לו שהנציגה תחזור אליו ושאל מתי נוח לו. התשובה תגיע לכרטיס הליד."].join("\n"),
      priority: "URGENT",
    });
    const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
    await notifyOwnerAllDog({
      title: "דחוף: לקוח ניסה לחזור לנציגה ולא נענה",
      lines: [`${input.name} · ${maskPhone(input.phone)}`, `"${input.text.replace(/\s+/g, " ").slice(0, 300)}"`],
      url: `${appUrl()}/leads?lead=${input.leadId}`,
    }).catch(() => {});
  } catch (err) {
    console.error(`${LOG} rep-missed task failed:`, err instanceof Error ? err.message : err);
  }
}
