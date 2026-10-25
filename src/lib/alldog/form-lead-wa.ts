/**
 * AllDog item 34 — the bot opens WhatsApp with a lead who left details in a website form.
 *
 *   POST /api/webhooks/lead (AllDog, source "אתר · …", new lead) → scheduleFormLeadWhatsApp()
 *     → queue row (WaBotMessage role "system", kind form_lead_pending, sendAt = lead + 3–5 min)
 *   /api/cron/alldog-form-wa (pg_cron every minute) → processDueFormLeadMessages()
 *     → re-check (customer wrote / answered call / missed-call message / lead closed …)
 *     → template by the time NOW (open / closed + nextCallbackPhrase) → the bot's copy + lead note.
 * Never sleeps inside a request, never throws, never retries a failed send (item 31 alert).
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { maskPhone } from "@/lib/whatsapp-failure";
import { allDogBusinessId } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";
import { addLeadCallLog, findLeadsByPhone } from "@/lib/alldog/leads";
import { israeliMobile, MISSED_CALL_KINDS, answeredSince, toWaId } from "@/lib/alldog/missed-call-rules";
import { callbackPhraseFor, callbackSlot } from "@/lib/alldog/time";
import {
  conversationSkipReasonForForm,
  firstNameOf,
  FORM_LEAD_DEDUP_MS,
  FORM_LEAD_KINDS,
  FORM_LEAD_LANGUAGE,
  FORM_LEAD_MESSAGE_KIND,
  FORM_LEAD_SKIP_LABELS,
  formLeadSteps,
  formLeadSendAt,
  formWaActivatedAt,
  isAnsweredCallLog,
  isFormWaEnabled,
  scheduleSkipReason,
  type FormLeadSkipReason,
} from "@/lib/alldog/form-lead-rules";

const LOG = "[alldog-form-wa]";

interface FormPayload {
  leadId: string;
  sendAt: string;
  leadCreatedAt: string;
  mobile: string;
  firstName: string;
  reason?: string;
  template?: string;
  phrase?: string;
}

export interface FormLeadInput {
  businessId: string;
  leadId: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  createdAt: Date;
}

function botConfigured(): boolean {
  return !!readEnv("ALLDOG_WA_TOKEN") && !!readEnv("ALLDOG_WA_PHONE_NUMBER_ID");
}

/** The last automatic message of a kind to this conversation (any status that means "sent / about to be"). */
async function lastAutoMessageAt(conversationId: string, kinds: string[], exceptId?: string): Promise<Date | null> {
  const row = await prisma.waBotMessage.findFirst({
    where: {
      conversationId,
      role: "system",
      kind: { in: kinds },
      createdAt: { gte: new Date(Date.now() - FORM_LEAD_DEDUP_MS) },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

const MISSED_SENT_KINDS = [MISSED_CALL_KINDS.sent, MISSED_CALL_KINDS.sending];
const FORM_ACTIVE_KINDS = [FORM_LEAD_KINDS.sent, FORM_LEAD_KINDS.sending, FORM_LEAD_KINDS.pending];

function skipped(reason: FormLeadSkipReason | string, leadId: string, phone?: string) {
  const label = FORM_LEAD_SKIP_LABELS[reason as FormLeadSkipReason] ?? reason;
  console.log(`${LOG} lead ${leadId}${phone ? ` (${maskPhone(phone)})` : ""}: skipped (${reason} – ${label})`);
  return { status: "skipped" as const, reason };
}

/** Called from the lead webhook right after a lead is created. Queues the message; never throws. */
export async function scheduleFormLeadWhatsApp(
  input: FormLeadInput
): Promise<{ status: "scheduled" | "skipped" | "failed"; reason?: string; sendAt?: string }> {
  try {
    const businessId = allDogBusinessId();
    if (!businessId || input.businessId !== businessId) return { status: "skipped", reason: "not_alldog" };
    const now = new Date();
    const basic = scheduleSkipReason({
      enabled: isFormWaEnabled() && botConfigured(),
      activatedAt: formWaActivatedAt(),
      source: input.source,
      leadCreatedAt: input.createdAt,
      now,
    });
    if (basic) return basic === "disabled" || basic === "not_form" ? { status: "skipped", reason: basic } : skipped(basic, input.leadId);
    const mobile = israeliMobile(input.phone);
    if (!mobile) return skipped("not_mobile", input.leadId);
    const phone = toWaId(mobile);
    const firstName = firstNameOf(input.name);
    if (!firstName) return skipped("no_name", input.leadId, phone);

    // Only a NEW contact: not an existing customer, no earlier lead with this phone.
    const { findCustomersByPhone } = await import("@/services/clients");
    if ((await findCustomersByPhone(businessId, prisma, mobile)).length) return skipped("existing_customer", input.leadId, phone);
    const others = (await findLeadsByPhone(businessId, mobile)).filter((l) => l.id !== input.leadId);
    if (others.length) return skipped("returning_contact", input.leadId, phone);

    const existing = await prisma.waBotConversation.findUnique({
      where: { businessId_phone: { businessId, phone } },
      select: { id: true, status: true, lastInboundAt: true },
    });
    const convSkip = conversationSkipReasonForForm({
      conv: existing,
      leadCreatedAt: input.createdAt,
      lastMissedCallAt: existing ? await lastAutoMessageAt(existing.id, MISSED_SENT_KINDS) : null,
      lastFormLeadAt: existing ? await lastAutoMessageAt(existing.id, FORM_ACTIVE_KINDS) : null,
      now,
    });
    if (convSkip) return skipped(convSkip, input.leadId, phone);

    const conv = await prisma.waBotConversation.upsert({
      where: { businessId_phone: { businessId, phone } },
      create: { businessId, phone, leadId: input.leadId },
      update: { leadId: input.leadId },
      select: { id: true },
    });
    const sendAt = formLeadSendAt(input.createdAt);
    const payload: FormPayload = {
      leadId: input.leadId,
      sendAt: sendAt.toISOString(),
      leadCreatedAt: input.createdAt.toISOString(),
      mobile,
      firstName,
    };
    try {
      await prisma.waBotMessage.create({
        data: { conversationId: conv.id, role: "system", kind: FORM_LEAD_KINDS.pending, text: JSON.stringify(payload), waMessageId: `form-lead:${input.leadId}` },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { status: "skipped", reason: "already_scheduled" };
      throw err;
    }
    console.log(`${LOG} lead ${input.leadId} (${maskPhone(phone)}): scheduled for ${payload.sendAt}`);
    return { status: "scheduled", sendAt: payload.sendAt };
  } catch (err) {
    console.error(`${LOG} schedule failed:`, err instanceof Error ? err.message : err);
    return { status: "failed", reason: "error" };
  }
}

/** Send one due row (claimed first). Everything is checked again right before sending. */
export async function sendFormLeadMessage(rowId: string, now: Date = new Date()): Promise<{ status: "sent" | "skipped" | "failed"; reason?: string }> {
  const claimed = await prisma.waBotMessage.updateMany({
    where: { id: rowId, kind: FORM_LEAD_KINDS.pending },
    data: { kind: FORM_LEAD_KINDS.sending },
  });
  if (claimed.count === 0) return { status: "skipped", reason: "already_handled" };
  const row = await prisma.waBotMessage.findUnique({
    where: { id: rowId },
    select: { id: true, text: true, conversation: { select: { id: true, businessId: true, phone: true, status: true, lastInboundAt: true } } },
  });
  if (!row) return { status: "skipped", reason: "gone" };
  const payload = JSON.parse(row.text) as FormPayload;
  const conv = row.conversation;
  const finish = async (kind: string, extra: Partial<FormPayload> = {}) => {
    await prisma.waBotMessage.update({ where: { id: row.id }, data: { kind, text: JSON.stringify({ ...payload, ...extra }) } });
  };
  const cancel = async (reason: FormLeadSkipReason) => {
    await finish(FORM_LEAD_KINDS.skipped, { reason });
    skipped(reason, payload.leadId, conv.phone);
    return { status: "skipped" as const, reason };
  };

  try {
    const leadCreatedAt = new Date(payload.leadCreatedAt);
    // The switch / activation time may have changed since the row was queued.
    const activatedAt = formWaActivatedAt();
    if (!isFormWaEnabled() || !botConfigured()) return await cancel("disabled");
    if (!activatedAt) return await cancel("not_activated");
    if (leadCreatedAt < activatedAt) return await cancel("before_activation");

    const lead = await prisma.lead.findFirst({
      where: { id: payload.leadId, businessId: conv.businessId },
      select: { id: true, stage: true, callLogs: { where: { createdAt: { gte: leadCreatedAt } }, select: { type: true, summary: true } } },
    });
    if (!lead) return await cancel("lead_gone");
    const stage = await prisma.leadStage.findUnique({ where: { id: lead.stage }, select: { isWon: true, isLost: true } }).catch(() => null);
    if (stage?.isWon || stage?.isLost) return await cancel("lead_closed");
    if (lead.callLogs.some(isAnsweredCallLog)) return await cancel("answered_call");

    const convSkip = conversationSkipReasonForForm({
      conv,
      leadCreatedAt,
      lastMissedCallAt: await lastAutoMessageAt(conv.id, MISSED_SENT_KINDS),
      lastFormLeadAt: await lastAutoMessageAt(conv.id, [FORM_LEAD_KINDS.sent, FORM_LEAD_KINDS.sending], row.id),
      now,
    });
    if (convSkip) return await cancel(convSkip);

    // An answered PayCall call from this phone since the lead (the rep already called / was called).
    try {
      const { getCalls } = await import("@/lib/paycall");
      const calls = await getCalls({ fromDate: new Date(leadCreatedAt.getTime() - 24 * 60 * 60 * 1000), toDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), limit: 200 });
      if (answeredSince(calls, payload.mobile, leadCreatedAt)) return await cancel("answered_call");
    } catch (err) {
      console.warn(`${LOG} answered-call check failed (sending anyway):`, err instanceof Error ? err.message : err);
    }

    // Template by the callback slot at the ACTUAL send time (a 16:58 lead sent at 17:02 = after hours);
    // a template Meta has not approved yet falls back to the open one (logged, not a failure).
    const slot = callbackSlot(now);
    const phrase = callbackPhraseFor(slot);
    const { sendTemplateSteps } = await import("@/lib/alldog-bot/wa");
    const sent = await sendTemplateSteps(conv.phone, formLeadSteps(payload.firstName, slot), FORM_LEAD_LANGUAGE);
    if (!sent) {
      await finish(FORM_LEAD_KINDS.failed, { reason: "send_failed", phrase }); // alerted inside; no retry
      return { status: "failed", reason: "send_failed" };
    }
    const tpl = sent.step.name;
    await prisma.waBotMessage.create({
      data: { conversationId: conv.id, role: "assistant", kind: FORM_LEAD_MESSAGE_KIND, text: sent.step.text, waMessageId: sent.wamid },
    });
    await finish(FORM_LEAD_KINDS.sent, { template: tpl, phrase, ...(sent.fellBackFrom.length ? { reason: `fallback from ${sent.fellBackFrom.join(",")}` } : {}) });
    await addLeadCallLog(
      payload.leadId,
      `[וואטסאפ · אוטומטי] נשלחה הודעת וואטסאפ אוטומטית · מקור: השאיר פרטים באתר · תבנית ${tpl}`
    ).catch(() => {});
    console.log(`${LOG} lead ${payload.leadId} (${maskPhone(conv.phone)}): sent ${tpl} (slot ${slot.kind})`);
    return { status: "sent" };
  } catch (err) {
    await finish(FORM_LEAD_KINDS.failed, { reason: "error" }).catch(() => {});
    const { alertAllDogFailure } = await import("@/lib/alldog/failure-alerts");
    await alertAllDogFailure({ kind: "wa_send", error: err, detail: `וואטסאפ אוטומטי לליד מהאתר (${payload.leadId})`, phone: conv.phone, leadId: payload.leadId });
    return { status: "failed", reason: "error" };
  }
}

/** Cron (every minute): send the rows whose time came. */
export async function processDueFormLeadMessages(opts: { limit: number } = { limit: 20 }): Promise<{ due: number; sent: number; skipped: number; failed: number }> {
  const rows = await prisma.waBotMessage.findMany({
    where: { role: "system", kind: FORM_LEAD_KINDS.pending },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, text: true },
  });
  const now = Date.now();
  const due = rows
    .filter((r) => {
      try {
        return Date.parse((JSON.parse(r.text) as FormPayload).sendAt) <= now;
      } catch {
        return false;
      }
    })
    .slice(0, opts.limit);
  const out = { due: due.length, sent: 0, skipped: 0, failed: 0 };
  for (const r of due) {
    const res = await sendFormLeadMessage(r.id);
    out[res.status]++;
  }
  return out;
}
