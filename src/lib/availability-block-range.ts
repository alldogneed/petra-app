/**
 * Availability blocks (AvailabilityBlock) — pure helpers shared by the block APIs, the
 * settings UI and MCP. `userId` null = the whole business (closes online booking);
 * set = one member's absence (shown on the calendar, does NOT close online booking).
 * גבעת הכלבים 25/11/2026, א.40.
 */
import { isYmd, israelDayStart, israelDayEnd } from "./report-dates";

/** Longest `from`..`to` window `GET /api/booking/blocks` accepts (inclusive days). */
export const MAX_BLOCK_RANGE_DAYS = 62;

export type BlockRangeResult =
  | { ok: true; start: Date; end: Date }
  | { ok: false; error: string };

/**
 * Parses `from` / `to` ("YYYY-MM-DD", Israel days, both inclusive). Both must be given
 * together; `to` ≥ `from`; at most MAX_BLOCK_RANGE_DAYS days.
 */
export function parseBlockRange(from: string | null, to: string | null): BlockRangeResult {
  if (!from || !to) return { ok: false, error: "יש לשלוח from ו-to יחד (YYYY-MM-DD)" };
  if (!isYmd(from) || !isYmd(to)) return { ok: false, error: "תאריך לא תקין (YYYY-MM-DD)" };
  if (to < from) return { ok: false, error: "תאריך הסיום לפני תאריך ההתחלה" };
  const days =
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > MAX_BLOCK_RANGE_DAYS) {
    return { ok: false, error: `טווח מקסימלי ${MAX_BLOCK_RANGE_DAYS} ימים` };
  }
  return { ok: true, start: israelDayStart(from), end: israelDayEnd(to) };
}

/** Prisma `include` for a block as the APIs return it: the member, id + name only. */
export const BLOCK_USER_INCLUDE = {
  user: { select: { id: true, name: true } },
} as const;

export interface BlockOwner {
  userId?: string | null;
  user?: { id: string; name: string | null } | null;
}

/** "" for a whole-business block; the member's name (or a fallback) for an absence. */
export function blockMemberName(block: BlockOwner): string {
  if (!block.userId) return "";
  return block.user?.name?.trim() || "איש צוות";
}
