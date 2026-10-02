"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Save, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import { SdSettings, DEFAULT_SD_SETTINGS, SD_VACCINE_TREATMENTS, SD_PUPPY_TREATMENTS, HE_MONTHS_SETTINGS, PUPPY_WEEKS_OPTIONS, Business } from "./shared";

// ─── Service Dogs Settings Tab ───────────────────────────────────────────────

export function ServiceDogsSettingsTab() {
  const queryClient = useQueryClient();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [form, setForm] = useState<SdSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const settings: SdSettings = form ?? (biz?.sdSettings ? { ...DEFAULT_SD_SETTINGS, ...biz.sdSettings } : DEFAULT_SD_SETTINGS);

  const mutation = useMutation({
    mutationFn: (data: SdSettings) =>
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdSettings: data }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("הגדרות כלבי שירות נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      fetch("/api/service-dogs/vaccinations/apply-schedule", { method: "POST" }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה");
        return d;
      }),
    onSuccess: (d) => toast.success(`לוח החיסונים הוחל על ${d.updatedCount} כלבים`),
    onError: (e: Error) => toast.error(e.message || "שגיאה בהחלת לוח החיסונים"),
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  function toggle(field: keyof SdSettings) {
    setForm({ ...settings, [field]: !settings[field as "trackHours" | "allowManualCert"] });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Track hours */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-petra-text">מעקב שעות הכשרה</p>
            <p className="text-sm text-petra-muted mt-0.5">האם לעקוב אחרי שעות ולהציג התקדמות לכל כלב</p>
          </div>
          <button
            onClick={() => toggle("trackHours")}
            className={cn("flex-shrink-0 w-12 h-6 rounded-full transition-colors relative", settings.trackHours ? "bg-orange-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", settings.trackHours ? "right-0.5" : "left-0.5")} />
          </button>
        </div>

        {/* Default target hours — shown only when trackHours is on */}
        {settings.trackHours && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="label">יעד שעות ברירת מחדל לכלב חדש</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                max={999}
                className="input w-28 text-center"
                value={settings.defaultTargetHours}
                onChange={(e) => setForm({ ...settings, defaultTargetHours: Math.max(1, Number(e.target.value) || 1) })}
              />
              <span className="text-sm text-petra-muted">שעות</span>
            </div>
            <p className="text-xs text-petra-muted mt-1">ניתן לשנות ליעד שונה לכל כלב בפרופיל הכלב</p>
          </div>
        )}
      </div>

      {/* Allow manual certification */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-petra-text">אפשר הסמכה ידנית</p>
            <p className="text-sm text-petra-muted mt-0.5">
              {settings.trackHours
                ? "אפשר לבעל העסק להסמיך כלב גם אם לא הגיע ליעד שעות ההכשרה"
                : "הסמכה על פי שיקול דעת בעל העסק — ללא מעקב שעות"}
            </p>
          </div>
          <button
            onClick={() => toggle("allowManualCert")}
            className={cn("flex-shrink-0 w-12 h-6 rounded-full transition-colors relative", settings.allowManualCert ? "bg-orange-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", settings.allowManualCert ? "right-0.5" : "left-0.5")} />
          </button>
        </div>
        {!settings.trackHours && !settings.allowManualCert && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            כשמעקב שעות כבוי, מומלץ לאפשר הסמכה ידנית כדי שניתן יהיה להסמיך כלבים
          </p>
        )}
      </div>

      {/* Vaccination schedule */}
      <div className="card p-5">
        {/* Toggle header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="font-semibold text-petra-text">לוח חיסונים שנתי ברירת מחדל</p>
            <p className="text-sm text-petra-muted mt-0.5">
              הגדר בכל חודש מתבצע כל טיפול — התוכנית תיושם אוטומטית ותתחדש בתחילת כל שנה
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...settings, vaccinationScheduleEnabled: !settings.vaccinationScheduleEnabled })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings.vaccinationScheduleEnabled ? "bg-brand-500" : "bg-slate-200"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${settings.vaccinationScheduleEnabled ? "-translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {settings.vaccinationScheduleEnabled ? (
          <div className="mt-4 space-y-6">
            {/* Adults section */}
            <div>
              <p className="text-sm font-semibold text-petra-text mb-3 pb-2 border-b border-slate-100">
                🐕 בוגרים — שנה ומעלה
                <span className="text-xs font-normal text-petra-muted mr-2">(לפי חודש בשנה)</span>
              </p>
              <div className="space-y-3">
                {SD_VACCINE_TREATMENTS.map(t => {
                  const currentMonths: number[] = (settings.vaccinationSchedule as Record<string, number[]> | undefined)?.[t.key] ?? Array(t.doses).fill(0);
                  const setMonths = (months: number[]) =>
                    setForm({ ...settings, vaccinationSchedule: { ...settings.vaccinationSchedule, [t.key]: months } });
                  return (
                    <div key={t.key} className="flex items-start gap-4">
                      <div className="w-36 pt-1.5 flex-shrink-0">
                        <p className="text-sm font-medium text-petra-text">{t.label}</p>
                        <p className="text-[11px] text-petra-muted">{t.doses} מנות בשנה</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: t.doses }, (_, i) => (
                          <div key={i} className="flex items-center gap-1">
                            {t.doses > 1 && <span className="text-xs text-petra-muted w-10">מנה {i + 1}:</span>}
                            <select
                              value={currentMonths[i] || 0}
                              onChange={e => {
                                const updated = [...currentMonths];
                                while (updated.length <= i) updated.push(0);
                                updated[i] = Number(e.target.value);
                                setMonths(updated);
                              }}
                              className="input text-xs py-1 h-8 w-28"
                            >
                              <option value={0}>לא מוגדר</option>
                              {HE_MONTHS_SETTINGS.map((name, idx) => (
                                <option key={idx + 1} value={idx + 1}>{name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Puppies section */}
            <div>
              <p className="text-sm font-semibold text-petra-text mb-3 pb-2 border-b border-slate-100">
                🐾 גורים — עד 12 חודשים
                <span className="text-xs font-normal text-petra-muted mr-2">(שבועות מגיל לידה)</span>
              </p>
              <div className="space-y-3">
                {SD_PUPPY_TREATMENTS.map(t => {
                  const currentWeeks: number[] = (settings.puppyVaccinationSchedule as Record<string, number[]> | undefined)?.[t.key] ?? Array(t.doses).fill(0);
                  const setWeeks = (weeks: number[]) =>
                    setForm({ ...settings, puppyVaccinationSchedule: { ...settings.puppyVaccinationSchedule, [t.key]: weeks } });
                  return (
                    <div key={t.key} className="flex items-start gap-4">
                      <div className="w-36 pt-1.5 flex-shrink-0">
                        <p className="text-sm font-medium text-petra-text">{t.label}</p>
                        <p className="text-[11px] text-petra-muted">{t.doses} מנות</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: t.doses }, (_, i) => (
                          <div key={i} className="flex items-center gap-1">
                            {t.doses > 1 && <span className="text-xs text-petra-muted w-10">מנה {i + 1}:</span>}
                            <select
                              value={currentWeeks[i] || 0}
                              onChange={e => {
                                const updated = [...currentWeeks];
                                while (updated.length <= i) updated.push(0);
                                updated[i] = Number(e.target.value);
                                setWeeks(updated);
                              }}
                              className="input text-xs py-1 h-8 w-28"
                            >
                              <option value={0}>לא מוגדר</option>
                              {PUPPY_WEEKS_OPTIONS.map(w => (
                                <option key={w} value={w}>שבוע {w}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-petra-muted border-t border-slate-100 pt-3">
              סיווג גורים/בוגרים מחושב לפי תאריך לידה בתיק הכלב. ניתן לשנות לכל כלב בנפרד.
            </p>

            {/* Apply to all dogs */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-1">
              <div>
                <p className="text-sm font-medium text-petra-text">החל על כלל הכלבים עכשיו</p>
                <p className="text-xs text-petra-muted mt-0.5">
                  יעדכן את תוכניות החיסונים של כלל הכלבים לפי הלוח שהוגדר כאן
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!mutation.isPending) mutation.mutate(settings, {
                    onSuccess: () => applyMutation.mutate(),
                  });
                }}
                disabled={applyMutation.isPending || mutation.isPending}
                className="btn-secondary text-sm flex items-center gap-2 flex-shrink-0 mr-4"
              >
                {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {applyMutation.isPending ? "מחיל..." : "החל על כלל הכלבים"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-petra-muted mt-3">
            הפעל כדי להגדיר לוח חיסונים ברירת מחדל לכלל הכלבים
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-petra-muted space-y-1">
        <p className="font-medium text-petra-text mb-2">סיכום הגדרות:</p>
        <p>• מעקב שעות: <span className="font-medium text-petra-text">{settings.trackHours ? "פעיל" : "כבוי"}</span></p>
        {settings.trackHours && (
          <p>• יעד שעות לכלב חדש: <span className="font-medium text-petra-text">{settings.defaultTargetHours} שעות</span></p>
        )}
        <p>• הסמכה ידנית: <span className="font-medium text-petra-text">{settings.allowManualCert ? "מאושרת" : "לא מאושרת"}</span></p>
      </div>

      <button
        className="btn-primary"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(settings)}
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {mutation.isPending ? "שומר..." : saved ? "נשמר!" : "שמור הגדרות"}
      </button>
    </div>
  );
}
