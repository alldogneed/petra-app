/**
 * AllDog WhatsApp bot — the real tool executor. Every lead / task / follow-up write
 * goes through src/lib/alldog/leads.ts → the existing lead services.
 */
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { maskPhone } from "@/lib/whatsapp-failure";
import { normalizeAttributionInput } from "@/lib/lead-attribution";
import {
  addLeadCallLog,
  createLeadTask,
  isPlaceholderLeadName,
  localPhone,
  upsertLeadFromContact,
} from "@/lib/alldog/leads";
import { israelYmd } from "@/lib/alldog/time";
import { URGENT_NOTE_PREFIX } from "@/lib/alldog-bot/logic";
import type { Gender } from "@/lib/alldog-bot/address";
import { callbackClosingText, closingWhen, handoffClosingText } from "@/lib/alldog-bot/handoff";
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

  /** The lead's urgent note ("[וואטסאפ · בוט] ⚠ דחוף: …"), if one was written. */
  async function urgentNote(leadId: string): Promise<string | null> {
    const log = await prisma.callLog.findFirst({
      where: { leadId, summary: { startsWith: URGENT_NOTE_PREFIX } },
      select: { summary: true },
    });
    return log?.summary ?? null;
  }

  async function ensureLead(fields: Partial<SaveLeadInput> = {}): Promise<string> {
    const attributionLine = conv.attributionSource || conv.attributionPage
      ? `הגעתי דרך: ${[conv.attributionSource, conv.attributionPage].filter(Boolean).join(" · ")}`
      : null;
    const { leadId } = await upsertLeadFromContact({
      businessId: conv.businessId,
      phone,
      name: fields.full_name ?? null,
      placeholderName: `וואטסאפ ${phone}`,
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
      attribution: conv.attributionPage || conv.attributionSource
        ? normalizeAttributionInput({ landing_page: conv.attributionPage ?? undefined, utm_source: conv.attributionSource ?? undefined })
        : null,
      contactedAt: new Date(),
    });
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
      if (input.callback_time) {
        // The customer asked for a time himself — kept as a note for the rep, never a commitment.
        await addLeadCallLog(leadId, `[וואטסאפ · בוט] הלקוח ביקש לגבי זמן השיחה: ${input.callback_time}`);
      }
      if (input.summary) {
        const text = `[וואטסאפ · בוט] ${input.summary}`;
        const updated = conv.summaryCallLogId
          ? await prisma.callLog.updateMany({ where: { id: conv.summaryCallLogId, leadId }, data: { summary: text } })
          : { count: 0 };
        if (updated.count === 0) {
          const log = await addLeadCallLog(leadId, text);
          conv.summaryCallLogId = log.id;
          await prisma.waBotConversation.update({ where: { id: conv.id }, data: { summaryCallLogId: log.id } });
        }
      }
      return "נשמר";
    },

    async scheduleCallback({ note }: ScheduleCallbackInput) {
      // Or, 24/10: no time, no calendar — the lead is flagged "לחזור טלפונית" and a rep gets a task.
      const leadId = await ensureLead();
      const name = await leadDisplayName(leadId);
      await addLeadCallLog(leadId, `[וואטסאפ · בוט] לחזור טלפונית${note ? ` · ${note}` : ""}`);
      const open = await prisma.task.findFirst({
        where: { businessId: conv.businessId, relatedEntityType: "LEAD", relatedEntityId: leadId, status: { in: ["OPEN", "IN_PROGRESS"] }, title: { contains: CALLBACK_TASK_PREFIX } },
        select: { id: true },
      });
      if (!open) {
        const urgent = await urgentNote(leadId);
        await createLeadTask(conv.businessId, leadId, {
          title: `${urgent ? URGENT_TITLE_PREFIX : ""}${CALLBACK_TASK_PREFIX} ל${name} (וואטסאפ)`,
          description: [
            urgent ? urgent.replace(URGENT_NOTE_PREFIX, "דחוף") : null,
            note ? `מה הלקוח מחפש: ${note}` : null,
            `טלפון: ${phone}`,
            "השיחה בוואטסאפ: כרטיס הליד → וואטסאפ עם הבוט.",
          ].filter(Boolean).join("\n"),
          priority: urgent ? "URGENT" : "HIGH",
          dueDate: israelYmd(),
        });
      }
      executor.closing = callbackClosingText(await closingWhenNow(conv.businessId), conv.gender ?? "unknown");
      return `סומן לחזרה טלפונית. כתוב ללקוח בדיוק: "${executor.closing}"`;
    },

    // Or, 24/10 12:58: "דחוף" / "בהקדם" / "השכנים מתלוננים" → the lead is marked urgent, with why.
    async markUrgent(reason: string, quote?: string) {
      const leadId = await ensureLead();
      if (!(await urgentNote(leadId))) {
        const q = quote ? ` · "${quote.replace(/\s+/g, " ").trim().slice(0, 200)}"` : "";
        await addLeadCallLog(leadId, `${URGENT_NOTE_PREFIX}: ${reason}${q}`);
      }
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
      executor.closing = handoffClosingText(await closingWhenNow(conv.businessId), conv.gender ?? "unknown");
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
