/**
 * Per-business WhatsApp connections (Meta Embedded Signup + coexistence).
 *
 * CONTRACT — implemented in this file; consumed by:
 *   - src/lib/whatsapp.ts               → resolveWhatsAppSender()
 *   - src/app/api/integrations/whatsapp/* → connect / status / disconnect / sync-templates
 *   - src/app/api/webhooks/whatsapp-status → findBusinessIdByPhoneNumberId()
 *   - settings UI (via the API routes above)
 *
 * Platform fallback: when a business has no ACTIVE connection (or the requested template is
 * not APPROVED on its WABA), callers keep sending from the platform number exactly as today.
 *
 * Meta Graph API: v21.0. Every Graph call goes through `graph()` — 10s timeout, never throws,
 * never logs tokens/secrets (log prefix `[WhatsApp Connect]`).
 */

import { prisma } from "./prisma";
import { encryptWhatsAppToken, decryptWhatsAppToken } from "./encryption";

export type WaSenderSource = "business" | "platform";

export interface WaSender {
  token: string;
  phoneNumberId: string;
  source: WaSenderSource;
  /** Set when source === "business" */
  connectionId?: string;
  businessId?: string;
}

export interface WaConnectionStatus {
  connected: boolean;
  status: "active" | "disconnected" | "error" | "none";
  displayPhone: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  coexistence: boolean;
  connectedAt: string | null;
  templatesSyncedAt: string | null;
  /** { templateName: "APPROVED" | "PENDING" | ... } on the business WABA */
  templates: Record<string, string>;
  /** Platform-approved template names the business WABA is still missing / not approved for */
  missingTemplates: string[];
  lastError: string | null;
  /** Embedded Signup is configured on this deployment (NEXT_PUBLIC_META_APP_ID + NEXT_PUBLIC_META_ES_CONFIG_ID + META_APP_SECRET) */
  signupAvailable: boolean;
}

export interface ConnectInput {
  businessId: string;
  userId: string;
  /** Authorization code from FB.login (response_type "code") — exchanged server-side for a business-integration token */
  code: string;
  phoneNumberId: string;
  wabaId: string;
  coexistence?: boolean;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export type WhatsAppConnectErrorCode = "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "EXTERNAL" | "NOT_CONFIGURED";

const ERROR_HTTP_STATUS: Record<WhatsAppConnectErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXTERNAL: 502,
  NOT_CONFIGURED: 503,
};

/** Thrown by connect/sync with a Hebrew, user-safe message. `status` = suggested HTTP status for API routes. */
export class WhatsAppConnectError extends Error {
  code: WhatsAppConnectErrorCode;
  status: number;
  constructor(message: string, code: WhatsAppConnectErrorCode = "VALIDATION") {
    super(message);
    this.name = "WhatsAppConnectError";
    this.code = code;
    this.status = ERROR_HTTP_STATUS[code];
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = "[WhatsApp Connect]";
const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const GRAPH_TIMEOUT_MS = 10_000;
/** `lastUsedAt` is written at most once per this interval (cheap updateMany, awaited). */
const LAST_USED_MIN_INTERVAL_MS = 10 * 60 * 1000;
// Embedded Signup system-user tokens live 60 days; refresh when this close to expiry.
const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** lastError values written by the template sync start with this so a later good sync can clear them. */
const SYNC_ERR_PREFIX = "סנכרון תבניות: ";
const MAX_TEMPLATE_PAGES = 5;

/** Platform WABA (the number every business sends from until it connects its own). */
export function getPlatformWabaId(): string {
  return (process.env.META_WABA_ID || "25882288788086856").trim();
}

/**
 * Best-effort list of the platform's approved template names. The source of truth is the
 * live platform WABA (fetched in syncWhatsAppTemplates); this list is only the fallback used
 * to compute `missingTemplates` / when that fetch fails.
 */
export const PLATFORM_TEMPLATE_NAMES: readonly string[] = [
  "petra_appointment_reminder",
  "petra_appointment_confirmation",
  "petra_lead_notification",
  "petra_biz_lead_alert",
  "petra_boarding_confirmation",
  "petra_boarding_checkout",
  "petra_boarding_thank_you",
  "petra_lead_followup",
  "petra_payment_request",
];

/** True when all env needed for Embedded Signup is present. */
export function isWhatsAppEmbeddedSignupConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_ES_CONFIG_ID && process.env.META_APP_SECRET);
}

function getMetaAppId(): string {
  return (process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
}

// ─── Graph helper ───────────────────────────────────────────────────────────

interface GraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
}

interface GraphResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: GraphError | null;
}

interface GraphOptions {
  method?: "GET" | "POST" | "DELETE";
  token?: string;
  query?: Record<string, string>;
  body?: unknown;
  /** Values that must never appear in logs/messages (tokens, secrets, codes). */
  secrets?: string[];
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  }
  return out;
}

/** Meta Graph call: 10s timeout, JSON in/out, never throws, never logs secrets. */
async function graph<T>(path: string, opts: GraphOptions = {}): Promise<GraphResult<T>> {
  const secrets = [...(opts.secrets ?? []), ...(opts.token ? [opts.token] : [])];
  const url = new URL(GRAPH_BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { json = null; }
    const error: GraphError | null =
      json && typeof json === "object" ? ((json as { error?: GraphError }).error ?? null) : null;
    if (!res.ok || error) {
      const safeMsg = redact(error?.message ?? `HTTP ${res.status}`, secrets);
      console.error(`${LOG} ${opts.method ?? "GET"} ${url.pathname} failed: ${res.status} ${safeMsg} (code ${error?.code ?? "-"}/${error?.error_subcode ?? "-"})`);
      return { ok: false, status: res.status, data: null, error: { ...(error ?? {}), message: safeMsg } };
    }
    return { ok: true, status: res.status, data: json as T, error: null };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const msg = aborted ? "timeout" : redact(err instanceof Error ? err.message : "network error", secrets);
    console.error(`${LOG} ${opts.method ?? "GET"} ${url.pathname} error: ${msg}`);
    return { ok: false, status: 0, data: null, error: { message: msg, type: aborted ? "Timeout" : "NetworkError" } };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Small helpers ──────────────────────────────────────────────────────────

type ConnectionRow = NonNullable<Awaited<ReturnType<typeof prisma.whatsAppConnection.findUnique>>>;

function parseTemplates(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function computeMissingTemplates(templates: Record<string, string>): string[] {
  // Union of the static fallback list and every petra_* template the sync has recorded
  // (sync writes an entry — PENDING / ERROR — for each platform template it tried to copy).
  const names = new Set<string>(PLATFORM_TEMPLATE_NAMES);
  for (const name of Object.keys(templates)) if (name.startsWith("petra_")) names.add(name);
  return [...names].filter((n) => templates[n] !== "APPROVED").sort();
}

function buildStatus(row: ConnectionRow | null): WaConnectionStatus {
  const signupAvailable = isWhatsAppEmbeddedSignupConfigured();
  if (!row || row.status === "disconnected") {
    return {
      connected: false,
      status: "none",
      displayPhone: null,
      verifiedName: null,
      qualityRating: null,
      coexistence: false,
      connectedAt: null,
      templatesSyncedAt: null,
      templates: {},
      missingTemplates: [],
      lastError: row?.lastError ?? null,
      signupAvailable,
    };
  }
  const templates = parseTemplates(row.templatesJson);
  const status: WaConnectionStatus["status"] = row.status === "active" ? "active" : "error";
  return {
    connected: status === "active",
    status,
    displayPhone: row.displayPhone,
    verifiedName: row.verifiedName,
    qualityRating: row.qualityRating,
    coexistence: row.coexistence,
    connectedAt: row.connectedAt.toISOString(),
    templatesSyncedAt: row.templatesSyncedAt?.toISOString() ?? null,
    templates,
    missingTemplates: computeMissingTemplates(templates),
    lastError: row.lastError,
    signupAvailable,
  };
}

/** Best-effort: flag the connection as broken so the UI shows it and the resolver skips it. Never throws. */
export async function markWhatsAppConnectionError(businessId: string, lastError: string): Promise<void> {
  try {
    await prisma.whatsAppConnection.updateMany({
      where: { businessId, status: { not: "disconnected" } },
      data: { status: "error", lastError: lastError.slice(0, 500) },
    });
  } catch (err) {
    console.error(`${LOG} markConnectionError failed for business ${businessId}:`, err);
  }
}

function platformSender(): WaSender | null {
  const token = process.env.META_WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, source: "platform" };
}

function isValidMetaId(v: unknown): v is string {
  return typeof v === "string" && /^\d{5,32}$/.test(v);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Which phone/token to send from for this business (business number if active + template approved there, else platform). Null when nothing is configured at all (stub mode). */
export async function resolveWhatsAppSender(
  businessId?: string | null,
  opts?: { templateName?: string }
): Promise<WaSender | null> {
  if (businessId) {
    try {
      const conn = await prisma.whatsAppConnection.findUnique({ where: { businessId } });
      if (conn && conn.status === "active" && conn.accessTokenEnc) {
        const templateOk =
          !opts?.templateName || parseTemplates(conn.templatesJson)[opts.templateName] === "APPROVED";
        if (templateOk) {
          let token: string | null = null;
          try {
            token = decryptWhatsAppToken(conn.accessTokenEnc);
          } catch (err) {
            console.error(`${LOG} token decrypt failed for business ${businessId} — falling back to platform sender:`, err instanceof Error ? err.message : err);
            await markWhatsAppConnectionError(businessId, "פענוח טוקן הגישה נכשל — יש לחבר את המספר מחדש");
          }
          if (token) {
            // Lazy refresh: Embedded Signup tokens expire after 60 days — exchange for a fresh
            // one when close to expiry (awaited; failure keeps the current token until it dies).
            if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_WINDOW_MS) {
              const refreshed = await refreshBusinessToken(businessId, token);
              if (refreshed) token = refreshed;
              else if (conn.tokenExpiresAt.getTime() < Date.now()) {
                await markWhatsAppConnectionError(businessId, "טוקן הגישה פג ולא ניתן היה לרענן אותו — יש לחבר את המספר מחדש");
                return platformSender();
              }
            }
            // Throttled lastUsedAt touch (awaited — Vercel kills fire-and-forget work).
            const now = Date.now();
            if (!conn.lastUsedAt || now - conn.lastUsedAt.getTime() > LAST_USED_MIN_INTERVAL_MS) {
              try {
                await prisma.whatsAppConnection.updateMany({ where: { id: conn.id }, data: { lastUsedAt: new Date(now) } });
              } catch (err) {
                console.error(`${LOG} lastUsedAt update failed:`, err);
              }
            }
            return { token, phoneNumberId: conn.phoneNumberId, source: "business", connectionId: conn.id, businessId };
          }
        }
        // Template not approved on the business WABA → platform number keeps working as today.
      }
    } catch (err) {
      console.error(`${LOG} connection lookup failed for business ${businessId} — using platform sender:`, err);
    }
  }
  return platformSender();
}

/** Exchange a soon-to-expire business token for a fresh 60-day one. Returns the new token or null. */
async function refreshBusinessToken(businessId: string, currentToken: string): Promise<string | null> {
  const appId = getMetaAppId();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  const res = await graph<{ access_token?: string }>("/oauth/access_token", {
    query: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentToken,
    },
    secrets: [appSecret, currentToken],
  });
  const fresh = res.data?.access_token;
  if (!fresh) {
    console.error(`${LOG} token refresh failed for business ${businessId}: ${res.error?.message ?? "no token in response"}`);
    return null;
  }
  try {
    await prisma.whatsAppConnection.updateMany({
      where: { businessId },
      data: { accessTokenEnc: encryptWhatsAppToken(fresh), tokenExpiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS) },
    });
    console.log(`${LOG} refreshed access token for business ${businessId}`);
    return fresh;
  } catch (err) {
    console.error(`${LOG} failed to store refreshed token for business ${businessId}:`, err);
    return fresh; // still usable for this send
  }
}

export async function getWhatsAppConnectionStatus(businessId: string): Promise<WaConnectionStatus> {
  const row = await prisma.whatsAppConnection.findUnique({ where: { businessId } });
  return buildStatus(row);
}

interface PhoneInfo {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
}

/** Meta returns a few distinct errors for "register" that do not block sending. */
function isBenignRegisterError(err: GraphError | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return (
    /already\s+(been\s+)?registered|is\s+already|not\s+(be\s+)?required|coexist/.test(m) ||
    err?.code === 133016 // "already registered" family (best effort — message match above is the main signal)
  );
}

function isAlreadySubscribedError(err: GraphError | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("already") && m.includes("subscribe");
}

/** Exchange code → token, subscribe app to WABA, register/verify phone, store encrypted token, kick off template sync. */
export async function connectWhatsAppBusiness(input: ConnectInput): Promise<WaConnectionStatus> {
  const businessId = input.businessId;
  const code = typeof input.code === "string" ? input.code.trim() : "";
  const phoneNumberId = typeof input.phoneNumberId === "string" ? input.phoneNumberId.trim() : "";
  const wabaId = typeof input.wabaId === "string" ? input.wabaId.trim() : "";
  const coexistence = !!input.coexistence;

  if (!businessId) throw new WhatsAppConnectError("חסר מזהה עסק", "VALIDATION");
  if (!code || code.length > 2048) throw new WhatsAppConnectError("קוד ההרשאה מ-Meta חסר או לא תקין", "VALIDATION");
  if (!isValidMetaId(phoneNumberId) || !isValidMetaId(wabaId)) {
    throw new WhatsAppConnectError("פרטי החשבון שהתקבלו מ-Meta אינם תקינים — נסו להתחבר שוב", "VALIDATION");
  }

  const appId = getMetaAppId();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new WhatsAppConnectError("חיבור וואטסאפ עסקי אינו מוגדר בשרת זה", "NOT_CONFIGURED");
  }

  // A phone number can be connected to one business only.
  const taken = await prisma.whatsAppConnection.findUnique({ where: { phoneNumberId } });
  if (taken && taken.businessId !== businessId) {
    throw new WhatsAppConnectError("המספר הזה כבר מחובר לעסק אחר", "CONFLICT");
  }

  // (a) code → business-integration system-user token
  const exchange = await graph<{ access_token?: string }>("/oauth/access_token", {
    query: { client_id: appId, client_secret: appSecret, code },
    secrets: [appSecret, code],
  });
  const token = exchange.data?.access_token?.trim();
  if (!exchange.ok || !token) {
    throw new WhatsAppConnectError("אימות ההרשאה מול Meta נכשל — נסו להתחבר שוב", "EXTERNAL");
  }

  // (b) the token must actually grant access to the claimed phone number
  const phone = await graph<PhoneInfo>(`/${phoneNumberId}`, {
    token,
    query: { fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status" },
  });
  if (!phone.ok || !phone.data || String(phone.data.id ?? "") !== phoneNumberId) {
    throw new WhatsAppConnectError("לא ניתן לאמת את מספר הטלפון שנבחר — ודאו שהמספר שייך לחשבון שאושר ונסו שוב", "EXTERNAL");
  }

  const errors: string[] = [];

  // (c) subscribe our app to the business WABA (webhooks: statuses, template updates)
  const sub = await graph<{ success?: boolean }>(`/${wabaId}/subscribed_apps`, { method: "POST", token });
  if (!sub.ok && !isAlreadySubscribedError(sub.error)) {
    errors.push(`רישום ה-webhooks נכשל: ${sub.error?.message ?? "שגיאה לא ידועה"}`);
  }

  // (d) register the number for Cloud API (no-op / benign error for coexistence numbers)
  const pin = (process.env.WHATSAPP_REGISTER_PIN || "000000").trim();
  const reg = await graph<{ success?: boolean }>(`/${phoneNumberId}/register`, {
    method: "POST",
    token,
    body: { messaging_product: "whatsapp", pin },
    secrets: [pin],
  });
  if (!reg.ok && !isBenignRegisterError(reg.error)) {
    errors.push(`רישום המספר ל-Cloud API נכשל: ${reg.error?.message ?? "שגיאה לא ידועה"}`);
  }

  // (e) persist (overwrite an existing row of this business)
  const now = new Date();
  const lastError = errors.length ? errors.join(" | ").slice(0, 500) : null;
  const data = {
    wabaId,
    phoneNumberId,
    displayPhone: phone.data.display_phone_number ?? null,
    verifiedName: phone.data.verified_name ?? null,
    qualityRating: phone.data.quality_rating ?? null,
    accessTokenEnc: encryptWhatsAppToken(token),
    tokenExpiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
    status: "active",
    lastError,
    coexistence,
    connectedByUserId: input.userId,
    connectedAt: now,
    disconnectedAt: null,
  };
  await prisma.whatsAppConnection.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });
  console.log(`${LOG} business ${businessId} connected phone_number_id ${phoneNumberId} (coexistence=${coexistence})`);

  // (f) copy the platform templates — must never fail the connect itself
  try {
    return await syncWhatsAppTemplates(businessId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
    console.error(`${LOG} initial template sync failed for business ${businessId}: ${msg}`);
    try {
      await prisma.whatsAppConnection.updateMany({
        where: { businessId },
        data: { lastError: [lastError, SYNC_ERR_PREFIX + msg].filter(Boolean).join(" | ").slice(0, 500) },
      });
    } catch { /* best effort */ }
    return getWhatsAppConnectionStatus(businessId);
  }
}

interface MetaTemplate {
  id?: string;
  name: string;
  status?: string;
  category?: string;
  language?: string;
  components?: unknown[];
}

interface TemplatesPage {
  data?: MetaTemplate[];
  paging?: { cursors?: { after?: string }; next?: string };
}

/** Fetch up to MAX_TEMPLATE_PAGES pages of templates from a WABA. Returns null on failure. */
async function fetchTemplates(wabaId: string, token: string, fields: string): Promise<MetaTemplate[] | null> {
  const all: MetaTemplate[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_TEMPLATE_PAGES; page++) {
    const res = await graph<TemplatesPage>(`/${wabaId}/message_templates`, {
      token,
      query: { fields, limit: "100", ...(after ? { after } : {}) },
    });
    if (!res.ok || !res.data) return page === 0 ? null : all;
    all.push(...(res.data.data ?? []).filter((t) => t && typeof t.name === "string"));
    after = res.data.paging?.cursors?.after;
    if (!after || !res.data.paging?.next) break;
  }
  return all;
}

/** Prefer the Hebrew variant when a template exists in several languages; otherwise the first APPROVED one. */
function pickByName(list: MetaTemplate[]): Map<string, MetaTemplate> {
  const map = new Map<string, MetaTemplate>();
  for (const t of list) {
    const prev = map.get(t.name);
    if (!prev) { map.set(t.name, t); continue; }
    const prevScore = (prev.language === "he" ? 2 : 0) + (prev.status === "APPROVED" ? 1 : 0);
    const score = (t.language === "he" ? 2 : 0) + (t.status === "APPROVED" ? 1 : 0);
    if (score > prevScore) map.set(t.name, t);
  }
  return map;
}

/** Copy the platform's approved templates onto the business WABA (idempotent) and refresh templatesJson. */
export async function syncWhatsAppTemplates(businessId: string): Promise<WaConnectionStatus> {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { businessId } });
  if (!conn || conn.status === "disconnected") {
    throw new WhatsAppConnectError("לא נמצא חיבור וואטסאפ פעיל לעסק", "NOT_FOUND");
  }
  if (!conn.accessTokenEnc) {
    throw new WhatsAppConnectError("החיבור אינו פעיל — יש לחבר את המספר מחדש", "VALIDATION");
  }

  let token: string;
  try {
    token = decryptWhatsAppToken(conn.accessTokenEnc);
  } catch {
    await markWhatsAppConnectionError(businessId, "פענוח טוקן הגישה נכשל — יש לחבר את המספר מחדש");
    throw new WhatsAppConnectError("פענוח טוקן הגישה נכשל — יש לחבר את המספר מחדש", "EXTERNAL");
  }

  // Business side first — if we can't even read its templates the token is likely dead.
  const businessList = await fetchTemplates(conn.wabaId, token, "name,status,language");
  if (!businessList) {
    const msg = SYNC_ERR_PREFIX + "קריאת התבניות מחשבון ה-WhatsApp של העסק נכשלה";
    try {
      await prisma.whatsAppConnection.updateMany({ where: { id: conn.id }, data: { lastError: msg } });
    } catch { /* best effort */ }
    throw new WhatsAppConnectError("קריאת התבניות מחשבון ה-WhatsApp של העסק נכשלה — נסו שוב מאוחר יותר", "EXTERNAL");
  }
  const business = pickByName(businessList);
  const templates: Record<string, string> = {};
  for (const [name, t] of business) templates[name] = t.status ?? "UNKNOWN";

  // Platform side — source of truth for what to copy. Failure here is non-fatal (statuses still refresh).
  const platformToken = process.env.META_WHATSAPP_TOKEN?.trim();
  let platformApproved: MetaTemplate[] = [];
  let platformFetchFailed = false;
  if (platformToken) {
    const platformList = await fetchTemplates(getPlatformWabaId(), platformToken, "name,status,category,language,components");
    if (platformList) {
      platformApproved = [...pickByName(platformList.filter((t) => t.status === "APPROVED")).values()];
    } else {
      platformFetchFailed = true;
    }
  } else {
    platformFetchFailed = true;
  }
  if (platformFetchFailed) {
    console.warn(`${LOG} platform template fetch failed — skipping template copy for business ${businessId} (fallback names: ${PLATFORM_TEMPLATE_NAMES.length})`);
  }

  // Create whatever the business WABA is missing. Re-running is safe: existing names are skipped,
  // previous ERROR entries are retried (they are not in the business list).
  let created = 0;
  let failed = 0;
  for (const tpl of platformApproved) {
    if (business.has(tpl.name)) continue;
    const res = await graph<{ id?: string; status?: string }>(`/${conn.wabaId}/message_templates`, {
      method: "POST",
      token,
      body: {
        name: tpl.name,
        category: tpl.category ?? "UTILITY",
        language: tpl.language ?? "he",
        components: tpl.components ?? [],
      },
    });
    if (res.ok) {
      templates[tpl.name] = res.data?.status || "PENDING";
      created++;
    } else {
      templates[tpl.name] = `ERROR: ${res.error?.message ?? "unknown"}`.slice(0, 120);
      failed++;
    }
  }
  console.log(`${LOG} template sync for business ${businessId}: ${business.size} existing, ${created} created, ${failed} failed`);

  const clearSyncError = conn.lastError?.startsWith(SYNC_ERR_PREFIX) ?? false;
  await prisma.whatsAppConnection.updateMany({
    where: { id: conn.id },
    data: {
      templatesJson: JSON.stringify(templates),
      templatesSyncedAt: new Date(),
      ...(clearSyncError ? { lastError: null } : {}),
    },
  });

  return getWhatsAppConnectionStatus(businessId);
}

/** Mark disconnected, drop the token (overwrite with ""), best-effort unsubscribe app from WABA. */
export async function disconnectWhatsAppBusiness(businessId: string, userId: string): Promise<void> {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { businessId } });
  if (!conn) return;

  if (conn.accessTokenEnc) {
    try {
      const token = decryptWhatsAppToken(conn.accessTokenEnc);
      await graph(`/${conn.wabaId}/subscribed_apps`, { method: "DELETE", token }); // errors already logged, ignored
    } catch {
      // token undecryptable — nothing to unsubscribe with
    }
  }

  await prisma.whatsAppConnection.updateMany({
    where: { id: conn.id },
    data: { status: "disconnected", disconnectedAt: new Date(), accessTokenEnc: "", lastError: null },
  });
  console.log(`${LOG} business ${businessId} disconnected phone_number_id ${conn.phoneNumberId} by user ${userId}`);
}

/** Webhook routing: phone_number_id → businessId (null for the platform number / unknown). Includes disconnected rows — late statuses still route. */
export async function findBusinessIdByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  try {
    const row = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId },
      select: { businessId: true },
    });
    return row?.businessId ?? null;
  } catch (err) {
    console.error(`${LOG} findBusinessIdByPhoneNumberId failed:`, err);
    return null;
  }
}
