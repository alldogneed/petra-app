/**
 * AllDog WhatsApp bot — the real tool executor. Every lead / task / follow-up write
 * goes through src/lib/alldog/leads.ts → the existing lead services.
 */
import prisma from "@/lib/prisma";
import { alertNewLeadIfEnabled } from "@/lib/lead-alert";
import { runAfterResponse } from "@/lib/wait-until";
import { claimOnce } from "@/lib/rate-limit";
import { maskPhone } from "@/lib/whatsapp-failure";
import {
  addLeadCallLog,
  createLeadTask,
  isPlaceholderLeadName,
  localPhone,
  upsertLeadFromContact,
} from "@/lib/alldog/leads";
import { israelYmd } from "@/lib/alldog/time";
import { URGENT_NOTE_PREFIX } from "@/lib/alldog-bot/logic";
import { botLeadAttribution } from "@/lib/alldog-bot/attribution";
import {
  areaFact,
  BOT_LOG_PREFIX,
  callbackFact,
  callbackTimeFact,
  otherIssueFact,
  URGENT_FACT,
  urgentFact,
  urgentFactOf,
  withBody,
  withFact,
} from "@/lib/alldog-bot/journal";
import type { Gender } from "@/lib/alldog-bot/address";
import { callbackClosingText, closingWhen, closingWithTransition, handoffClosingText } from "@/lib/alldog-bot/handoff";
import { isKnownServiceCity, unknownAreaToolNote } from "@/lib/alldog-bot/areas";
import { type BotToolExecutor, type HandoffInput, type SaveLeadInput, type ScheduleCallbackInput } from "@/lib/alldog-bot/agent";

export const BOT_LEAD_SOURCE = "וואטסאפ · בוט";

export interface BotConversationRef {
  id: string;
  businessId: string;
  phone: string;
  profileName: string | null;
  leadId: string | null;
  summaryCallLogId: string | null;
  attributionSource: string | null;
  attributionPage: string | null;
  /** How to address the customer (item 25) — set per turn by inbound; drives the closing text. */
  gender?: Gender;
  /** The transition line (item 28c) was already sent in this conversation → the closing goes without it. */
  transitionSent?: boolean;
  /** The customer described an attack / bite → no "מעולה" in the closing (item 29c). */
  serious?: boolean;
  /**
   * What the customer TYPED in this conversation (item 30d): a full_name the model took from a
   * voice-note transcript only is not saved as the lead's name. Unset (simulator / cron) = no check.
   */
  typedTexts?: string[];
}

/** The name (its first word) appears in what the customer typed (item 30d). */
export function nameWasTyped(name: string, typedTexts: string[]): boolean {
  const first = name.trim().split(/\s+/)[0];
  if (!first) return false;
  const esc = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^\\p{L}])${esc}(?![\\p{L}])`, "u");
  return typedTexts.some((t) => re.test(t));
}

/**
 * The conversation's ONE journal line (item 30b): read it, change it, write it back (created on
 * first use). Everything the bot records about a conversation goes through here.
 */
export async function updateConversationLog(
  conv: BotConversationRef,
  leadId: string,
  change: (current: string | null) => string
): Promise<void> {
  const current = conv.summaryCallLogId
    ? await prisma.callLog.findFirst({ where: { id: conv.summaryCallLogId, leadId }, select: { summary: true } })
    : null;
  const text = change(current?.summary ?? null);
  if (current) {
    if (text !== current.summary) await prisma.callLog.updateMany({ where: { id: conv.summaryCallLogId!, leadId }, data: { summary: text.slice(0, 10000) } });
    return;
  }
  const log = await addLeadCallLog(leadId, text);
  conv.summaryCallLogId = log.id;
  await prisma.waBotConversation.update({ where: { id: conv.id }, data: { summaryCallLogId: log.id } });
}

function appUrl(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

const CALLBACK_TASK_PREFIX = "לחזור טלפונית";
const URGENT_TITLE_PREFIX = "דחוף: ";

/** Shabbat / a holiday block in the business calendar right now → the closing says so (no time). */
async function closingWhenNow(businessId: string) {
  const now = new Date();
  const blocks = await prisma.availabilityBlock
    .findMany({ where: { businessId, startAt: { lte: now }, endAt: { gt: now } }, select: { startAt: true, endAt: true, reason: true }, take: 5 })
    .catch(() => []);
  return closingWhen(now, blocks);
}

export function createDbExecutor(conv: BotConversationRef): BotToolExecutor {
  const phone = localPhone(conv.phone);

  async function leadDisplayName(leadId: string): Promise<string> {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId: conv.businessId }, select: { name: true } });
    return lead && !isPlaceholderLeadName(lead.name) ? lead.name : conv.profileName || phone;
  }

  /** The lead's urgent line ("⚠ דחוף: …"): a fact in a conversation log, or an older separate note. */
  async function urgentNote(leadId: string): Promise<string | null> {
    const log = await prisma.callLog.findFirst({
      where: { leadId, OR: [{ summary: { startsWith: URGENT_NOTE_PREFIX } }, { summary: { contains: `\n• ${URGENT_FACT}:` } }] },
      select: { summary: true },
    });
    if (!log) return null;
    return log.summary.startsWith(URGENT_NOTE_PREFIX) ? log.summary.replace(`${BOT_LOG_PREFIX} `, "") : urgentFactOf(log.summary);
  }

  async function ensureLead(fields: Partial<SaveLeadInput> = {}): Promise<string> {
    const attributionLine = conv.attributionSource || conv.attributionPage
      ? `הגעתי דרך: ${[conv.attributionSource, conv.attributionPage].filter(Boolean).join(" · ")}`
      : null;
    // Item 30d: a name heard only in a voice note is not saved; the WhatsApp profile name until one is typed.
    const typedName = fields.full_name && (!conv.typedTexts || nameWasTyped(fields.full_name, conv.typedTexts)) ? fields.full_name : null;
    const { leadId, created } = await upsertLeadFromContact({
      businessId: conv.businessId,
      phone,
      name: typedName,
      placeholderName: conv.profileName?.trim().slice(0, 100) || `וואטסאפ ${phone}`,
      // Item 30c: the latest conversation's name / city / dog replace the lead's (the journal keeps the older ones).
      refresh: true,
      source: BOT_LEAD_SOURCE,
      city: fields.city ? (fields.neighborhood ? `${fields.city} (${fields.neighborhood})` : fields.city) : null,
      requestedService: fields.service,
      pet: fields.dog_name || fields.dog_age || fields.dog_breed || fields.problem || fields.dog_since
        ? {
            name: fields.dog_name,
            age: fields.dog_age,
            breed: fields.dog_breed,
            notes: [fields.problem, fields.dog_since ? `אצלם: ${fields.dog_since}` : null].filter(Boolean).join(" · ") || null,
          }
        : null,
      creationNote: ["נוצר אוטומטית מהבוט בוואטסאפ.", conv.profileName ? `שם בוואטסאפ: ${conv.profileName}` : null, attributionLine]
        .filter(Boolean)
        .join("\n"),
      // Item 30a: "כניסה ישירה" → direct, "חיפוש אורגני" → organic, … (not utm_source → "referral").
      attribution: botLeadAttribution(conv.attributionSource, conv.attributionPage),
      contactedAt: new Date(),
    });
    if (created) {
      // The bot writes the lead through the service layer, so the "ליד חדש נכנס" alert
      // (WhatsApp + email + bell) that POST /api/leads sends has to be sent here.
      await runAfterResponse(
        alertNewLeadIfEnabled(conv.businessId, {
          name: typedName?.trim() || conv.profileName?.trim() || phone,
          phone,
          requestedService: fields.service?.trim() || null,
          city: fields.city?.trim() || null,
          source: BOT_LEAD_SOURCE,
        }),
      );
    }
    if (conv.leadId !== leadId) {
      conv.leadId = leadId;
      await prisma.waBotConversation.update({ where: { id: conv.id }, data: { leadId } });
    }
    return leadId;
  }

  const executor: BotToolExecutor = {
    closing: null,

    async saveLead(input) {
      const leadId = await ensureLead(input);
      if (input.urgent_reason) await executor.markUrgent?.(input.urgent_reason);
      const notes: string[] = [];
      // Item 30b: all of these go into the conversation's one journal line, not separate lines.
      const facts: string[] = [];
      if (input.city && !isKnownServiceCity(input.city)) {
        // Item 28b: a city outside the list → "אזור לבדיקה" for the rep.
        facts.push(areaFact(input.city));
        notes.push(unknownAreaToolNote(input.city, conv.gender ?? "unknown"));
      }
      if (input.other_issues) facts.push(otherIssueFact(input.other_issues)); // item 28c
      if (input.callback_time) facts.push(callbackTimeFact(input.callback_time)); // a time the customer asked for, no commitment
      if (input.summary || facts.length) {
        await updateConversationLog(conv, leadId, (current) => {
          let text = input.summary ? withBody(current, `${BOT_LOG_PREFIX} ${input.summary}`) : current ?? withBody(null, "");
          for (const f of facts) text = withFact(text, f);
          return text;
        });
      }
      return ["נשמר", ...notes].join(". ");
    },

    async scheduleCallback({ note }: ScheduleCallbackInput) {
      // Or, 24/10: no time, no calendar — the lead is flagged "לחזור טלפונית" and a rep gets a task.
      const leadId = await ensureLead();
      const name = await leadDisplayName(leadId);
      await updateConversationLog(conv, leadId, (current) => withFact(current, callbackFact(note)));
      const open = await prisma.task.findFirst({
        where: { businessId: conv.businessId, relatedEntityType: "LEAD", relatedEntityId: leadId, status: { in: ["OPEN", "IN_PROGRESS"] }, title: { contains: CALLBACK_TASK_PREFIX } },
        select: { id: true },
      });
      if (!open) {
        const urgent = await urgentNote(leadId);
        await createLeadTask(conv.businessId, leadId, {
          title: `${urgent ? URGENT_TITLE_PREFIX : ""}${CALLBACK_TASK_PREFIX} ל${name} (וואטסאפ)`,
          description: [
            urgent ? urgent.replace(URGENT_FACT, "דחוף") : null,
            note ? `מה הלקוח מחפש: ${note}` : null,
            `טלפון: ${phone}`,
            "השיחה בוואטסאפ: כרטיס הליד → וואטסאפ עם הבוט.",
          ].filter(Boolean).join("\n"),
          priority: urgent ? "URGENT" : "HIGH",
          dueDate: israelYmd(),
        });
      }
      executor.closing = closingWithTransition(
        callbackClosingText(await closingWhenNow(conv.businessId), conv.gender ?? "unknown", { serious: conv.serious }),
        !!conv.transitionSent
      );
      return `סומן לחזרה טלפונית. כתוב ללקוח בדיוק: "${executor.closing}"`;
    },

    // Or, 24/10 12:58: "דחוף" / "בהקדם" / "השכנים מתלוננים" → the lead is marked urgent, with why.
    async markUrgent(reason: string, quote?: string) {
      const leadId = await ensureLead();
      // Item 30b: a fact in the conversation's journal line, not a separate line.
      if (!(await urgentNote(leadId))) await updateConversationLog(conv, leadId, (current) => withFact(current, urgentFact(reason, quote)));
      // An open callback / handoff task of the bot becomes URGENT too.
      const tasks = await prisma.task.findMany({
        where: {
          businessId: conv.businessId,
          relatedEntityType: "LEAD",
          relatedEntityId: leadId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          title: { contains: CALLBACK_TASK_PREFIX },
        },
        select: { id: true, title: true, priority: true },
      });
      for (const t of tasks) {
        if (t.priority === "URGENT" && t.title.startsWith(URGENT_TITLE_PREFIX)) continue;
        await prisma.task.updateMany({
          where: { id: t.id, businessId: conv.businessId },
          data: { priority: "URGENT", title: t.title.startsWith(URGENT_TITLE_PREFIX) ? t.title : `${URGENT_TITLE_PREFIX}${t.title}` },
        });
      }
    },

    async handoff({ reason, urgency }: HandoffInput) {
      const leadId = await ensureLead();
      const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId: conv.businessId }, select: { name: true } });
      const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : conv.profileName || phone;

      // The rep has no WhatsApp inbox for this number — the task carries the latest messages.
      const recent = await prisma.waBotMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { role: true, text: true },
      });
      const transcript = recent
        .reverse()
        .map((m) => `${m.role === "user" ? "לקוח" : "בוט"}: ${m.text.replace(/\s+/g, " ").slice(0, 300)}`)
        .join("\n");

      await createLeadTask(conv.businessId, leadId, {
        title: `${urgency === "urgent" ? "דחוף: " : ""}להתקשר ל${name} (העברה מהבוט בוואטסאפ)`,
        description: [`סיבה: ${reason}`, `טלפון: ${phone}`, "", "הודעות אחרונות:", transcript].join("\n").slice(0, 4900),
        priority: "URGENT",
      });
      await prisma.waBotConversation.update({
        where: { id: conv.id },
        // Messages so far are in the task above; alerts start from the next customer message.
        data: { status: "handoff", handoffAt: new Date(), handoffNotifiedAt: new Date(), handoffAckAt: null },
      });

      if (await claimOnce(`alldog-bot-handoff:${conv.id}`, 60 * 60)) {
        const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
        await notifyOwnerAllDog({
          title: urgency === "urgent" ? "בוט וואטסאפ: העברה דחופה לנציג" : "בוט וואטסאפ: העברה לנציג",
          lines: [`${name} · ${maskPhone(phone)}`, `סיבה: ${reason}`],
          url: `${appUrl()}/leads?lead=${leadId}`,
        });
      }
      const closing = handoffClosingText(await closingWhenNow(conv.businessId), conv.gender ?? "unknown", { serious: conv.serious || urgency === "urgent" });
      // An urgent (safety) handoff goes straight to the closing; a normal one explains what happens next (28c).
      executor.closing = urgency === "urgent" ? closing : closingWithTransition(closing, !!conv.transitionSent);
      return `הועבר. כתוב ללקוח בדיוק: "${executor.closing}" ואל תשאל עוד שאלות`;
    },
  };
  return executor;
}

/** A task so a person sees a voice note / photo the bot cannot read (once an hour per conversation). */
export async function flagMediaForHuman(conv: BotConversationRef, label: string): Promise<void> {
  if (!(await claimOnce(`alldog-bot-media:${conv.id}`, 60 * 60))) return;
  const executor = createDbExecutor(conv);
  await executor.saveLead({});
  if (!conv.leadId) return;
  await createLeadTask(conv.businessId, conv.leadId, {
    title: `${label} מלקוח בוואטסאפ (${localPhone(conv.phone)})`,
    description: `הלקוח שלח ${label} למספר הבוט. הבוט קורא רק טקסט — כדאי להתקשר אליו.`,
    priority: "HIGH",
  });
}

/**
 * The conversation still points at a lead / summary log that no longer exists (deleted by hand in
 * Petra — Or deleted "רחלי" at 15:04 on 24/10) → drop the link; the next write resolves the lead
 * again by phone (resolveLeadForContact) and opens a new summary log.
 */
export async function dropDeletedLeadLink(ref: BotConversationRef): Promise<void> {
  if (!ref.leadId) return;
  const exists = await prisma.lead.findFirst({ where: { id: ref.leadId, businessId: ref.businessId }, select: { id: true } });
  if (exists) return;
  ref.leadId = null;
  ref.summaryCallLogId = null;
  await prisma.waBotConversation.update({ where: { id: ref.id }, data: { leadId: null, summaryCallLogId: null } });
}
