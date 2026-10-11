/**
 * Order start/end times arrive from the order form as Israel wall-clock strings with no
 * offset ("2026-07-16T18:00:00"). `new Date(s)` on the server (UTC on Vercel) stored them
 * as 18:00Z = 21:00 Israel in summer — orders showed 3h (winter: 2h) later than their
 * appointment. A string WITHOUT an offset is the business's local time; a string WITH
 * `Z` / `±HH:MM` is already an instant and is kept as is.
 */
import { localTimeToUtc } from "@/lib/slots";

const LOCAL_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/;
const LOCAL_DATE = /^(\d{4}-\d{2}-\d{2})$/;

export function parseOrderDateTime(
  value: string | null | undefined,
  timezone: string = "Asia/Jerusalem"
): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const s = value.trim();
  const dt = LOCAL_DATETIME.exec(s);
  if (dt) return localTimeToUtc(`${dt[2]}:${dt[3]}`, dt[1], timezone);
  const d = LOCAL_DATE.exec(s);
  if (d) return localTimeToUtc("00:00", d[1], timezone);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
