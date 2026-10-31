import type { useTranslations } from "next-intl";
import type { AgingBucket, LeadReportBasis, ResponseBucket } from "@/lib/analytics-types";
import { LEAD_SOURCES } from "@/lib/constants";
import { TRAFFIC_SOURCE_LABELS } from "@/lib/lead-attribution";
import { israelTodayYmd } from "@/lib/report-dates";

/** Translator of the `leads` namespace — every label below is a key under `leads.format.*`. */
export type LeadsT = ReturnType<typeof useTranslations<"leads">>;

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

/** `labelKey` / `hintKey` are keys of the `leads` namespace → render with `useTranslations("leads")`. */
export const RANGE_PRESETS: { id: RangePreset; labelKey: string }[] = [
  { id: "7d", labelKey: "format.rangePresets.d7" },
  { id: "30d", labelKey: "format.rangePresets.d30" },
  { id: "90d", labelKey: "format.rangePresets.quarter" },
  { id: "180d", labelKey: "format.rangePresets.halfYear" },
  { id: "365d", labelKey: "format.rangePresets.year" },
  { id: "5y", labelKey: "format.rangePresets.fiveYears" },
  { id: "custom", labelKey: "format.rangePresets.custom" },
];

export const BASIS_OPTIONS: { id: LeadReportBasis; labelKey: string; hintKey: string }[] = [
  { id: "cohort", labelKey: "format.basis.cohort.label", hintKey: "format.basis.cohort.hint" },
  { id: "activity", labelKey: "format.basis.activity.label", hintKey: "format.basis.activity.hint" },
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

/** "2026-03" → "מרץ 26". */
export function monthLabel(key: string, t: LeadsT): string {
  const [y, m] = key.split("-");
  const i = Number(m);
  const name = Number.isInteger(i) && i >= 1 && i <= 12 ? t(`format.months.m${i}`) : m;
  return `${name} ${y.slice(2)}`;
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Hours → "35 דק׳" (<1h) / "5.5 שעות" (<48h) / "3 ימים". */
export function formatDuration(hours: number | null, t: LeadsT): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) {
    const mins = Math.max(0, Math.round(hours * 60));
    return t("format.duration.minutes", { n: String(mins), count: mins });
  }
  if (hours < 48) {
    const n = round1(hours);
    return t("format.duration.hours", { n, count: Number(n) });
  }
  return formatDays(hours / 24, t);
}

export function formatDays(days: number | null, t: LeadsT): string {
  if (days == null || !Number.isFinite(days)) return "—";
  const n = round1(days);
  return t("format.duration.days", { n, count: Number(n) });
}

export function formatRate(rate: number | null): string {
  return rate == null ? "—" : `${rate}%`;
}

export function sourceLabel(id: string, t: LeadsT): string {
  return LEAD_SOURCES.find((s) => s.id === id)?.label ?? (id || t("format.sourceNotSpecified"));
}

export function trafficLabel(id: string, t: LeadsT): string {
  return (TRAFFIC_SOURCE_LABELS as Record<string, string>)[id] ?? (id || t("format.trafficUnknown"));
}

/** Message keys (`leads` namespace) — render with `responseBucketLabel()`. */
export const RESPONSE_BUCKET_LABELS: Record<ResponseBucket, string> = {
  lt1h: "format.responseBuckets.lt1h",
  "1to4h": "format.responseBuckets.h1to4",
  "4to24h": "format.responseBuckets.h4to24",
  "1to3d": "format.responseBuckets.d1to3",
  gt3d: "format.responseBuckets.gt3d",
  none: "format.responseBuckets.none",
};

/** Message keys (`leads` namespace) — render with `agingBucketLabel()`. */
export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  "0-7": "format.agingBuckets.d0to7",
  "8-14": "format.agingBuckets.d8to14",
  "15-30": "format.agingBuckets.d15to30",
  "31-60": "format.agingBuckets.d31to60",
  "60+": "format.agingBuckets.gt60",
};

export function responseBucketLabel(bucket: string, t: LeadsT): string {
  const key = (RESPONSE_BUCKET_LABELS as Record<string, string>)[bucket];
  return key ? t(key) : bucket;
}

export function agingBucketLabel(bucket: string, t: LeadsT): string {
  const key = (AGING_BUCKET_LABELS as Record<string, string>)[bucket];
  return key ? t(key) : bucket;
}
