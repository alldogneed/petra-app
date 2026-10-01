/**
 * Pure helpers for the business "ניהול ובקרה" activity log, its Excel export
 * and the AI (MCP) activity feed. No prisma import — unit-tested in
 * src/lib/__tests__/business-admin-activity.test.ts.
 *
 * Time zone: every day/month boundary is Israel time (Asia/Jerusalem), DST-correct.
 */

import { ACTIVITY_ACTIONS } from "./activity-actions";

const TZ = "Asia/Jerusalem";
const DAY_MS = 86_400_000;

export const ACTIVITY_PAGE_DEFAULT = 50;
export const ACTIVITY_PAGE_MAX = 100;
export const ACTIVITY_SEARCH_MAX = 100;
export const ACTIVITY_MAX_RANGE_DAYS = 366;
export const ACTIVITY_EXPORT_MAX_ROWS = 5000;
export const AI_ACTIVITY_WINDOW_DAYS = 90;
export const AI_ACTIVITY_TEXT_MAX = 200;
export const AI_ACTIVITY_STATUSES = ["success", "error", "denied"] as const;
export type AiActivityStatus = (typeof AI_ACTIVITY_STATUSES)[number];

const VALID_ACTIONS = new Set<string>(Object.values(ACTIVITY_ACTIONS));
/** ids are uuids / cuids — keep a strict charset so nothing odd reaches a query. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// ─── Israel time ──────────────────────────────────────────────────────────

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function israelParts(d: Date) {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(d)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Israel UTC offset in ms at the given instant (+2h winter, +3h summer). */
function israelOffsetMs(d: Date): number {
  const p = israelParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Strict YYYY-MM-DD validation (rejects 2026-02-30). */
export function parseYmd(s: string | null | undefined): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

/** YYYY-MM-DD of an instant, in Israel time. */
export function israelYmd(d: Date = new Date()): string {
  const p = israelParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * The real UTC instant of 00:00 Israel time on `ymd`. DST-correct: Israel
 * switches at 02:00 local, so local midnight is never skipped/ambiguous.
 */
export function israelMidnightUtc(ymd: string): Date {
  const base = Date.parse(`${ymd}T00:00:00.000Z`);
  let guess = base - israelOffsetMs(new Date(base));
  // Second pass in case the offset differs at the guessed instant.
  guess = base - israelOffsetMs(new Date(guess));
  return new Date(guess);
}

function addDaysYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Boundaries for the business overview KPIs, computed in Israel time. */
export function israelOverviewBoundaries(now: Date = new Date()) {
  const today = israelYmd(now);
  const monthYmd = `${today.slice(0, 7)}-01`;
  return {
    /** Appointment.date is stored as UTC midnight of the calendar day. */
    apptDayStart: new Date(`${today}T00:00:00.000Z`),
    apptDayEnd: new Date(`${addDaysYmd(today, 1)}T00:00:00.000Z`),
    /** Real instant of 00:00 Israel time on the 1st of the current month (for paidAt). */
    monthStart: israelMidnightUtc(monthYmd),
  };
}

/**
 * Inclusive Israel-day range → half-open UTC instant range [gte, lt).
 * Either side may be omitted. Returns an error string when invalid.
 */
export function israelDayRange(
  from: string | null | undefined,
  to: string | null | undefined
): { ok: true; gte?: Date; lt?: Date } | { ok: false; error: string } {
  const f = from ? parseYmd(from) : null;
  const t = to ? parseYmd(to) : null;
  if (from && !f) return { ok: false, error: "תאריך התחלה לא תקין" };
  if (to && !t) return { ok: false, error: "תאריך סיום לא תקין" };
  if (f && t) {
    if (f > t) return { ok: false, error: "תאריך ההתחלה אחרי תאריך הסיום" };
    const days = (Date.parse(`${t}T00:00:00Z`) - Date.parse(`${f}T00:00:00Z`)) / DAY_MS + 1;
    if (days > ACTIVITY_MAX_RANGE_DAYS) return { ok: false, error: `טווח מקסימלי ${ACTIVITY_MAX_RANGE_DAYS} ימים` };
  }
  return {
    ok: true,
    gte: f ? israelMidnightUtc(f) : undefined,
    lt: t ? israelMidnightUtc(addDaysYmd(t, 1)) : undefined,
  };
}

/** "01/10/2026 14:05" in Israel time. */
export function formatIsraelDateTime(d: Date | string): string {
  const p = israelParts(new Date(d));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

// ─── Keyset cursor ────────────────────────────────────────────────────────

export interface KeysetCursor {
  createdAt: Date;
  id: string;
}

/** Opaque cursor: base64url("<ISO createdAt>|<id>"). */
export function encodeCursor(row: { createdAt: Date | string; id: string }): string {
  const iso = new Date(row.createdAt).toISOString();
  return Buffer.from(`${iso}|${row.id}`, "utf8").toString("base64url");
}

/** Returns null for anything that isn't a cursor we produced. */
export function decodeCursor(raw: string | null | undefined): KeysetCursor | null {
  if (!raw || raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  let text: string;
  try {
    text = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sep = text.indexOf("|");
  if (sep <= 0) return null;
  const iso = text.slice(0, sep);
  const id = text.slice(sep + 1);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso)) return null;
  const createdAt = new Date(iso);
  if (isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) return null;
  if (!ID_RE.test(id)) return null;
  return { createdAt, id };
}

/** Prisma `where` fragment for rows strictly after the cursor in (createdAt desc, id desc) order. */
export function keysetAfter(c: KeysetCursor) {
  return {
    OR: [
      { createdAt: { lt: c.createdAt } },
      { createdAt: c.createdAt, id: { lt: c.id } },
    ],
  };
}

/** Split a take+1 fetch into the page and the next cursor. */
export function paginate<T extends { id: string; createdAt: Date | string }>(rows: T[], take: number) {
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null };
}

// ─── Query parsing ────────────────────────────────────────────────────────

type ParamSource = { get(name: string): string | null };

export function clampTake(raw: string | null | undefined, def = ACTIVITY_PAGE_DEFAULT): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(n, ACTIVITY_PAGE_MAX);
}

export interface ActivityQuery {
  userId: string | null;
  action: string | null;
  gte?: Date;
  lt?: Date;
  q: string | null;
  cursor: KeysetCursor | null;
  take: number;
}

export function parseActivityQuery(
  sp: ParamSource
): { ok: true; value: ActivityQuery } | { ok: false; error: string } {
  const userIdRaw = sp.get("userId")?.trim() || null;
  if (userIdRaw && !ID_RE.test(userIdRaw)) return { ok: false, error: "משתמש לא תקין" };

  const actionRaw = sp.get("action")?.trim() || null;
  if (actionRaw && !VALID_ACTIONS.has(actionRaw)) return { ok: false, error: "פעולה לא תקינה" };

  const range = israelDayRange(sp.get("from")?.trim() || null, sp.get("to")?.trim() || null);
  if (!range.ok) return range;

  // eslint-disable-next-line no-control-regex
  const qRaw = (sp.get("q") ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (qRaw.length > ACTIVITY_SEARCH_MAX) return { ok: false, error: `חיפוש עד ${ACTIVITY_SEARCH_MAX} תווים` };

  const cursorRaw = sp.get("cursor");
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return { ok: false, error: "cursor לא תקין" };

  return {
    ok: true,
    value: {
      userId: userIdRaw,
      action: actionRaw,
      gte: range.gte,
      lt: range.lt,
      q: qRaw || null,
      cursor,
      take: clampTake(sp.get("take")),
    },
  };
}

export interface AiActivityQuery {
  status: AiActivityStatus | null;
  connectionId: string | null;
  cursor: KeysetCursor | null;
  take: number;
}

export function parseAiActivityQuery(
  sp: ParamSource
): { ok: true; value: AiActivityQuery } | { ok: false; error: string } {
  const statusRaw = sp.get("status")?.trim() || null;
  if (statusRaw && !(AI_ACTIVITY_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: "סטטוס לא תקין" };
  }
  const connectionId = sp.get("connectionId")?.trim() || null;
  if (connectionId && !ID_RE.test(connectionId)) return { ok: false, error: "חיבור לא תקין" };
  const cursorRaw = sp.get("cursor");
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return { ok: false, error: "cursor לא תקין" };
  return {
    ok: true,
    value: { status: (statusRaw as AiActivityStatus | null), connectionId, cursor, take: clampTake(sp.get("take")) },
  };
}

// ─── Output hygiene ───────────────────────────────────────────────────────

/** Strip control/bidi chars, collapse whitespace, cap length. null when empty. */
export function cleanText(value: unknown, max = AI_ACTIVITY_TEXT_MAX): string | null {
  if (value == null) return null;
  const clean = String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f  ‪-‮⁦-⁩​-‏﻿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

/**
 * Spreadsheet formula-injection guard: a cell starting with = + - @ (or a
 * tab/CR that some apps strip first) is prefixed with a single quote.
 */
export function sanitizeXlsxCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Hebrew label of the entity type for the export "סוג" column. */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "לקוח",
  PET: "חיית מחמד",
  APPOINTMENT: "תור",
  ORDER: "הזמנה",
  PAYMENT: "תשלום",
  LEAD: "ליד",
  TASK: "משימה",
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  MEMBER: "עובד",
  SESSION: "סשן",
  SETTINGS: "הגדרות",
};

export function entityTypeLabel(t: string | null | undefined): string {
  if (!t) return "";
  return ENTITY_TYPE_LABELS[t] ?? t;
}
