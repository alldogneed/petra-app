/**
 * Drag-and-drop on the boarding timeline ("ציר זמן"): pure helpers that turn a drop
 * (whole-day offset + target row) into the PATCH /api/boarding/[id] payload.
 * Client-safe, no DB. Times are Israel wall-clock: a stay that checks in at 14:00
 * still checks in at 14:00 after moving, also across a DST switch.
 */

const ISRAEL_TZ = "Asia/Jerusalem";

const PARTS_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISRAEL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface WallClock { y: number; m: number; d: number; hh: number; mi: number; ss: number }

function israelWallClock(at: Date): WallClock {
  const parts = PARTS_FMT.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour") % 24, mi: get("minute"), ss: get("second") };
}

/** Israel UTC offset (ms) at an instant. */
function israelOffsetMs(at: Date): number {
  const w = israelWallClock(at);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mi, w.ss);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Israel wall-clock → instant (offset taken at that wall time). */
function israelWallToInstant(w: WallClock, ms: number): Date {
  const naive = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mi, w.ss, ms);
  // Two passes: the offset at the guess, then at the corrected instant (DST-safe
  // outside the switch hour itself).
  let t = naive - israelOffsetMs(new Date(naive));
  t = naive - israelOffsetMs(new Date(t));
  return new Date(t);
}

/** Move an instant by whole Israel calendar days, keeping its Israel time of day. */
export function shiftIsoByIsraelDays(iso: string, days: number): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) throw new Error("invalid date");
  if (!days) return at.toISOString();
  const w = israelWallClock(at);
  const day = new Date(Date.UTC(w.y, w.m - 1, w.d + days));
  return israelWallToInstant(
    { ...w, y: day.getUTCFullYear(), m: day.getUTCMonth() + 1, d: day.getUTCDate() },
    at.getUTCMilliseconds(),
  ).toISOString();
}

/** Whole-day offset of a horizontal drag (LTR track: positive = later). */
export function dragDayDelta(dxPx: number, dayWidthPx: number): number {
  if (!dayWidthPx || !Number.isFinite(dxPx)) return 0;
  const n = Math.round(dxPx / dayWidthPx);
  return n === 0 ? 0 : n; // avoid -0
}

/** Only upcoming / current stays move; canceled and checked-out stays stay put. */
export function isStayDraggable(status: string): boolean {
  return status === "reserved" || status === "checked_in";
}

export const UNASSIGNED_ROW = "unassigned";

export interface StayMoveInput {
  checkIn: string;
  checkOut: string | null;
  /** Current room id (null = no room). */
  roomId: string | null;
}

export interface StayMovePatch {
  roomId?: string | null;
  checkIn?: string;
  checkOut?: string | null;
}

/**
 * PATCH body for a drop: only the fields that change. Both ends shift by the same
 * number of days (length + times kept); an open-ended stay shifts its check-in only.
 * `targetRow` = a room id or UNASSIGNED_ROW. Returns null when nothing changes.
 */
export function buildStayMovePatch(stay: StayMoveInput, dayDelta: number, targetRow: string): StayMovePatch | null {
  const targetRoomId = targetRow === UNASSIGNED_ROW ? null : targetRow;
  const patch: StayMovePatch = {};
  if (targetRoomId !== (stay.roomId ?? null)) patch.roomId = targetRoomId;
  if (dayDelta) {
    patch.checkIn = shiftIsoByIsraelDays(stay.checkIn, dayDelta);
    if (stay.checkOut) patch.checkOut = shiftIsoByIsraelDays(stay.checkOut, dayDelta);
  }
  return Object.keys(patch).length ? patch : null;
}
