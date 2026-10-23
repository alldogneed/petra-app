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
  setLeadFollowUp,
  upsertLeadFromContact,
} from "@/lib/alldog/leads";
import { addDaysYmd, heDayLabel, isValidYmd, isWithinOfficeHours, israelInstant, israelYmd } from "@/lib/alldog/time";
import { ToolError, type BotToolExecutor, type HandoffInput, type SaveLeadInput, type ScheduleCallbackInput } from "@/lib/alldog-bot/agent";

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
}

function appUrl(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

export function createDbExecutor(conv: BotConversationRef): BotToolExecutor {
  const phone = localPhone(conv.phone);

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
      city: fields.city,
      requestedService: fields.service,
      pet: fields.dog_name || fields.dog_age || fields.dog_breed || fields.problem
        ? { name: fields.dog_name, age: fields.dog_age, breed: fields.dog_breed, notes: fields.problem }
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

  return {
    async saveLead(input) {
      const leadId = await ensureLead(input);
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

    async scheduleCallback({ date, time }: ScheduleCallbackInput) {
      if (!isValidYmd(date)) throw new ToolError("תאריך לא תקין");
      if (!isWithinOfficeHours(date, time)) {
        throw new ToolError("מחוץ לשעות הפעילות (א׳–ה׳ 09:00–17:00, ו׳ 09:00–14:00). הצע זמן אחר מהרשימה");
      }
      const at = israelInstant(date, time);
      if (at.getTime() < Date.now() + 15 * 60 * 1000) throw new ToolError("המועד כבר עבר או קרוב מדי. הצע זמן אחר מהרשימה");
      if (date > addDaysYmd(israelYmd(), 30)) throw new ToolError("רחוק מדי, עד 30 יום קדימה");
      const leadId = await ensureLead();
      await setLeadFollowUp(conv.businessId, leadId, at);
      return `נקבע: ${heDayLabel(date)} ב-${time}`;
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
        data: { status: "handoff", handoffAt: new Date() },
      });

      if (await claimOnce(`alldog-bot-handoff:${conv.id}`, 60 * 60)) {
        const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
        await notifyOwnerAllDog({
          title: urgency === "urgent" ? "בוט וואטסאפ: העברה דחופה לנציג" : "בוט וואטסאפ: העברה לנציג",
          lines: [`${name} · ${maskPhone(phone)}`, `סיבה: ${reason}`],
          url: `${appUrl()}/leads?lead=${leadId}`,
        });
      }
      return "הועבר לנציג. כתוב הודעה אחת קצרה שנציגה תחזור אליו בהקדם, ואל תשאל עוד שאלות";
    },
  };
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
