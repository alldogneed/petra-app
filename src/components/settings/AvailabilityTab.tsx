"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Ban,
  AlertCircle,
  Settings2,
  Coffee,
  CalendarDays,
  Lock,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRegisterDirty } from "./SettingsDirtyContext";
import { SettingsFieldset, SettingsSaveBar } from "./settings-ui";
import { usePermissions } from "@/hooks/usePermissions";

/** Reads the server's Hebrew `error` (e.g. a 403 permission message) or falls back. */
async function jsonOrThrow(r: Response, fallback: string) {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body && typeof body.error === "string" && body.error) || fallback);
  }
  return r.json();
}

/** Shown when the member lacks AVAILABILITY_MANAGE — data stays visible, editing is off. */
function AvailabilityReadOnlyNote() {
  const t = useTranslations("settings.availabilityTab");
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>
        {t("readOnlyNote")}
      </span>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AvailabilityRule {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface AvailabilityBlock {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
}

interface BookingSettings {
  bookingBuffer: number;
  bookingMinNotice: number;
  bookingMaxAdvance: number;
  gcalBlockExternal: boolean;
}

interface AvailabilityBreak {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string | null;
}

/** dayOfWeek (0 = Sunday) → message key under `settings.availabilityTab.days`. */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DAY_OPTIONS = [
  { value: -1, labelKey: "everyDay" },
  ...DAY_KEYS.map((key, i) => ({ value: i, labelKey: key })),
] as const;

const TIMES: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AvailabilityTab() {
  const t = useTranslations("settings.availabilityTab");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const dayLabel = (dayOfWeek: number) => {
    const opt = DAY_OPTIONS.find((d) => d.value === dayOfWeek);
    return t(`days.${opt ? opt.labelKey : "everyDay"}`);
  };
  const queryClient = useQueryClient();
  const { canManageAvailability } = usePermissions();
  const readOnly = !canManageAvailability;
  // Pending delete confirmation (break or block).
  const [pendingDelete, setPendingDelete] = useState<{ kind: "break" | "block"; id: string; label: string } | null>(null);

  // ── Weekly schedule ───────────────────────────────────────────────────────

  const { data: rules, isLoading: rulesLoading } = useQuery<AvailabilityRule[]>({
    queryKey: ["availability-rules"],
    queryFn: () => fetchJSON<AvailabilityRule[]>("/api/booking/availability"),
  });

  const [editedRules, setEditedRules] = useState<AvailabilityRule[] | null>(null);
  const displayRules = editedRules ?? rules ?? [];

  const saveRulesMutation = useMutation({
    mutationFn: (rulesData: AvailabilityRule[]) =>
      fetch("/api/booking/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesData }),
      }).then((r) => jsonOrThrow(r, t("errors.saveSchedule"))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["availability-rules"] });
      setEditedRules(null);
      toast.success(t("toasts.scheduleSaved"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.saveSchedule")),
  });

  function updateRule(dayOfWeek: number, updates: Partial<AvailabilityRule>) {
    if (readOnly) return;
    const current = displayRules.length > 0 ? displayRules : getDefaultRules();
    const updated = current.map((r) =>
      r.dayOfWeek === dayOfWeek ? { ...r, ...updates } : r
    );
    setEditedRules(updated);
  }

  function getDefaultRules(): AvailabilityRule[] {
    return Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isOpen: i !== 6, // Saturday closed
      openTime: "09:00",
      closeTime: i === 5 ? "13:00" : "18:00", // Friday half-day
    }));
  }

  // ── Blocks ────────────────────────────────────────────────────────────────

  const { data: blocks = [], isLoading: blocksLoading } = useQuery<AvailabilityBlock[]>({
    queryKey: ["availability-blocks"],
    queryFn: () => fetchJSON<AvailabilityBlock[]>("/api/booking/blocks"),
  });

  const [blockStartDate, setBlockStartDate] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const addBlockMutation = useMutation({
    mutationFn: (data: { startAt: string; endAt: string; reason?: string }) =>
      fetch("/api/booking/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => jsonOrThrow(r, t("errors.addBlock"))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-blocks"] });
      setBlockStartDate("");
      setBlockEndDate("");
      setBlockReason("");
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/booking/blocks/${id}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, t("errors.deleteBlock")),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-blocks"] });
      setPendingDelete(null);
      toast.success(t("toasts.blockDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.deleteBlock")),
  });

  function handleAddBlock() {
    if (readOnly) return;
    if (!blockStartDate || !blockEndDate) return;
    addBlockMutation.mutate({
      startAt: new Date(blockStartDate).toISOString(),
      endAt: new Date(blockEndDate).toISOString(),
      reason: blockReason || undefined,
    });
  }

  // ── Booking settings ──────────────────────────────────────────────────────

  const { data: bookingSettings, isLoading: settingsLoading } = useQuery<BookingSettings>({
    queryKey: ["booking-settings"],
    queryFn: () => fetchJSON<BookingSettings>("/api/availability/settings"),
  });

  const [editedSettings, setEditedSettings] = useState<BookingSettings | null>(null);
  const displaySettings = editedSettings ?? bookingSettings ?? {
    bookingBuffer: 0,
    bookingMinNotice: 0,
    bookingMaxAdvance: 60,
    gcalBlockExternal: false,
  };

  const saveSettingsMutation = useMutation({
    mutationFn: (data: BookingSettings) =>
      fetch("/api/availability/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => jsonOrThrow(r, t("errors.saveSettings"))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      setEditedSettings(null);
      toast.success(t("toasts.settingsSaved"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.saveSettings")),
  });

  // ── Breaks ────────────────────────────────────────────────────────────────

  const { data: breaksData = [], isLoading: breaksLoading } = useQuery<AvailabilityBreak[]>({
    queryKey: ["availability-breaks"],
    queryFn: () =>
      fetchJSON<{ breaks: AvailabilityBreak[] }>("/api/availability/breaks").then((d) => d.breaks),
  });

  const [newBreak, setNewBreak] = useState({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" });

  const addBreakMutation = useMutation({
    mutationFn: (data: typeof newBreak) =>
      fetch("/api/availability/breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, label: data.label || null }),
      }).then((r) => jsonOrThrow(r, t("errors.addBreak"))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-breaks"] });
      setNewBreak({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" });
      toast.success(t("toasts.breakAdded"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.addBreak")),
  });

  const deleteBreakMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/availability/breaks/${id}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, t("errors.deleteBreak")),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-breaks"] });
      setPendingDelete(null);
      toast.success(t("toasts.breakDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.deleteBreak")),
  });

  // ── Import holidays ───────────────────────────────────────────────────────

  const importHolidaysMutation = useMutation({
    mutationFn: () =>
      fetch("/api/availability/import-holidays", { method: "POST" }).then((r) =>
        jsonOrThrow(r, t("errors.importHolidays")),
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["availability-blocks"] });
      toast.success(t("toasts.holidaysImported", { count: data.created }));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.importHolidays")),
  });

  // ── Unsaved changes (booking settings + weekly schedule share one save bar) ──

  const rulesDirty = editedRules !== null && JSON.stringify(editedRules) !== JSON.stringify(rules ?? getDefaultRules());
  const settingsDirty = editedSettings !== null && JSON.stringify(editedSettings) !== JSON.stringify(bookingSettings ?? null);
  const dirty = !readOnly && (rulesDirty || settingsDirty);
  useRegisterDirty("availability", dirty);
  const isSaving = saveRulesMutation.isPending || saveSettingsMutation.isPending;

  function saveAll() {
    if (readOnly) return;
    if (rulesDirty && editedRules) saveRulesMutation.mutate(editedRules);
    if (settingsDirty && editedSettings) saveSettingsMutation.mutate(editedSettings);
  }

  function resetAll() {
    setEditedRules(null);
    setEditedSettings(null);
  }

  function confirmDelete() {
    if (!pendingDelete || readOnly) return;
    if (pendingDelete.kind === "break") deleteBreakMutation.mutate(pendingDelete.id);
    else deleteBlockMutation.mutate(pendingDelete.id);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (rulesLoading || settingsLoading) {
    return <PetraLoader />;
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {readOnly && <AvailabilityReadOnlyNote />}

      {/* ── Booking Settings ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">{t("bookingSettings.title")}</h3>
        </div>

        <SettingsFieldset readOnly={readOnly}>
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">{t("bookingSettings.buffer")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={displaySettings.bookingBuffer}
                  onChange={(e) => setEditedSettings({ ...displaySettings, bookingBuffer: Number(e.target.value) })}
                  className="input"
                />
                <span className="text-xs text-petra-muted whitespace-nowrap">{t("units.minutes")}</span>
              </div>
            </div>
            <div>
              <label className="label">{t("bookingSettings.minNotice")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={displaySettings.bookingMinNotice}
                  onChange={(e) => setEditedSettings({ ...displaySettings, bookingMinNotice: Number(e.target.value) })}
                  className="input"
                />
                <span className="text-xs text-petra-muted whitespace-nowrap">{t("units.hours")}</span>
              </div>
            </div>
            <div>
              <label className="label">{t("bookingSettings.maxAdvance")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={displaySettings.bookingMaxAdvance}
                  onChange={(e) => setEditedSettings({ ...displaySettings, bookingMaxAdvance: Number(e.target.value) })}
                  className="input"
                />
                <span className="text-xs text-petra-muted whitespace-nowrap">{t("units.days")}</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={displaySettings.gcalBlockExternal}
              onClick={() => setEditedSettings({ ...displaySettings, gcalBlockExternal: !displaySettings.gcalBlockExternal })}
              className={cn(
                "w-10 h-6 rounded-full relative transition-colors flex-shrink-0",
                displaySettings.gcalBlockExternal ? "bg-emerald-500" : "bg-slate-300"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                  displaySettings.gcalBlockExternal ? "start-0.5" : "end-0.5"
                )}
              />
            </button>
            <span className="text-sm text-petra-text">{t("bookingSettings.gcalBlockExternal")}</span>
          </label>

          {!readOnly && (
            <p className="text-xs text-petra-muted">{t("bookingSettings.saveHint")}</p>
          )}
        </div>
        </SettingsFieldset>
      </div>

      {/* ── Daily Breaks ── */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Coffee className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">{t("breaks.title")}</h3>
          <span className="text-sm text-petra-muted">{t("breaks.subtitle")}</span>
        </div>

        {!readOnly && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">{t("breaks.day")}</label>
              <select
                value={newBreak.dayOfWeek}
                onChange={(e) => setNewBreak((p) => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                className="input"
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{t(`days.${d.labelKey}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("breaks.from")}</label>
              <select
                value={newBreak.startTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, startTime: e.target.value }))}
                className="input"
              >
                {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("breaks.to")}</label>
              <select
                value={newBreak.endTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, endTime: e.target.value }))}
                className="input"
              >
                {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("breaks.labelOptional")}</label>
              <input
                type="text"
                value={newBreak.label}
                onChange={(e) => setNewBreak((p) => ({ ...p, label: e.target.value }))}
                placeholder={t("breaks.labelPlaceholder")}
                className="input"
              />
            </div>
          </div>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            disabled={addBreakMutation.isPending}
            onClick={() => addBreakMutation.mutate(newBreak)}
          >
            {addBreakMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t("breaks.add")}
          </button>
        </div>
        )}

        {breaksLoading ? (
          <PetraLoader variant="inline" />
        ) : breaksData.length === 0 ? (
          <div className="text-center py-4 text-sm text-petra-muted">{t("breaks.empty")}</div>
        ) : (
          <div className="space-y-2">
            {breaksData.map((br) => (
              <div key={br.id} className="card p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Coffee className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">
                    {dayLabel(br.dayOfWeek)}
                    {" — "}
                    {t("breaks.range", { start: br.startTime, end: br.endTime })}
                    {br.label && <span className="ms-2 text-xs text-petra-muted">({br.label})</span>}
                  </p>
                </div>
                {!readOnly && (
                <button
                  type="button"
                  onClick={() => setPendingDelete({
                    kind: "break",
                    id: br.id,
                    label: `${dayLabel(br.dayOfWeek)} ${br.startTime}–${br.endTime}`,
                  })}
                  disabled={deleteBreakMutation.isPending}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  aria-label={t("breaks.deleteAria")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Weekly Schedule ── */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">{t("schedule.title")}</h3>
        </div>

        <SettingsFieldset readOnly={readOnly}>
        <div className="space-y-2">
          {(displayRules.length > 0 ? displayRules : getDefaultRules()).map((rule) => (
            <div
              key={rule.dayOfWeek}
              className={cn(
                "card p-3 flex flex-wrap items-center gap-3 transition-opacity",
                !rule.isOpen && "opacity-50"
              )}
            >
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={rule.isOpen}
                aria-label={t("schedule.dayOpenAria", { day: dayLabel(rule.dayOfWeek) })}
                onClick={() => updateRule(rule.dayOfWeek, { isOpen: !rule.isOpen })}
                className={cn(
                  "w-10 h-6 rounded-full relative transition-colors flex-shrink-0",
                  rule.isOpen ? "bg-emerald-500" : "bg-slate-300"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                    rule.isOpen ? "start-0.5" : "end-0.5"
                  )}
                />
              </button>

              {/* Day name */}
              <span className="w-14 text-sm font-medium text-petra-text">
                {dayLabel(rule.dayOfWeek)}
              </span>

              {/* Times */}
              {rule.isOpen ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={rule.openTime}
                    onChange={(e) => updateRule(rule.dayOfWeek, { openTime: e.target.value })}
                    className="input text-sm py-1.5 px-2 w-28"
                  />
                  <span className="text-xs text-petra-muted">{t("schedule.until")}</span>
                  <input
                    type="time"
                    value={rule.closeTime}
                    onChange={(e) => updateRule(rule.dayOfWeek, { closeTime: e.target.value })}
                    className="input text-sm py-1.5 px-2 w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-petra-muted">{t("schedule.closed")}</span>
              )}
            </div>
          ))}
        </div>
        </SettingsFieldset>

        <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={saveAll} onReset={resetAll} canEdit={!readOnly} />
      </div>

      {/* ── Availability Blocks ── */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Ban className="w-5 h-5 text-brand-500" />
            <h3 className="text-base font-semibold text-petra-text">{t("blocks.title")}</h3>
            <span className="text-sm text-petra-muted">{t("blocks.subtitle")}</span>
          </div>
          {!readOnly && (
          <button
            type="button"
            onClick={() => importHolidaysMutation.mutate()}
            disabled={importHolidaysMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 text-petra-muted hover:text-petra-text hover:bg-slate-50 rounded-lg disabled:opacity-50"
          >
            {importHolidaysMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
            {t("blocks.importHolidays")}
          </button>
          )}
        </div>

        {/* Add block form */}
        {!readOnly && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">{t("blocks.start")}</label>
              <input
                type="datetime-local"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">{t("blocks.end")}</label>
              <input
                type="datetime-local"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="label">{t("blocks.reasonOptional")}</label>
            <input
              type="text"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder={t("blocks.reasonPlaceholder")}
              className="input"
            />
          </div>

          {addBlockMutation.isError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs mb-3">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {(addBlockMutation.error as Error)?.message || t("errors.generic")}
            </div>
          )}

          <button
            className="btn-primary flex items-center gap-2 text-sm"
            disabled={!blockStartDate || !blockEndDate || addBlockMutation.isPending}
            onClick={handleAddBlock}
          >
            {addBlockMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t("blocks.add")}
          </button>
        </div>
        )}

        {/* Existing blocks */}
        {blocksLoading ? (
          <PetraLoader variant="inline" />
        ) : blocks.length === 0 ? (
          <div className="text-center py-6 text-sm text-petra-muted">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>{t("blocks.empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => {
              const start = new Date(block.startAt);
              const end = new Date(block.endAt);
              return (
                <div key={block.id} className="card p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Ban className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-petra-text">
                      {start.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                      {" "}
                      {start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {end.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                      {" "}
                      {end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {block.reason && (
                      <p className="text-xs text-petra-muted">{block.reason}</p>
                    )}
                  </div>
                  {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete({
                      kind: "block",
                      id: block.id,
                      label: `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} — ${end.toLocaleDateString(locale, { day: "numeric", month: "short" })}${block.reason ? ` (${block.reason})` : ""}`,
                    })}
                    disabled={deleteBlockMutation.isPending}
                    aria-label={t("blocks.deleteAria")}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === "break" ? t("confirmDelete.breakTitle") : t("confirmDelete.blockTitle")}
        description={pendingDelete ? (
          <>
            <span className="font-medium text-petra-text">{pendingDelete.label}</span>
            <br />
            {pendingDelete.kind === "break"
              ? t("confirmDelete.breakDescription")
              : t("confirmDelete.blockDescription")}
          </>
        ) : undefined}
        confirmLabel={tc("actions.delete")}
        danger
        loading={deleteBreakMutation.isPending || deleteBlockMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
