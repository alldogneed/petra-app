/**
 * Pure helpers for the customer card (GET /api/customers/[id] + its paged sub-resources).
 * No Prisma / no I/O — unit-tested in src/lib/__tests__/customer-summary.test.ts.
 */

import { israelTodayYmd } from "@/lib/report-dates";

// ─── Appointment statuses ─────────────────────────────────────────────────────

/** Both spellings exist in old rows. */
export const CANCELED_APPOINTMENT_STATUSES = ["canceled", "cancelled"] as const;
/** Not a "visit": canceled or the customer never showed up. */
export const NON_VISIT_APPOINTMENT_STATUSES = [...CANCELED_APPOINTMENT_STATUSES, "no_show"] as const;

// ─── Paging ───────────────────────────────────────────────────────────────────

/** Clamp a `take` query param to [1, max], falling back to `def` on junk. */
export function clampTake(raw: string | number | null | undefined, def: number, max: number): number {
  const n = typeof raw === "number" ? raw : raw == null || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

/** Cursor ids are uuids/cuids — reject anything else before it reaches Prisma. */
export function parseCursor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s.length > 64 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  return s;
}

export type AppointmentScope = "upcoming" | "past";

export function parseAppointmentScope(raw: string | null | undefined): AppointmentScope | null {
  if (raw == null || raw === "") return "upcoming";
  return raw === "upcoming" || raw === "past" ? raw : null;
}

/**
 * Rows fetched with `take + 1` → the page + the next cursor (id of the last row on
 * the page) when there is more.
 */
export function pageOf<T extends { id: string }>(rows: T[], take: number): { items: T[]; nextCursor: string | null } {
  if (rows.length > take) {
    const items = rows.slice(0, take);
    return { items, nextCursor: items[items.length - 1].id };
  }
  return { items: rows, nextCursor: null };
}

// ─── Israel time ──────────────────────────────────────────────────────────────

/** Israel "today" as UTC midnight of the Israel YMD (how Appointment.date is stored) + the next day. */
export function israelTodayBounds(now: Date = new Date()): { todayStart: Date; tomorrowStart: Date } {
  const ymd = israelTodayYmd(now);
  const todayStart = new Date(`${ymd}T00:00:00.000Z`);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return { todayStart, tomorrowStart };
}

/** Israel wall-clock "HH:MM" (24h) — comparable with Appointment.startTime strings. */
export function israelNowHHMM(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

// ─── Timeline notes ───────────────────────────────────────────────────────────

/** Only manual notes may be edited / deleted from the card. */
export const EDITABLE_TIMELINE_TYPES = ["note", "MANUAL_NOTE"] as const;

export function isEditableTimelineType(type: string | null | undefined): boolean {
  return !!type && (EDITABLE_TIMELINE_TYPES as readonly string[]).includes(type);
}

export const MAX_NOTE_LENGTH = 2000;

/** Trim + validate a note body. Returns the clean text or a Hebrew error. */
export function validateNoteDescription(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "נדרש תוכן להערה" };
  const value = raw.trim();
  if (value.length > MAX_NOTE_LENGTH) return { ok: false, error: `תיאור ארוך מדי (עד ${MAX_NOTE_LENGTH} תווים)` };
  return { ok: true, value };
}

// ─── Money redaction (caller without FINANCE_READ) ───────────────────────────

interface MoneyOrderLine { unitPrice: number; lineSubtotal: number; lineTotal: number }
interface MoneyOrderPayment { amount: number }
interface MoneyOrder {
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  lines: MoneyOrderLine[];
  payments: MoneyOrderPayment[];
}

/**
 * Strip money from a customer card: payments → [], order money fields → 0,
 * summary.balance → null. Shapes stay identical so the client never branches on type.
 */
export function redactCustomerMoney<
  C extends { payments: unknown[]; orders: MoneyOrder[]; summary: { balance: unknown } }
>(customer: C): C {
  return {
    ...customer,
    payments: [],
    orders: customer.orders.map((o) => ({
      ...o,
      subtotal: 0,
      discountAmount: 0,
      taxTotal: 0,
      total: 0,
      lines: o.lines.map((l) => ({ ...l, unitPrice: 0, lineSubtotal: 0, lineTotal: 0 })),
      payments: o.payments.map((p) => ({ ...p, amount: 0 })),
    })),
    summary: { ...customer.summary, balance: null },
  };
}

// ─── Text helpers (MCP get_client) ────────────────────────────────────────────

/** "₪1,234.5" style amount for tool output (he-IL grouping). */
export function formatShekel(n: number): string {
  return `₪${(Math.round(n * 100) / 100).toLocaleString("he-IL")}`;
}
