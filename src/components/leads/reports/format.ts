import type { AgingBucket, LeadReportBasis, ResponseBucket } from "@/lib/analytics-types";
import { LEAD_SOURCES } from "@/lib/constants";
import { TRAFFIC_SOURCE_LABELS } from "@/lib/lead-attribution";
import { israelTodayYmd } from "@/lib/report-dates";

export const CHART_COLORS = ["#6366F1", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

export type RangePreset = "7d" | "30d" | "90d" | "180d" | "365d" | "5y" | "custom";

/** Inclusive length in days of each preset (the range always ends today, Israel time). */
const PRESET_DAYS: Record<Exclude<RangePreset, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
  "5y": 1825, // server caps the range at 5 years
};

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "7d", label: "7 ימים" },
  { id: "30d", label: "30 יום" },
  { id: "90d", label: "רבעון" },
  { id: "180d", label: "חצי שנה" },
  { id: "365d", label: "שנה" },
  { id: "5y", label: "5 שנים" },
  { id: "custom", label: "מותאם" },
];

export const BASIS_OPTIONS: { id: LeadReportBasis; label: string; hint: string }[] = [
  {
    id: "cohort",
    label: "לידים שנוצרו בתקופה",
    hint: "כל הנתונים מתייחסים ללידים שנוצרו בטווח — נסגרו/אבדו לפי המצב הנוכחי שלהם.",
  },
  {
    id: "activity",
    label: "פעילות בתקופה",
    hint: "מה קרה בטווח: לידים שנוצרו בו, נסגרו בו (תאריך זכייה) ואבדו בו (תאריך אובדן).",
  },
];

/** Shift a "YYYY-MM-DD" by `days` (calendar arithmetic, timezone-free). */
export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function presetRange(preset: Exclude<RangePreset, "custom">, now: Date = new Date()): { from: string; to: string } {
  const to = israelTodayYmd(now);
  return { from: addDaysYmd(to, -(PRESET_DAYS[preset] - 1)), to };
}

/** "2026-03-07" → "07/03/26". */
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

/** "2026-03" → "מרץ 26". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_HE[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Hours → "35 דק׳" (<1h) / "5.5 שעות" (<48h) / "3 ימים". */
export function formatDuration(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} דק׳`;
  if (hours < 48) return `${round1(hours)} שעות`;
  return `${round1(hours / 24)} ימים`;
}

export function formatDays(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return "—";
  return `${round1(days)} ימים`;
}

export function formatRate(rate: number | null): string {
  return rate == null ? "—" : `${rate}%`;
}

export function sourceLabel(id: string): string {
  return LEAD_SOURCES.find((s) => s.id === id)?.label ?? (id || "לא צוין");
}

export function trafficLabel(id: string): string {
  return (TRAFFIC_SOURCE_LABELS as Record<string, string>)[id] ?? (id || "לא ידוע");
}

export const RESPONSE_BUCKET_LABELS: Record<ResponseBucket, string> = {
  lt1h: "עד שעה",
  "1to4h": "1–4 שעות",
  "4to24h": "4–24 שעות",
  "1to3d": "1–3 ימים",
  gt3d: "מעל 3 ימים",
  none: "ללא מענה",
};

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  "0-7": "0–7 ימים",
  "8-14": "8–14 ימים",
  "15-30": "15–30 ימים",
  "31-60": "31–60 ימים",
  "60+": "מעל 60 ימים",
};
