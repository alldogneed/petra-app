/**
 * AllDog WhatsApp bot — the rep's side, from the lead card in Petra.
 *   getBotConversationForLead()  → the conversation + last messages (null = no bot chat / not AllDog)
 *   sendRepMessage()             → free text through the bot number (24h window), stored as role "human";
 *                                  the conversation is (or stays) in handoff, auto-resume counts from now
 *   resumeBot()                  → "החזר לבוט": handoff → active
 * AllDog only (ALLDOG_BUSINESS_ID + ALLDOG_WA_BOT_ENABLED); every query is scoped by businessId.
 */
import prisma from "@/lib/prisma";
import { allDogBusinessId, isWaBotEnabled } from "@/lib/alldog/config";
import { addLeadCallLog } from "@/lib/alldog/leads";
import { isWithin24hWindow } from "@/lib/alldog-bot/logic";
import { autoResumeAt, localIsraeliPhone } from "@/lib/alldog-bot/handoff";
import { sendText } from "@/lib/alldog-bot/wa";
import { ServiceError } from "@/services/types";

export const REP_MESSAGE_MAX = 2000;

export function isBotInboxBusiness(businessId: string): boolean {
  return isWaBotEnabled() && allDogBusinessId() === businessId;
}

async function findConversation(businessId: string, leadId: string) {
  if (!isBotInboxBusiness(businessId)) return null;
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, phone: true } });
  if (!lead) return null;
  const byLead = await prisma.waBotConversation.findFirst({ where: { businessId, leadId }, orderBy: { lastInboundAt: "desc" } });
  if (byLead) return byLead;
  // Conversation that never got linked (e.g. after #reset): match on the phone.
  const local = lead.phone ? localIsraeliPhone(lead.phone) : "";
  if (!/^0\d{8,9}$/.test(local)) return null;
  return prisma.waBotConversation.findFirst({ where: { businessId, phone: `972${local.slice(1)}` } });
}

export interface BotConversationView {
  id: string;
  status: string;
  canReply: boolean;
  lastInboundAt: string | null;
  autoResumeAt: string | null;
  messages: Array<{ id: string; role: string; kind: string; text: string; createdAt: string }>;
}

export async function getBotConversationForLead(businessId: string, leadId: string): Promise<BotConversationView | null> {
  const conv = await findConversation(businessId, leadId);
  if (!conv) return null;
  const rows = await prisma.waBotMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 60,
    select: { id: true, role: true, kind: true, text: true, createdAt: true },
  });
  const resume = autoResumeAt(conv);
  return {
    id: conv.id,
    status: conv.status,
    canReply: isWithin24hWindow(conv.lastInboundAt),
    lastInboundAt: conv.lastInboundAt?.toISOString() ?? null,
    autoResumeAt: resume && resume.getTime() > 0 ? resume.toISOString() : null,
    messages: rows.reverse().map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

export async function sendRepMessage(businessId: string, leadId: string, rawText: string): Promise<void> {
  const text = rawText.replace(/\r/g, "").trim();
  if (!text) throw new ServiceError("ההודעה ריקה", "VALIDATION");
  if (text.length > REP_MESSAGE_MAX) throw new ServiceError(`ההודעה ארוכה מדי (עד ${REP_MESSAGE_MAX} תווים)`, "VALIDATION");
  const conv = await findConversation(businessId, leadId);
  if (!conv) throw new ServiceError("אין שיחת וואטסאפ עם הבוט לליד הזה", "NOT_FOUND");
  if (conv.status === "stopped") throw new ServiceError("הלקוח ביקש להפסיק לקבל הודעות", "CONFLICT");
  if (!isWithin24hWindow(conv.lastInboundAt)) {
    throw new ServiceError("עברו 24 שעות מההודעה האחרונה של הלקוח — וואטסאפ לא מאפשר לשלוח טקסט חופשי. אפשר להתקשר.", "CONFLICT");
  }
  const wamid = await sendText(conv.phone, text);
  if (!wamid) throw new ServiceError("השליחה בוואטסאפ נכשלה", "EXTERNAL");
  const now = new Date();
  await prisma.waBotMessage.create({ data: { conversationId: conv.id, role: "human", text, waMessageId: wamid } });
  // A rep is talking now: the bot stays quiet; the 24h auto-resume counts from this reply.
  await prisma.waBotConversation.update({
    where: { id: conv.id },
    data: {
      lastHumanAt: now,
      ...(conv.status === "active" ? { status: "handoff", handoffAt: now, handoffNotifiedAt: now, handoffAckAt: null } : {}),
    },
  });
  if (conv.leadId) await addLeadCallLog(conv.leadId, `[וואטסאפ · נציגה] ${text}`).catch(() => {});
}

export async function resumeBot(businessId: string, leadId: string): Promise<void> {
  const conv = await findConversation(businessId, leadId);
  if (!conv) throw new ServiceError("אין שיחת וואטסאפ עם הבוט לליד הזה", "NOT_FOUND");
  if (conv.status !== "handoff") throw new ServiceError("השיחה לא אצל נציגה", "CONFLICT");
  await prisma.waBotConversation.updateMany({
    where: { id: conv.id, businessId, status: "handoff" },
    data: { status: "active", resumedAt: new Date() },
  });
  if (conv.leadId) await addLeadCallLog(conv.leadId, "[וואטסאפ · בוט] הוחזר לבוט מכרטיס הליד").catch(() => {});
}
