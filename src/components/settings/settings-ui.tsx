"use client";

import { Loader2, Lock, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified save bar for settings forms. Appears only when there are unsaved
 * changes; sticks to the bottom of the viewport so it's reachable on long tabs.
 */
export function SettingsSaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  canEdit = true,
  className,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  canEdit?: boolean;
  className?: string;
}) {
  if (!dirty || !canEdit) return null;
  return (
    <div
      role="region"
      aria-label="שמירת שינויים"
      className={cn(
        "sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-3 flex-wrap",
        "rounded-xl border border-amber-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg",
        className,
      )}
    >
      <span className="text-sm font-medium text-petra-text flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />
        יש שינויים שלא נשמרו
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary flex items-center gap-1.5 text-sm" onClick={onReset} disabled={saving}>
          <RotateCcw className="w-4 h-4" />
          בטל שינויים
        </button>
        <button type="button" className="btn-primary flex items-center gap-1.5 text-sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          שמור שינויים
        </button>
      </div>
    </div>
  );
}

/** Shown on settings tabs the current member may view but not change. */
export function ReadOnlyNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800",
        className,
      )}
    >
      <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>
        תצוגה בלבד — רק בעלי העסק, או מי שקיבל ממנו את ההרשאה &quot;לשנות הגדרות עסק&quot;, יכולים לשנות הגדרות אלה.
      </span>
    </div>
  );
}

/**
 * Wraps a form section; when `readOnly`, every input/select/button inside is
 * natively disabled (fieldset[disabled]).
 */
export function SettingsFieldset({ readOnly, children, className }: { readOnly: boolean; children: React.ReactNode; className?: string }) {
  return (
    <fieldset disabled={readOnly} className={cn("m-0 min-w-0 border-0 p-0", readOnly && "opacity-80", className)}>
      {children}
    </fieldset>
  );
}

/** Section heading used at the top of each tab. */
export function SettingsSectionHeader({ title, description, icon: Icon }: { title: string; description?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-petra-text flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-brand-500" />}
        {title}
      </h2>
      {description && <p className="text-sm text-petra-muted mt-0.5">{description}</p>}
    </div>
  );
}
