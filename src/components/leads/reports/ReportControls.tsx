"use client";

import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { cn } from "@/lib/utils";
import type { LeadReportBasis } from "@/lib/analytics-types";
import { BASIS_OPTIONS, RANGE_PRESETS, type RangePreset } from "./format";

interface ReportControlsProps {
  preset: RangePreset;
  onPresetChange: (p: RangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  customError: string | null;
  basis: LeadReportBasis;
  onBasisChange: (b: LeadReportBasis) => void;
}

export function ReportControls({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  customError,
  basis,
  onBasisChange,
}: ReportControlsProps) {
  const t = useTranslations("leads.reportControls");
  const tl = useTranslations("leads");
  const { cfg } = useBusinessLocale();
  const basisHintKey = BASIS_OPTIONS.find((b) => b.id === basis)?.hintKey;
  const basisHint = basisHintKey ? tl(basisHintKey) : undefined;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarRange className="w-4 h-4 text-brand-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-petra-text">{t("dateRange")}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {RANGE_PRESETS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPresetChange(r.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1",
              preset === r.id ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-petra-muted hover:bg-slate-200"
            )}
          >
            {r.id === "custom" && <CalendarRange className="w-3 h-3" />}
            {tl(r.labelKey)}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-[11px] font-medium text-petra-muted block mb-1">{t("fromDate")}</label>
              <input
                type="date"
                lang={cfg.lang}
                className="input h-9 text-sm w-36"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => onCustomFromChange(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-petra-muted block mb-1">{t("toDate")}</label>
              <input
                type="date"
                lang={cfg.lang}
                className="input h-9 text-sm w-36"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => onCustomToChange(e.target.value)}
              />
            </div>
          </div>
          {customError && <p className="text-xs text-red-600">{customError}</p>}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 space-y-1.5">
        <div className="inline-flex max-w-full rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label={t("basisAriaLabel")}>
          {BASIS_OPTIONS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={basis === b.id}
              onClick={() => onBasisChange(b.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                basis === b.id ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
              )}
            >
              {tl(b.labelKey)}
            </button>
          ))}
        </div>
        {basisHint && <p className="text-xs text-petra-muted">{basisHint}</p>}
      </div>
    </div>
  );
}
