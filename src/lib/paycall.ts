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
import { scheduleLeadFollowup } from "./reminder-service";
import { readEnv } from "@/lib/read-env";
import { callIdLoggedOnCustomer, findCustomerForCall, logMissedCallOnCustomer } from "@/lib/paycall-customer";

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
  const user = readEnv("PAYCALL_USERNAME");
  const password = readEnv("PAYCALL_PASSWORD");
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
  const uId = readEnv("PAYCALL_USER_ID");
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
 * Process a single missed call.
 * - The number belongs to an existing CUSTOMER → no lead: a note + a "לחזור ללקוח" task on
 *   the customer (src/lib/paycall-customer.ts).
 * - Otherwise: find or create a Lead in the configured business, then append a CallLog entry.
 *
 * Idempotent on the call id: a CallLog (lead) or timeline note (customer) carrying
 * `call_id:<ID>` means the call was already processed → skipped.
 */
export async function processMissedCall(call: PaycallCall): Promise<{
  leadId: string | null;
  customerId?: string;
  created: boolean;
  skipped: boolean;
}> {
  const businessId = readEnv("PAYCALL_BUSINESS_ID");
  const newStageId = readEnv("PAYCALL_NEW_LEAD_STAGE_ID");
  if (!businessId || !newStageId) {
    throw new Error("PAYCALL_BUSINESS_ID / PAYCALL_NEW_LEAD_STAGE_ID not configured");
  }

  const phone = normalizeIsraeliPhone(call.CALLERID);
  const startedAt = new Date(call.START.replace(" ", "T") + "+03:00"); // Asia/Jerusalem

  // A caller who is already a customer never becomes a new lead.
  const customer = await findCustomerForCall(businessId, phone);
  if (customer) {
    if (await callIdLoggedOnCustomer(businessId, call.ID)) {
      return { leadId: null, customerId: customer.id, created: false, skipped: true };
    }
    await logMissedCallOnCustomer(businessId, customer, {
      callId: call.ID,
      dateLabel: `${call.START.slice(0, 10)} ${call.START.slice(11, 16)}`,
      disposition: call.DISPOSITION,
      phone,
    });
    return { leadId: null, customerId: customer.id, created: false, skipped: false };
  }

  // Dedup: skip if this exact call ID was already logged on any lead of the business.
  const logged = await prisma.callLog.findFirst({
    where: { summary: { contains: `call_id:${call.ID}` }, lead: { businessId } },
    select: { leadId: true },
  });
  if (logged) return { leadId: logged.leadId, created: false, skipped: true };

  // The ACTIVE lead of this phone (open stage, touched in the last 60 days). Every lead closed
  // or stale → a new lead linked to the previous one (Or, item 24).
  const { resolveLeadForContact, returningContactNote } = await import("@/lib/alldog/leads");
  const { active: existing, previous } = await resolveLeadForContact(businessId, phone, startedAt);

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
        notes: [
          `נוצר אוטומטית משיחה שלא נענתה דרך Paycall.\nמספר ניסיונות: 1`,
          returningContactNote(previous?.id ?? null, previous?.customerId ?? null),
        ].filter(Boolean).join("\n\n"),
        lastContactedAt: startedAt,
      },
    });
    leadId = lead.id;
    created = true;

    // "ליד חדש נכנס" alert (WhatsApp + email + bell) — POST /api/leads sends it for its
    // leads; this raw creation path has to send it itself. Gated + never throws.
    const { alertNewLeadIfEnabled } = await import("@/lib/lead-alert");
    await alertNewLeadIfEnabled(businessId, {
      name: lead.name,
      phone,
      requestedService: null,
      city: null,
      source: "שיחה שלא נענתה (PayCall)",
    });

    // lead_followup automation (opt-in, gated inside; raw prisma creation path).
    await scheduleLeadFollowup({
      id: lead.id,
      businessId,
      name: lead.name,
      phone: lead.phone,
      requestedService: null,
      customerId: null,
    }).catch((err) => console.error("scheduleLeadFollowup (paycall) failed (non-critical):", err));
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
    // Only the counter line changes: the rest of the notes (dog details from the bot, the
    // "פונה חוזר" link…) stays.
    await prisma.lead.update({
      where: { id: leadId },
      data: { notes: missedCallNotes(existing?.notes ?? null, callCount) },
    });
  }

  return { leadId, created, skipped: false };
}

/** The lead notes with the missed-call counter set to `count` (the other lines are kept). */
export function missedCallNotes(notes: string | null, count: number): string {
  const counter = `מספר ניסיונות: ${count}`;
  const current = notes?.trim() ?? "";
  if (/מספר ניסיונות: \d+/.test(current)) {
    return current
      .replace(/נוצר אוטומטית משיחה שלא נענתה דרך Paycall\./, "נוצר אוטומטית משיחות שלא נענו דרך Paycall.")
      .replace(/מספר ניסיונות: \d+/, counter);
  }
  return [current, `נוצר אוטומטית משיחות שלא נענו דרך Paycall.\n${counter}`].filter(Boolean).join("\n\n");
}

function formatCallSummary(call: PaycallCall): string {
  const time = call.START.slice(11, 16); // HH:MM
  const date = call.START.slice(0, 10);
  const status = call.DISPOSITION;
  return `[paycall] שיחה שלא נענתה (${status}) ב-${date} ${time} • call_id:${call.ID}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Answered calls (AllDog call summaries — src/lib/alldog/call-summary.ts)
// ═══════════════════════════════════════════════════════════════════════════

/** HTTPS endpoint for the recording / analytics actions (same Basic auth). */
const PAYCALL_API_URL = "https://ws.callindex.co.il/api_v2.php";

/** Minimum talk time worth transcribing. */
export const MIN_SUMMARY_BILLSEC = 20;

export interface LiveLinkParams {
  status: string | null;
  callId: string | null;
  disposition: string | null;
  /** Caller phone as sent by PayCall (`Cli`). */
  cli: string | null;
  billsec: number | null;
  /** dlinkDirect preferred over dlink. */
  recordingUrl: string | null;
  gclid: string | null;
  campaign: string | null;
  /** Every `campaign*` query param as sent (for the call log). */
  campaignParams: Record<string, string>;
}

/**
 * Parse PayCall's liveLink query (GET /api/webhooks/paycall?Status=END&Id=…&Disposition=…
 * &Cli=…&billsec=…&dlink=…&dlinkDirect=…&Gclid=…&campaign…=…). Param names are matched
 * case-insensitively — PayCall's casing differs between accounts.
 */
export function parseLiveLinkParams(sp: URLSearchParams): LiveLinkParams {
  const lower = new Map<string, string>();
  const campaignParams: Record<string, string> = {};
  sp.forEach((value, key) => {
    const k = key.toLowerCase();
    const v = value.trim();
    if (!lower.has(k) && v) lower.set(k, v);
    if (k.startsWith("campaign") && v) campaignParams[key] = v.slice(0, 200);
  });
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = lower.get(k.toLowerCase());
      if (v) return v;
    }
    return null;
  };
  const billsecRaw = get("billsec");
  const billsec = billsecRaw !== null && /^\d+$/.test(billsecRaw) ? Number(billsecRaw) : null;
  const recordingUrl = get("dlinkDirect") ?? get("dlink");
  const firstCampaign = Object.values(campaignParams)[0] ?? null;
  return {
    status: get("Status"),
    callId: get("Id"),
    disposition: get("Disposition")?.toUpperCase() ?? null,
    cli: get("Cli", "CallerId", "CALLERID"),
    billsec,
    recordingUrl: recordingUrl && isSafeRecordingUrl(recordingUrl) ? recordingUrl : null,
    gclid: get("Gclid")?.slice(0, 200) ?? null,
    campaign: (get("campaign", "campaignName", "campaign_name") ?? firstCampaign)?.slice(0, 200) ?? null,
    campaignParams,
  };
}

/** Talk time of a call from the API (END − ANS_TIME, else DURATION); null when unknown. */
export function paycallBillsec(call: Pick<PaycallCall, "END" | "ANS_TIME" | "DURATION">): number | null {
  const end = Date.parse((call.END ?? "").replace(" ", "T") + "+03:00");
  const ans = call.ANS_TIME ? Date.parse(call.ANS_TIME.replace(" ", "T") + "+03:00") : NaN;
  if (!isNaN(end) && !isNaN(ans) && end >= ans) return Math.round((end - ans) / 1000);
  const d = Number(call.DURATION);
  return Number.isFinite(d) && call.DURATION !== "" ? d : null;
}

/** ANSWER with at least MIN_SUMMARY_BILLSEC seconds of talk time. */
export function isSummarizableAnswer(p: { disposition: string | null; billsec: number | null }): boolean {
  return p.disposition === "ANSWER" && p.billsec !== null && p.billsec >= MIN_SUMMARY_BILLSEC;
}

/** http(s) to a public host name only — never a raw IP / localhost (SSRF guard on dlink). */
export function isSafeRecordingUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false; // IPv4 / IPv6 literal
  return true;
}

export interface CallRecording {
  data: ArrayBuffer;
  contentType: string;
}

/** The API user lacks allow_call_records ("Service Denied") — never retry in a loop. */
export class PaycallRecordingDeniedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PaycallRecordingDeniedError";
  }
}

const MAX_RECORDING_BYTES = 40 * 1024 * 1024;

function looksLikeJson(contentType: string, bytes: Uint8Array): boolean {
  if (contentType.includes("json") || contentType.startsWith("text/")) return true;
  const first = bytes.find((b) => b !== 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09);
  return first === 0x7b; // "{"
}

async function readAudioResponse(res: Response, label: string): Promise<CallRecording> {
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const data = await res.arrayBuffer();
  const bytes = new Uint8Array(data);
  if (bytes.byteLength === 0) throw new Error(`${label}: empty body`);
  if (bytes.byteLength > MAX_RECORDING_BYTES) throw new Error(`${label}: recording too large (${bytes.byteLength} bytes)`);
  if (looksLikeJson(contentType, bytes)) {
    const text = new TextDecoder().decode(bytes.slice(0, 2000));
    let err = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { Err?: string; Response?: number };
      if (j.Err) err = j.Err;
    } catch { /* not JSON — keep the raw prefix */ }
    if (/service denied/i.test(err)) throw new PaycallRecordingDeniedError(err);
    throw new Error(`${label}: ${err}`);
  }
  return { data, contentType: contentType || "audio/mpeg" };
}

/** Download the recording from the liveLink `dlink` / `dlinkDirect`. */
export async function fetchRecordingFromLink(url: string): Promise<CallRecording> {
  if (!isSafeRecordingUrl(url)) throw new Error("dlink: unsafe URL");
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(60_000) });
  return readAudioResponse(res, "dlink");
}

/**
 * downloadRecord (PayCall OpenAPI): POST api_v2.php method=downloadRecord, callId, from=dd/mm/yyyy
 * of the call day, uId, out=json. 200 → binary audio; error → JSON {Response:0, Err}.
 * Needs allow_call_records on the API user, otherwise "Service Denied".
 */
export async function downloadRecord(callId: string, callDay: string /* dd/mm/yyyy */): Promise<CallRecording> {
  const uId = readEnv("PAYCALL_USER_ID");
  if (!uId) throw new Error("PAYCALL_USER_ID not configured");
  const body = new URLSearchParams({ method: "downloadRecord", callId, from: callDay, uId, out: "json" });
  const res = await fetch(PAYCALL_API_URL, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  return readAudioResponse(res, "downloadRecord");
}

/**
 * getAnalyticsCalls field names are not documented yet, so nothing is mapped from it.
 * The daily cron logs the response SHAPE once (claimOnce, 30 days): the key names of the first
 * record only — never values. Any key containing a long digit run is masked (no phone numbers).
 * Once a real log is seen, gclid / campaign get mapped from the actual field names.
 */
export function describeAnalyticsShape(data: unknown): string {
  const safeKey = (k: string) => k.replace(/\d{5,}/g, "#####").slice(0, 40);
  const keysOf = (o: object) => Object.keys(o).slice(0, 50).map(safeKey).join(", ");
  if (Array.isArray(data)) {
    const first = data[0];
    const firstDesc = first && typeof first === "object" && !Array.isArray(first) ? `first record keys: [${keysOf(first)}]` : `first item type: ${Array.isArray(first) ? "array" : typeof first}`;
    return `array(len=${data.length}) ${data.length ? firstDesc : ""}`.trim();
  }
  if (data && typeof data === "object") return `object keys: [${keysOf(data)}]`;
  return `type: ${typeof data}`;
}

/** Fetch getAnalyticsCalls once and return its shape description (null when skipped / failed). */
export async function probeAnalyticsCallsShape(params: { fromDate: Date; toDate: Date }): Promise<string | null> {
  const uId = readEnv("PAYCALL_USER_ID");
  if (!uId) return null;
  const { claimOnce } = await import("@/lib/rate-limit");
  if (!(await claimOnce("paycall-analytics-shape-log", 30 * 24 * 60 * 60))) return null;
  try {
    const body = new URLSearchParams({
      uId,
      action: "getAnalyticsCalls",
      fromDate: ddmmyyyy(params.fromDate),
      toDate: ddmmyyyy(params.toDate),
      out: "json",
    });
    const res = await fetch(PAYCALL_API_URL, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let shape: string;
    try {
      shape = describeAnalyticsShape(JSON.parse(text));
    } catch {
      shape = `non-JSON (${text.length} chars)`;
    }
    const line = `HTTP ${res.status} ${shape}`;
    console.log(`[paycall] getAnalyticsCalls shape (one-time): ${line}`);
    return line;
  } catch (err) {
    console.error("[paycall] getAnalyticsCalls probe failed (non-critical):", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Item 33: one getAnalyticsCalls record by call id (the day of the call), or null. Used only when
 * getCalls did not carry the destination name ("שם יעד"). The id key is matched loosely
 * (ID / CALL_ID / CallId …). Never throws.
 */
export async function getAnalyticsCallRecord(callId: string, startedAt: Date): Promise<Record<string, unknown> | null> {
  const uId = readEnv("PAYCALL_USER_ID");
  if (!uId) return null;
  try {
    const day = new Date(startedAt.getTime() - 24 * 60 * 60 * 1000);
    const body = new URLSearchParams({
      uId,
      action: "getAnalyticsCalls",
      fromDate: ddmmyyyy(day),
      toDate: ddmmyyyy(new Date(startedAt.getTime() + 24 * 60 * 60 * 1000)),
      out: "json",
    });
    const res = await fetch(PAYCALL_API_URL, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data: unknown = JSON.parse(await res.text());
    const rows = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data).find(Array.isArray) ?? [] : [];
    const isId = (k: string) => ["ID", "CALLID"].includes(k.toUpperCase().replace(/[^A-Z]/g, ""));
    const hit = (rows as unknown[]).find(
      (r) => r && typeof r === "object" && Object.entries(r as object).some(([k, v]) => isId(k) && String(v) === callId)
    );
    return (hit as Record<string, unknown>) ?? null;
  } catch (err) {
    console.warn("[paycall] getAnalyticsCallRecord failed (non-critical):", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Logs the KEY NAMES of a PayCall call record once per 30 days per source (never values). */
export async function logCallRecordKeysOnce(source: "getCalls" | "getAnalyticsCalls", record: object | null): Promise<void> {
  if (!record) return;
  try {
    const { claimOnce } = await import("@/lib/rate-limit");
    if (!(await claimOnce(`paycall-record-keys:${source}`, 30 * 24 * 60 * 60))) return;
    console.log(`[paycall] ${source} record keys (one-time): ${describeAnalyticsShape([record])}`);
  } catch {
    /* non-critical */
  }
}
