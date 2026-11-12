/**
 * AllDog voice agent — what follows a booked sales call. Runs AFTER the response (the meeting is
 * already saved); every part is independent and never fails the booking:
 *   1. the LeadMeeting WhatsApp reminder — the same refreshReminder as createLeadMeeting
 *      (sales call → 2 hours before, petra_sales_call_reminder first, templates only);
 *   2. the confirmation to the customer — Petra platform number, templates only, logged once per meeting;
 *   3. a bell notification to the sales rep (ALLDOG_SALES_REP_USER_ID, active member only);
 *   4. the event in the rep's Google Calendar (calendar.ts — daily alert to Or on failure).
 */
import prisma from "@/lib/prisma";
import { refreshReminder } from "@/services/lead-meetings";
import { sendWithTemplateChain } from "@/lib/whatsapp-template-chain";
import { toWhatsAppPhone } from "@/lib/utils";
import { voiceAgentSettings } from "@/lib/alldog/config";
import { spokenSlotLabel } from "@/lib/alldog/voice-agent/slots";
import { syncSalesCallToRepCalendar } from "@/lib/alldog/voice-agent/calendar";
import {
  SALES_CALL_CONFIRMATION_ENTITY,
  SALES_CALL_CONFIRMATION_FLOW,
  salesCallConfirmationMessage,
} from "@/lib/alldog/voice-agent/messages";

export interface BookedSalesCall {
  businessId: string;
  meetingId: string;
  leadId: string;
  leadName: string;
  /** Display name for the rep (the phone when the lead has only a placeholder name). */
  displayName: string;
  phone: string; // "0XXXXXXXXX"
  ymd: string;
  hhmm: string;
  problem: string | null;
}

/** Confirmation once per meeting (a log row = already sent / attempted). Templates only — never free text. */
export async function sendSalesCallConfirmation(b: BookedSalesCall, now: Date = new Date()): Promise<void> {
  const already = await prisma.scheduledMessage.findFirst({
    where: { businessId: b.businessId, relatedEntityType: SALES_CALL_CONFIRMATION_ENTITY, relatedEntityId: b.meetingId },
    select: { id: true },
  });
  if (already) return;
  const to = toWhatsAppPhone(b.phone);
  if (!to) return;
  const m = salesCallConfirmationMessage(b.ymd, b.hhmm, b.leadName, now);
  const result = await sendWithTemplateChain({
    to,
    steps: m.templateChain,
    fallbackBody: m.body,
    businessId: b.businessId,
    context: SALES_CALL_CONFIRMATION_FLOW,
    templateOnly: true,
  }).catch((err) => {
    console.error("[alldog-voice confirmation] send threw", err);
    return null;
  });
  const sentStep = result?.success && result.via === "template" ? m.templateChain.filter((s) => s.name === result.templateName) : m.templateChain;
  await prisma.scheduledMessage.create({
    data: {
      businessId: b.businessId,
      customerId: null,
      channel: "whatsapp",
      templateKey: "sales_call_confirmation_log",
      payloadJson: JSON.stringify({ flow: SALES_CALL_CONFIRMATION_FLOW, to, templateChain: sentStep, body: m.body, templateOnly: true }),
      sendAt: now,
      status: result?.success ? "SENT" : "FAILED",
      ...(result?.success && result.messageSid ? { wamid: result.messageSid } : {}),
      relatedEntityType: SALES_CALL_CONFIRMATION_ENTITY,
      relatedEntityId: b.meetingId,
    },
  });
  if (!result?.success) {
    console.error(`[alldog-voice confirmation] meeting ${b.meetingId} not sent — ${result?.error ?? "send threw"}`);
  }
}

/** Bell to the sales rep — only when configured and an active member of this business. */
export async function notifySalesRep(b: BookedSalesCall, now: Date = new Date()): Promise<void> {
  const { salesRepUserId } = voiceAgentSettings();
  if (!salesRepUserId) return;
  const member = await prisma.businessUser.findFirst({
    where: { businessId: b.businessId, userId: salesRepUserId, isActive: true },
    select: { id: true },
  });
  if (!member) {
    console.warn("[alldog-voice] ALLDOG_SALES_REP_USER_ID is not an active member of the business — no bell");
    return;
  }
  await prisma.notification.create({
    data: {
      userId: salesRepUserId,
      title: `שיחת מכירה חדשה: ${b.displayName} · ${spokenSlotLabel(b.ymd, b.hhmm, now)}`,
      message: [`טלפון: ${b.phone}`, b.problem ? `הבעיה: ${b.problem}` : null, "נקבעה ע\"י אלירן (סוכן קולי)"].filter(Boolean).join(" · "),
      actionUrl: `/leads?lead=${b.leadId}`,
    },
  });
}

/** All four, each on its own (one failing never stops the others). */
export async function afterSalesCallBooked(b: BookedSalesCall): Promise<void> {
  const results = await Promise.allSettled([
    refreshReminder(prisma, b.businessId, b.meetingId),
    sendSalesCallConfirmation(b),
    notifySalesRep(b),
    syncSalesCallToRepCalendar(b.businessId, b.meetingId),
  ]);
  const labels = ["reminder", "confirmation", "rep bell", "calendar"];
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[alldog-voice after-booking] ${labels[i]} failed`, r.reason);
  });
}
