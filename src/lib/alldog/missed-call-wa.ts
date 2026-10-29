/**
 * AllDog — automatic WhatsApp after a missed call to 03-3818670 (Or, item 32).
 *
 *   PayCall webhook (missed call, END) → scheduleMissedCallWhatsApp()
 *     rules (missed-call-rules.ts): flag ALLDOG_MISSED_CALL_WA_ENABLED, office line, Israeli mobile,
 *     not Or's numbers (test mode aside), no active / stopped bot conversation, nothing sent in 7 days
 *     → a "missed_call_pending" row (WaBotMessage, role "system") in the phone's WaBotConversation,
 *       send time = now, or 08:00 / after Shabbat (quiet 22:00–08:00, Fri 14:00 – Sat 20:00).
 *   Due rows are sent at once or by /api/cron/alldog-call-retry (every 5 min): the rules are checked
 *   again (+ an answered call from the same phone in the last hour) → template missed_call_followup
 *   from the bot number → the bot's copy of the message + a lead note. A failed send → alert (item 31),
 *   never retried. When the customer answers, the bot goes on without the forced opening.
 * No DDL: the queue lives in WaBotMessage (kind = missed_call_*, waMessageId = "missed-call:<call id>").
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { maskPhone } from "@/lib/whatsapp-failure";
import { holidayBlocks } from "@/lib/alldog/holidays";
import { allDogBusinessId } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";
import { addLeadCallLog } from "@/lib/alldog/leads";
import {
  ANSWERED_RECENTLY_MS,
  answeredSince,
  basicSkipReason,
  callTimeSkipReason,
  missedCallActivatedAt,
  conversationSkipReason,
  israeliMobile,
  MISSED_CALL_DEDUP_MS,
  MISSED_CALL_KINDS,
  MISSED_CALL_MESSAGE_KIND,
  missedCallSteps,
  MISSED_CALL_TEMPLATE,
  quietDeferral,
  templateSlotFor,
  paycallStart,
  SKIP_REASON_LABELS,
  toWaId,
  type SkipReason,
} from "@/lib/alldog/missed-call-rules";

const LOG = "[alldog-missed-call-wa]";

interface PendingPayload {
  callId: string;
  sendAt: string;
  leadId: string | null;
  mobile: string;
  startedAt: string | null;
  reason?: string;
}

export interface MissedCallInput {
  ID: string;
  START: string;
  CALLERID: string;
  PR_NUMBER: string;
}

/** The PayCall business must be AllDog's, and the bot number must be configured. */
function configured(): string | null {
  const businessId = allDogBusinessId();
  if (!businessId || readEnv("PAYCALL_BUSINESS_ID") !== businessId) return null;
  if (!readEnv("ALLDOG_WA_TOKEN") || !readEnv("ALLDOG_WA_PHONE_NUMBER_ID")) return null;
  return businessId;
}

async function lastMissedCallMessageAt(conversationId: string, exceptId?: string): Promise<Date | null> {
  const row = await prisma.waBotMessage.findFirst({
    where: {
      conversationId,
      role: "system",
      kind: { in: [MISSED_CALL_KINDS.sent, MISSED_CALL_KINDS.pending, MISSED_CALL_KINDS.sending] },
      createdAt: { gte: new Date(Date.now() - MISSED_CALL_DEDUP_MS) },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/** Item 34: one automatic message per phone per 24 h — a website-form message counts too. */
async function formLeadMessageSince(conversationId: string, now: Date): Promise<boolean> {
  const row = await prisma.waBotMessage.findFirst({
    where: {
      conversationId,
      role: "system",
      kind: { in: ["form_lead_sent", "form_lead_sending"] },
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  return !!row;
}

/** Called after the missed call was logged (lead / customer). Never throws. */
export async function scheduleMissedCallWhatsApp(
  call: MissedCallInput,
  ref: { leadId: string | null }
): Promise<{ status: "scheduled" | "sent" | "skipped" | "failed" | "deferred"; reason?: SkipReason | string }> {
  try {
    const businessId = configured();
    if (!businessId) return { status: "skipped", reason: "disabled" };
    const basic = basicSkipReason({ prNumber: call.PR_NUMBER, callerId: call.CALLERID });
    if (basic) {
      if (basic !== "disabled") console.log(`${LOG} call ${call.ID}: skipped (${basic})`);
      return { status: "skipped", reason: basic };
    }
    const now = new Date();
    // Or: only calls that started after the activation time, and only fresh ones — no backfill.
    const timeSkip = callTimeSkipReason(paycallStart(call.START), missedCallActivatedAt(), now);
    if (timeSkip) {
      console.log(`${LOG} call ${call.ID}: skipped (${timeSkip})`);
      return { status: "skipped", reason: timeSkip };
    }
    const mobile = israeliMobile(call.CALLERID)!;
    const phone = toWaId(mobile);

    const existing = await prisma.waBotConversation.findUnique({
      where: { businessId_phone: { businessId, phone } },
      select: { id: true, status: true, lastInboundAt: true },
    });
    const convSkip =
      conversationSkipReason(existing, existing ? await lastMissedCallMessageAt(existing.id) : null, now) ??
      (existing && (await formLeadMessageSince(existing.id, now)) ? "sent_recently" : null);
    if (convSkip) {
      console.log(`${LOG} call ${call.ID} (${maskPhone(phone)}): skipped (${convSkip})`);
      return { status: "skipped", reason: convSkip };
    }

    const conv = await prisma.waBotConversation.upsert({
      where: { businessId_phone: { businessId, phone } },
      create: { businessId, phone, leadId: ref.leadId },
      update: ref.leadId ? { leadId: ref.leadId } : {},
      select: { id: true },
    });
    // Item 40.3: never 21:30–08:00 / Shabbat / a holiday — the message waits (template by the call time).
    const sendAt = quietDeferral(paycallStart(call.START), now, await holidayBlocks(businessId, now)) ?? now;
    const payload: PendingPayload = { callId: call.ID, sendAt: sendAt.toISOString(), leadId: ref.leadId, mobile, startedAt: paycallStart(call.START)?.toISOString() ?? null };
    let row: { id: string };
    try {
      row = await prisma.waBotMessage.create({
        data: { conversationId: conv.id, role: "system", kind: MISSED_CALL_KINDS.pending, text: JSON.stringify(payload), waMessageId: `missed-call:${call.ID}` },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { status: "skipped", reason: "already_scheduled" };
      throw err;
    }
    if (sendAt.getTime() > now.getTime()) {
      console.log(`${LOG} call ${call.ID} (${maskPhone(phone)}): scheduled for ${payload.sendAt}`);
      return { status: "scheduled" };
    }
    return await sendMissedCallMessage(row.id);
  } catch (err) {
    console.error(`${LOG} schedule failed:`, err instanceof Error ? err.message : err);
    return { status: "failed", reason: "error" };
  }
}

/** Send one due row (claimed first). Rules are checked again at send time. Never throws, never retries. */
export async function sendMissedCallMessage(rowId: string): Promise<{ status: "sent" | "skipped" | "failed" | "deferred"; reason?: string }> {
  const claimed = await prisma.waBotMessage.updateMany({
    where: { id: rowId, kind: MISSED_CALL_KINDS.pending },
    data: { kind: MISSED_CALL_KINDS.sending },
  });
  if (claimed.count === 0) return { status: "skipped", reason: "already_handled" };
  const row = await prisma.waBotMessage.findUnique({
    where: { id: rowId },
    select: { id: true, text: true, conversation: { select: { id: true, businessId: true, phone: true, status: true, lastInboundAt: true, leadId: true } } },
  });
  if (!row) return { status: "skipped", reason: "gone" };
  const payload = JSON.parse(row.text) as PendingPayload;
  const conv = row.conversation;
  const finish = async (kind: string, reason?: string) => {
    await prisma.waBotMessage.update({ where: { id: row.id }, data: { kind, text: JSON.stringify({ ...payload, ...(reason ? { reason } : {}) }) } });
  };

  try {
    // Re-check: the customer may have written / been answered / asked to stop since.
    // Activation time again (a row queued before the switch / the time was moved never goes out).
    const timeSkip = callTimeSkipReason(payload.startedAt ? new Date(payload.startedAt) : null, missedCallActivatedAt(), new Date(), null);
    let reason: SkipReason | null =
      timeSkip ??
      conversationSkipReason(conv, await lastMissedCallMessageAt(conv.id, row.id), new Date()) ??
      ((await formLeadMessageSince(conv.id, new Date())) ? "sent_recently" : null);
    if (!reason) {
      const since = new Date((payload.startedAt ? Date.parse(payload.startedAt) : Date.now()) - ANSWERED_RECENTLY_MS);
      try {
        const { getCalls } = await import("@/lib/paycall");
        const calls = await getCalls({ fromDate: new Date(since.getTime() - 24 * 60 * 60 * 1000), toDate: new Date(Date.now() + 24 * 60 * 60 * 1000), limit: 200 });
        if (answeredSince(calls, payload.mobile, since)) reason = "answered_recently";
      } catch (err) {
        // PayCall unavailable: the message still goes out (better an extra message than a lost customer).
        console.warn(`${LOG} answered-call check failed:`, err instanceof Error ? err.message : err);
      }
    }
    if (reason) {
      await finish(MISSED_CALL_KINDS.skipped, reason);
      console.log(`${LOG} call ${payload.callId} (${maskPhone(conv.phone)}): skipped at send time (${reason})`);
      return { status: "skipped", reason };
    }

    // Item 40.3: 21:30–08:00 / Shabbat / a holiday → back to the queue for the next allowed time.
    const deferTo = quietDeferral(payload.startedAt ? new Date(payload.startedAt) : null, new Date(), await holidayBlocks(conv.businessId, new Date()));
    if (deferTo) {
      await prisma.waBotMessage.update({ where: { id: row.id }, data: { kind: MISSED_CALL_KINDS.pending, text: JSON.stringify({ ...payload, sendAt: deferTo.toISOString() }) } });
      console.log(`${LOG} call ${payload.callId} (${maskPhone(conv.phone)}): quiet hours, deferred to ${deferTo.toISOString()}`);
      return { status: "deferred" };
    }

    // Template by the callback slot NOW (Or, 25/10): open / after hours ({{1}} = phrase) / weekend;
    // a template Meta has not approved yet falls back to missed_call_followup (logged, not a failure).
    // Item 40.3: the template follows the call time (a Shabbat call → weekend, sent after Shabbat).
    const slot = templateSlotFor(payload.startedAt ? new Date(payload.startedAt) : null, new Date());
    const { sendTemplateSteps } = await import("@/lib/alldog-bot/wa");
    const sent = await sendTemplateSteps(conv.phone, missedCallSteps(slot), MISSED_CALL_TEMPLATE.language);
    if (!sent) {
      await finish(MISSED_CALL_KINDS.failed, "send_failed"); // alerted inside; no retry
      return { status: "failed", reason: "send_failed" };
    }
    const tpl = sent.step.name;
    await prisma.waBotMessage.create({ data: { conversationId: conv.id, role: "assistant", kind: MISSED_CALL_MESSAGE_KIND, text: sent.step.text, waMessageId: sent.wamid } });
    await finish(MISSED_CALL_KINDS.sent, sent.fellBackFrom.length ? `template ${tpl} (fallback from ${sent.fellBackFrom.join(",")})` : `template ${tpl}`);
    const leadId = payload.leadId ?? conv.leadId;
    if (leadId) {
      await addLeadCallLog(
        leadId,
        `[וואטסאפ · אוטומטי] נשלחה הודעת וואטסאפ אוטומטית · מקור: שיחה שלא נענתה ל-03-3818670 (PayCall ${payload.callId}) · תבנית ${tpl}`
      ).catch(() => {});
    }
    console.log(`${LOG} call ${payload.callId} (${maskPhone(conv.phone)}): sent`);
    return { status: "sent" };
  } catch (err) {
    await finish(MISSED_CALL_KINDS.failed, "error").catch(() => {});
    const { alertAllDogFailure } = await import("@/lib/alldog/failure-alerts");
    await alertAllDogFailure({ kind: "wa_send", error: err, detail: `וואטסאפ אוטומטי לשיחה שלא נענתה (PayCall ${payload.callId})`, phone: conv.phone, leadId: payload.leadId });
    return { status: "failed", reason: "error" };
  }
}

/** Cron: send the rows whose time came (8:00 / after Shabbat). */
export async function processDueMissedCallMessages(opts: { limit: number }): Promise<{ due: number; sent: number; skipped: number; failed: number; deferred: number }> {
  const rows = await prisma.waBotMessage.findMany({
    where: { role: "system", kind: MISSED_CALL_KINDS.pending },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, text: true },
  });
  const now = Date.now();
  const due = rows
    .filter((r) => {
      try {
        return Date.parse((JSON.parse(r.text) as PendingPayload).sendAt) <= now;
      } catch {
        return false;
      }
    })
    .slice(0, opts.limit);
  const out = { due: due.length, sent: 0, skipped: 0, failed: 0, deferred: 0 };
  for (const r of due) {
    const res = await sendMissedCallMessage(r.id);
    out[res.status]++;
  }
  return out;
}

/** Hebrew label of a skip reason (logs / tests). */
export function skipReasonLabel(reason: string): string {
  return SKIP_REASON_LABELS[reason as SkipReason] ?? reason;
}

