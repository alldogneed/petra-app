/**
 * Availability blocks on the calendar grid (גבעת הכלבים 25/11/2026, א.40: blocks were saved but
 * never drawn). Pure: the part of a block that falls on one Israel day, clipped to the visible
 * hours, as "HH:mm" strings the grid already understands.
 */
const TZ = "Asia/Jerusalem";

function israelYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
function israelHm(d: Date): string {
  return d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
const toHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export interface CalendarBlock {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  userId?: string | null;
  user?: { id: string; name: string } | null;
}

export interface BlockSegment {
  startTime: string;
  endTime: string;
  /** The block covers the whole visible day. */
  fullDay: boolean;
}

/**
 * Segment of `block` on Israel day `day` ("YYYY-MM-DD"), clipped to [dayStartMin, dayEndMin].
 * null when the block does not touch the visible hours of that day.
 */
export function blockSegmentForDay(block: CalendarBlock, day: string, dayStartMin: number, dayEndMin: number): BlockSegment | null {
  const s = new Date(block.startAt);
  const e = new Date(block.endAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
  const sDay = israelYmd(s);
  const eDay = israelYmd(e);
  if (day < sDay || day > eDay) return null;
  const from = day === sDay ? toMin(israelHm(s)) : 0;
  // an end exactly at 00:00 belongs to the previous day
  let to = day === eDay ? toMin(israelHm(e)) : 24 * 60;
  if (day === eDay && to === 0) return null;
  if (to === 23 * 60 + 59) to = 24 * 60;
  const a = Math.max(from, dayStartMin);
  const b = Math.min(to, dayEndMin);
  if (b <= a) return null;
  return { startTime: toHm(a), endTime: toHm(b), fullDay: from <= dayStartMin && to >= dayEndMin };
}

/** Text on the block: "היעדרות: דור" for a member, else "חסום" + reason. */
export function blockLabel(block: CalendarBlock): string {
  if (block.user?.name) return `היעדרות: ${block.user.name}${block.reason ? ` · ${block.reason}` : ""}`;
  return block.reason ? `חסום · ${block.reason}` : "חסום";
}
