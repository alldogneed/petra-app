/**
 * Owner security alerts — pure logic (client-safe: no prisma, no network).
 *
 * - Prefs shape + parser/normalizer (Business.securityAlertPrefs, null = defaults)
 * - Rule matching: activity action → candidate rule keys
 * - Bulk-delete threshold, new-device decision, in-memory rate limiter
 * - Alert content builder (subject / plain text / escaped RTL HTML)
 * - createSecurityAlertDispatcher(deps): the whole decision flow with injected
 *   I/O, so tests can prove a non-sensitive action does zero DB work.
 *
 * Wiring (prisma, Resend, WhatsApp): src/lib/security-alerts.ts.
 */
import { actionLabel } from "./activity-actions";

// ─── Prefs ──────────────────────────────────────────────────────────────────

export const SECURITY_ALERT_RULE_KEYS = [
  "deleteCustomer",
  "exportData",
  "paymentCancelRefund",
  "bulkDelete",
  "newDeviceLogin",
  "permissionChange",
] as const;
export type SecurityAlertRuleKey = (typeof SECURITY_ALERT_RULE_KEYS)[number];

export interface SecurityAlertPrefs {
  enabled: boolean;
  email: boolean;
  whatsapp: boolean;
  includeOwnActions: boolean;
  rules: Record<SecurityAlertRuleKey, boolean>;
}

export const DEFAULT_SECURITY_ALERT_PREFS: SecurityAlertPrefs = {
  enabled: true,
  email: true,
  whatsapp: false,
  includeOwnActions: false,
  rules: {
    deleteCustomer: true,
    exportData: true,
    paymentCancelRefund: true,
    bulkDelete: true,
    newDeviceLogin: false,
    permissionChange: true,
  },
};

/** Hebrew title + explanation per rule (UI + email). */
export const SECURITY_ALERT_RULE_INFO: Record<SecurityAlertRuleKey, { title: string; description: string }> = {
  deleteCustomer: {
    title: "מחיקת לקוח",
    description: "עובד/ת מחק/ה כרטיס לקוח (כולל חיות, תורים ותשלומים שלו).",
  },
  exportData: {
    title: "ייצוא נתונים",
    description: "ייצוא רשימת לקוחות, נתונים או יומן הפעילות לקובץ.",
  },
  paymentCancelRefund: {
    title: "ביטול / החזר / מחיקת תשלום",
    description: "תשלום בוטל, הוחזר או נמחק.",
  },
  bulkDelete: {
    title: "מחיקות רבות ברצף",
    description: "אותו משתמש מחק 5 פריטים או יותר בתוך 10 דקות (התראה אחת לכל רצף).",
  },
  newDeviceLogin: {
    title: "כניסה ממכשיר חדש",
    description: "כניסה למערכת מדפדפן/מכשיר שלא נראה אצל המשתמש ב-90 הימים האחרונים (כולל בעלים).",
  },
  permissionChange: {
    title: "שינוי הרשאות / תפקיד",
    description: "מישהו שאינו בעל העסק שינה תפקיד, הרשאות, או השבית/הפעיל עובד.",
  },
};

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * Parse + normalize stored/submitted prefs. Never throws.
 * Unknown keys are dropped; missing/invalid values fall back to defaults.
 * Accepts a JSON string too (defensive — Json columns are sometimes double-encoded).
 */
export function parseSecurityAlertPrefs(raw: unknown): SecurityAlertPrefs {
  let obj: unknown = raw;
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { obj = null; }
  }
  const d = DEFAULT_SECURITY_ALERT_PREFS;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ...d, rules: { ...d.rules } };
  }
  const o = obj as Record<string, unknown>;
  const r = o.rules && typeof o.rules === "object" && !Array.isArray(o.rules)
    ? (o.rules as Record<string, unknown>)
    : {};
  const rules = {} as Record<SecurityAlertRuleKey, boolean>;
  for (const k of SECURITY_ALERT_RULE_KEYS) rules[k] = bool(r[k], d.rules[k]);
  return {
    enabled: bool(o.enabled, d.enabled),
    email: bool(o.email, d.email),
    whatsapp: bool(o.whatsapp, d.whatsapp),
    includeOwnActions: bool(o.includeOwnActions, d.includeOwnActions),
    rules,
  };
}

// ─── Rule matching ──────────────────────────────────────────────────────────

const EXPORT_ACTIONS = new Set(["EXPORT_CUSTOMERS", "EXPORT_DATA", "EXPORT_ACTIVITY"]);
const PAYMENT_ACTIONS = new Set(["CANCEL_PAYMENT", "REFUND_PAYMENT", "DELETE_PAYMENT"]);
const PERMISSION_ACTIONS = new Set([
  "UPDATE_MEMBER_PERMISSIONS", "UPDATE_MEMBER_ROLE", "DEACTIVATE_MEMBER", "ACTIVATE_MEMBER",
]);

export function isDeleteAction(action: string): boolean {
  return action.startsWith("DELETE_");
}

/**
 * Rules an action can trigger (before prefs / actor / history checks).
 * Empty array = not alertable → the caller must return before any DB query.
 * Order = alert priority (first matched rule names the alert).
 */
export function candidateRulesForAction(action: string): SecurityAlertRuleKey[] {
  const out: SecurityAlertRuleKey[] = [];
  if (isDeleteAction(action)) out.push("bulkDelete");
  if (action === "DELETE_CUSTOMER") out.push("deleteCustomer");
  if (PAYMENT_ACTIONS.has(action)) out.push("paymentCancelRefund");
  if (EXPORT_ACTIONS.has(action)) out.push("exportData");
  if (PERMISSION_ACTIONS.has(action)) out.push("permissionChange");
  if (action === "LOGIN") out.push("newDeviceLogin");
  return out;
}

export function isAlertableAction(action: string): boolean {
  return candidateRulesForAction(action).length > 0;
}

/**
 * Static action list for the in-app "פעולות רגישות אחרונות" query (LOGIN handled separately
 * because "new device" needs history). DELETE_* is matched by prefix in the query.
 */
export const RECENT_STATIC_ACTIONS: string[] = [
  "DELETE_CUSTOMER",
  ...EXPORT_ACTIONS,
  ...PAYMENT_ACTIONS,
  ...PERMISSION_ACTIONS,
];

// ─── Bulk delete ────────────────────────────────────────────────────────────

export const BULK_DELETE_THRESHOLD = 5;
export const BULK_DELETE_WINDOW_MS = 10 * 60 * 1000;

/**
 * `count` = DELETE_* rows by the same user in this business within the window,
 * up to and including the row being processed. Fires exactly once per burst.
 */
export function isBulkDeleteTrigger(count: number): boolean {
  return count === BULK_DELETE_THRESHOLD;
}

// ─── New device ─────────────────────────────────────────────────────────────

export const NEW_DEVICE_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
export const NEW_DEVICE_GRACE_MS = 24 * 60 * 60 * 1000;
export const NEW_DEVICE_SESSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const UNKNOWN_DEVICE_LABEL = "מכשיר לא ידוע";

/**
 * New-device decision from the user's earlier labeled LOGIN devices (in the lookback window).
 * A user with NO labeled history is not flagged: device labels only exist on LOGIN rows
 * written after the 2026-10 activity-log upgrade, so without history we can't tell
 * "new device" from "first login we ever recorded". Unknown UA is never "new".
 */
export function isNewDevice(device: string | null | undefined, priorDevices: (string | null)[]): boolean {
  if (!device || device === UNKNOWN_DEVICE_LABEL) return false;
  const labeled = priorDevices.filter((d): d is string => !!d);
  if (labeled.length === 0) return false;
  return !labeled.includes(device);
}

export interface LoginRow {
  userId: string;
  entityLabel: string | null;
  createdAt: Date;
}

/**
 * Session list badge: session created in the last 7 days AND no LOGIN row for that user
 * with the same device older than 24h before the session (within 90 days before it).
 */
export function isNewDeviceSession(
  session: { userId: string; createdAt: Date; device: string },
  logins: LoginRow[],
  now: Date
): boolean {
  const created = session.createdAt.getTime();
  if (now.getTime() - created > NEW_DEVICE_SESSION_WINDOW_MS) return false;
  const from = created - NEW_DEVICE_LOOKBACK_MS;
  const to = created - NEW_DEVICE_GRACE_MS;
  const prior = logins
    .filter((l) => l.userId === session.userId)
    .filter((l) => { const t = l.createdAt.getTime(); return t >= from && t < to; })
    .map((l) => l.entityLabel);
  return isNewDevice(session.device, prior);
}

/**
 * From LOGIN rows (ascending or not), return those created at/after `since` that were a
 * new device for the user at the time (same rule as the live alert).
 */
export function pickNewDeviceLogins<T extends LoginRow & { id: string }>(rows: T[], since: Date): T[] {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const out: T[] = [];
  // userId → device label → last time seen (O(n × devices) instead of O(n²)).
  const seen = new Map<string, Map<string, number>>();
  for (const row of sorted) {
    const t = row.createdAt.getTime();
    let devices = seen.get(row.userId);
    if (!devices) { devices = new Map(); seen.set(row.userId, devices); }
    if (row.createdAt >= since) {
      const prior: string[] = [];
      for (const [label, last] of devices) if (last >= t - NEW_DEVICE_LOOKBACK_MS) prior.push(label);
      if (isNewDevice(row.entityLabel, prior)) out.push(row);
    }
    if (row.entityLabel) devices.set(row.entityLabel, t);
  }
  return out;
}

// ─── Rate limit ─────────────────────────────────────────────────────────────

export const ALERTS_PER_BUSINESS_PER_HOUR = 20;

/**
 * Fixed-window counter (1h buckets). In-memory → per serverless instance, so the real
 * ceiling is 20 × (warm instances). Good enough to stop an alert storm; not a hard quota.
 */
export function createAlertRateLimiter(max = ALERTS_PER_BUSINESS_PER_HOUR, windowMs = 60 * 60 * 1000) {
  const buckets = new Map<string, { window: number; count: number }>();
  return {
    /** true = allowed (and counted). */
    take(key: string, now: number = Date.now()): boolean {
      const window = Math.floor(now / windowMs);
      const b = buckets.get(key);
      if (!b || b.window !== window) {
        if (buckets.size > 5000) buckets.clear(); // bound memory
        buckets.set(key, { window, count: 1 });
        return true;
      }
      if (b.count >= max) return false;
      b.count++;
      return true;
    },
  };
}

// ─── Content ────────────────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function formatIsraelDateTime(d: Date): string {
  return d.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export interface AlertContentInput {
  rule: SecurityAlertRuleKey;
  action: string;
  actorName: string;
  entityLabel: string | null;
  businessName: string;
  at: Date;
  appUrl: string;
}

export function buildAlertContent(i: AlertContentInput): { subject: string; text: string; html: string } {
  const what = i.rule === "bulkDelete"
    ? `ביצע/ה ${BULK_DELETE_THRESHOLD} מחיקות ומעלה בתוך 10 דקות`
    : i.rule === "newDeviceLogin"
      ? "התחבר/ה ממכשיר חדש"
      : actionLabel(i.action);
  const ruleTitle = SECURITY_ALERT_RULE_INFO[i.rule].title;
  const when = formatIsraelDateTime(i.at);
  const link = `${i.appUrl.replace(/\/+$/, "")}/business-admin`;
  // Subject is a header, not HTML — strip CR/LF just in case.
  const subject = `התראת אבטחה — ${i.businessName}: ${i.actorName} ${what}`.replace(/[\r\n]+/g, " ");
  const text =
    `התראת אבטחה — ${i.businessName}\n\n` +
    `${i.actorName} ${what}` + (i.entityLabel ? `\nפריט: ${i.entityLabel}` : "") +
    `\nסוג: ${ruleTitle}\nמתי: ${when}\n\nלפרטים: ${link}`;
  const row = (k: string, v: string) =>
    `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 4px;color:#64748b;font-size:13px;width:90px;">${k}</td><td style="padding:8px 4px;color:#1e293b;">${v}</td></tr>`;
  const html = `
<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;text-align:right;">
  <div style="background:#1e293b;padding:18px 24px;border-radius:8px 8px 0 0;text-align:center;">
    <h2 style="color:#fb923c;margin:0;font-size:19px;">התראת אבטחה — ${escapeHtml(i.businessName)}</h2>
  </div>
  <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;"><strong>${escapeHtml(i.actorName)}</strong> ${escapeHtml(what)}</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row("סוג", escapeHtml(ruleTitle))}
      ${i.entityLabel ? row("פריט", escapeHtml(i.entityLabel)) : ""}
      ${row("מתי", escapeHtml(when))}
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#f97316;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">לניהול ובקרה</a>
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">ניתן לשנות את ההתראות בניהול ובקרה ← התראות אבטחה.</p>
  </div>
</div>`;
  return { subject, text, html };
}

// ─── Dispatcher (decision flow with injected I/O) ───────────────────────────

export interface AlertEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: Date;
  businessId: string | null;
  entityLabel: string | null;
}

export interface AlertBusiness {
  name: string;
  /** Tier (effective, with overrides) includes `staff_management`. */
  tierAllowed: boolean;
  prefsRaw: unknown;
  phone: string | null;
}

export interface SecurityAlertDeps {
  loadBusiness(businessId: string): Promise<AlertBusiness | null>;
  isOwner(businessId: string, userId: string): Promise<boolean>;
  /** DELETE_* rows by user in business with since < createdAt <= until. */
  countRecentDeletes(businessId: string, userId: string, since: Date, until: Date): Promise<number>;
  /** Distinct entityLabel of the user's LOGIN rows in business, createdAt in [since, before), excluding id. */
  priorLoginDevices(businessId: string, userId: string, since: Date, before: Date, excludeId: string): Promise<(string | null)[]>;
  ownerEmails(businessId: string): Promise<string[]>;
  sendEmail(to: string[], subject: string, html: string): Promise<void>;
  sendWhatsApp(businessId: string, phone: string, text: string): Promise<void>;
  rateLimit(businessId: string): boolean;
  appUrl(): string;
  log?(msg: string, err?: unknown): void;
}

/** Returns the rule that fired (for tests/logging) or null. Never throws. */
export function createSecurityAlertDispatcher(deps: SecurityAlertDeps) {
  const log = deps.log ?? ((m: string, e?: unknown) => console.error(m, e ?? ""));
  return async function dispatch(entry: AlertEntry): Promise<SecurityAlertRuleKey | null> {
    // Fast path — no I/O for non-sensitive actions.
    if (!entry.businessId) return null;
    const candidates = candidateRulesForAction(entry.action);
    if (candidates.length === 0) return null;
    const businessId = entry.businessId;

    try {
      const biz = await deps.loadBusiness(businessId);
      if (!biz || !biz.tierAllowed) return null;
      const prefs = parseSecurityAlertPrefs(biz.prefsRaw);
      if (!prefs.enabled || (!prefs.email && !prefs.whatsapp)) return null;
      const enabled = candidates.filter((r) => prefs.rules[r]);
      if (enabled.length === 0) return null;

      const actorIsOwner = await deps.isOwner(businessId, entry.userId);
      let fired: SecurityAlertRuleKey | null = null;
      for (const rule of enabled) {
        if (rule !== "newDeviceLogin" && actorIsOwner && !prefs.includeOwnActions) continue;
        if (rule === "permissionChange" && actorIsOwner) continue;
        if (rule === "bulkDelete") {
          const n = await deps.countRecentDeletes(
            businessId, entry.userId,
            new Date(entry.createdAt.getTime() - BULK_DELETE_WINDOW_MS), entry.createdAt
          );
          if (!isBulkDeleteTrigger(n)) continue;
        }
        if (rule === "newDeviceLogin") {
          const prior = await deps.priorLoginDevices(
            businessId, entry.userId,
            new Date(entry.createdAt.getTime() - NEW_DEVICE_LOOKBACK_MS), entry.createdAt, entry.id
          );
          if (!isNewDevice(entry.entityLabel, prior)) continue;
        }
        fired = rule;
        break;
      }
      if (!fired) return null;

      if (!deps.rateLimit(businessId)) {
        log(`[security-alerts] rate limit reached for business ${businessId} — alert dropped`);
        return null;
      }

      const content = buildAlertContent({
        rule: fired,
        action: entry.action,
        actorName: entry.userName,
        entityLabel: entry.entityLabel,
        businessName: biz.name,
        at: entry.createdAt,
        appUrl: deps.appUrl(),
      });

      const sends: Promise<void>[] = [];
      if (prefs.email) {
        sends.push((async () => {
          const to = await deps.ownerEmails(businessId);
          if (to.length) await deps.sendEmail(to, content.subject, content.html);
        })().catch((e) => log("[security-alerts] email failed:", e)));
      }
      if (prefs.whatsapp && biz.phone) {
        sends.push(deps.sendWhatsApp(businessId, biz.phone, content.text)
          .catch((e) => log("[security-alerts] whatsapp failed:", e)));
      }
      await Promise.all(sends);
      return fired;
    } catch (err) {
      log("[security-alerts] dispatch failed:", err);
      return null;
    }
  };
}
