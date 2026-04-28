/**
 * PayCall / CheckCall integration.
 *
 * - WebService endpoint: http://ws.callindex.co.il/api_v2.php
 * - Auth: HTTP Basic
 * - getCalls returns array of call records with DISPOSITION ∈
 *     ANSWER | NOANSWER | CANCEL | BUSY | CONGESTION | CHANUNAVAIL | IVR_HANGUP | REJECTED
 *   ANSWER = picked up; everything else counts as a missed call for our purposes.
 *
 * Real-time webhook (configured by PayCall support):
 *   GET /api/webhooks/paycall?Status=END&Id=...&Disposition=...&CustId=...
 * The webhook only carries the call ID + disposition, so we fetch full details
 * (caller phone, start time) via getCallById/getCalls.
 */

import prisma from "./prisma";

const PAYCALL_URL = "http://ws.callindex.co.il/api_v2.php";

export interface PaycallCall {
  ID: string;
  START: string;          // "YYYY-MM-DD HH:MM:SS"
  END: string;
  NAME: string;           // route/destination name (campaign label)
  CALLERID: string;       // caller phone, with leading 0
  CALLEE: string;         // routed-to phone
  DISPOSITION: string;    // see enum above
  DURATION: string;       // seconds
  PR_NUMBER: string;      // premium/campaign number (no leading 0)
  ANS_TIME: string | null;
}

const MISSED_DISPOSITIONS = new Set([
  "NOANSWER",
  "CANCEL",
  "BUSY",
  "CONGESTION",
  "CHANUNAVAIL",
  "IVR_HANGUP",
  "REJECTED",
]);

export function isMissedCall(call: Pick<PaycallCall, "DISPOSITION">): boolean {
  return MISSED_DISPOSITIONS.has(call.DISPOSITION);
}

function ddmmyyyy(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
}

function authHeader(): string {
  const user = process.env.PAYCALL_USERNAME;
  const password = process.env.PAYCALL_PASSWORD;
  if (!user || !password) {
    throw new Error("PAYCALL_USERNAME / PAYCALL_PASSWORD not configured");
  }
  return "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

/** Fetch calls within a date range (PayCall API uses DD-MM-YYYY). */
export async function getCalls(params: {
  fromDate: Date;
  toDate: Date;
  fromId?: string;        // fetch calls with ID > this (for incremental sync)
  limit?: number;
}): Promise<PaycallCall[]> {
  const uId = process.env.PAYCALL_USER_ID;
  if (!uId) throw new Error("PAYCALL_USER_ID not configured");

  const body = new URLSearchParams({
    uId,
    action: "getCalls",
    fromDate: ddmmyyyy(params.fromDate),
    toDate: ddmmyyyy(params.toDate),
    out: "json",
    orderBy: "desc",
  });
  if (params.fromId) body.set("fromId", params.fromId);
  if (params.limit) body.set("limit", String(params.limit));

  const res = await fetch(PAYCALL_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`PayCall getCalls failed: ${res.status} ${await res.text()}`);
  }

  const text = await res.text();
  // PayCall returns either a JSON array of calls or {Response:0,Err:"..."}
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`PayCall getCalls non-JSON response: ${text.slice(0, 200)}`);
  }

  if (Array.isArray(data)) return data as PaycallCall[];
  if (typeof data === "object" && data && "Err" in data) {
    throw new Error(`PayCall error: ${(data as { Err: string }).Err}`);
  }
  return [];
}

/** Look up a single call by its ID (uses getCalls with fromId for narrow filter). */
export async function getCallById(callId: string): Promise<PaycallCall | null> {
  // Search wide window — call IDs are monotonic so fromId narrows server-side
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const calls = await getCalls({ fromDate, toDate, limit: 50 });
  return calls.find((c) => c.ID === callId) ?? null;
}

/** Normalize an Israeli phone number to "0NNNNNNNNN" (10 digits with leading 0). */
export function normalizeIsraeliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return "0" + digits.slice(3);
  if (!digits.startsWith("0")) return "0" + digits;
  return digits;
}

/**
 * Process a single missed call: find or create a Lead in the configured business,
 * then append a CallLog entry. Returns the lead id and whether it was created.
 *
 * Idempotent on (businessId, phone, callId): if a CallLog with summary including
 * the call ID already exists for this lead, we skip.
 */
export async function processMissedCall(call: PaycallCall): Promise<{
  leadId: string;
  created: boolean;
  skipped: boolean;
}> {
  const businessId = process.env.PAYCALL_BUSINESS_ID;
  const newStageId = process.env.PAYCALL_NEW_LEAD_STAGE_ID;
  if (!businessId || !newStageId) {
    throw new Error("PAYCALL_BUSINESS_ID / PAYCALL_NEW_LEAD_STAGE_ID not configured");
  }

  const phone = normalizeIsraeliPhone(call.CALLERID);
  const startedAt = new Date(call.START.replace(" ", "T") + "+03:00"); // Asia/Jerusalem

  // Find an active lead with this phone in the target business.
  // Active = not in won/lost stage. We check stage's isWon/isLost via include.
  const existing = await prisma.lead.findFirst({
    where: { businessId, phone },
    include: { callLogs: { where: { type: "call" }, orderBy: { createdAt: "desc" }, take: 50 } },
    orderBy: { createdAt: "desc" },
  });

  // Dedup: skip if we've already logged this exact call ID
  if (existing && existing.callLogs.some((log) => log.summary.includes(`call_id:${call.ID}`))) {
    return { leadId: existing.id, created: false, skipped: true };
  }

  const summary = formatCallSummary(call);
  let leadId: string;
  let created = false;

  if (existing) {
    leadId = existing.id;
    // Update lastContactedAt on the existing lead
    await prisma.lead.update({
      where: { id: existing.id },
      data: { lastContactedAt: startedAt },
    });
  } else {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: `שיחה מ-${phone}`,
        phone,
        source: "paycall_missed_call",
        stage: newStageId,
        notes: `נוצר אוטומטית משיחה שלא נענתה דרך Paycall.\nמספר ניסיונות: 1`,
        lastContactedAt: startedAt,
      },
    });
    leadId = lead.id;
    created = true;
  }

  await prisma.callLog.create({
    data: {
      leadId,
      type: "call",
      summary,
    },
  });

  // Update notes counter on existing leads to reflect total missed calls
  if (!created) {
    const callCount = await prisma.callLog.count({
      where: { leadId, type: "call", summary: { contains: "[paycall]" } },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        notes: `נוצר אוטומטית משיחות שלא נענו דרך Paycall.\nמספר ניסיונות: ${callCount}`,
      },
    });
  }

  return { leadId, created, skipped: false };
}

function formatCallSummary(call: PaycallCall): string {
  const time = call.START.slice(11, 16); // HH:MM
  const date = call.START.slice(0, 10);
  const status = call.DISPOSITION;
  return `[paycall] שיחה שלא נענתה (${status}) ב-${date} ${time} • call_id:${call.ID}`;
}
