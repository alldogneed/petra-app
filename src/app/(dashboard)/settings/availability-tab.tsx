"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Loader2,
  Ban,
  AlertCircle,
  Settings2,
  Coffee,
  CalendarDays,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";

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

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const DAY_OPTIONS = [
  { value: -1, label: "כל יום" },
  ...DAYS_HE.map((name, i) => ({ value: i, label: name })),
];

const TIMES: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AvailabilityTab() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

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
      }).then((r) => {
        if (!r.ok) throw new Error("Save failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-rules"] });
      setEditedRules(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function updateRule(dayOfWeek: number, updates: Partial<AvailabilityRule>) {
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
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "שגיאה");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-blocks"] });
      setBlockStartDate("");
      setBlockEndDate("");
      setBlockReason("");
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/booking/blocks/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-blocks"] });
    },
  });

  function handleAddBlock() {
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
      }).then((r) => {
        if (!r.ok) throw new Error("Save failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      setEditedSettings(null);
      toast.success("הגדרות תיאום נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת ההגדרות"),
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
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-breaks"] });
      setNewBreak({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" });
      toast.success("הפסקה נוספה");
    },
    onError: () => toast.error("שגיאה בהוספת הפסקה"),
  });

  const deleteBreakMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/availability/breaks/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-breaks"] });
    },
    onError: () => toast.error("שגיאה במחיקת ההפסקה"),
  });

  // ── Import holidays ───────────────────────────────────────────────────────

  const importHolidaysMutation = useMutation({
    mutationFn: () =>
      fetch("/api/availability/import-holidays", { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["availability-blocks"] });
      toast.success(`נוצרו ${data.created} חסימות חגים`);
    },
    onError: () => toast.error("שגיאה בייבוא חגים"),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  if (rulesLoading || settingsLoading) {
    return (
      <div className="animate-pulse space-y-3 max-w-2xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
      </div>
    );
  }

  const hasChanges = editedRules !== null;

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Booking Settings ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">הגדרות תיאום</h3>
        </div>

        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">מרווח בין פגישות</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={displaySettings.bookingBuffer}
                  onChange={(e) => setEditedSettings({ ...displaySettings, bookingBuffer: Number(e.target.value) })}
                  className="input"
                />
                <span className="text-xs text-petra-muted whitespace-nowrap">דקות</span>
              </div>
            </div>
            <div>
              <label className="label">הודעה מראש (מינ׳)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={displaySettings.bookingMinNotice}
                  onChange={(e) => setEditedSettings({ ...displaySettings, bookingMinNotice: Number(e.target.value) })}
                  className="input"
                />
                <span className="text-xs text-petra-muted whitespace-nowrap">שעות</span>
              </div>
            </div>
            <div>
              <label className="label">קביעה עד כמה ימים קדימה</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={displaySettings.bookingMaxAdvance}
                  onChange={(e) => setEditedSettings({ ...displaySettings, bookingMaxAdvance: Number(e.target.value) })}
                  className="input"
                />
                <span className="text-xs text-petra-muted whitespace-nowrap">ימים</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
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
                  displaySettings.gcalBlockExternal ? "right-0.5" : "left-0.5"
                )}
              />
            </button>
            <span className="text-sm text-petra-text">חסום פגישות גוגל קלנדר (כולל אישיות)</span>
          </label>

          <button
            className="btn-primary flex items-center gap-2 text-sm"
            disabled={editedSettings === null || saveSettingsMutation.isPending}
            onClick={() => { if (editedSettings) saveSettingsMutation.mutate(editedSettings); }}
          >
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור הגדרות
          </button>
        </div>
      </div>

      {/* ── Daily Breaks ── */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Coffee className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">הפסקות יומיות</h3>
          <span className="text-sm text-petra-muted">צהריים, תפילה וכד׳</span>
        </div>

        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">יום</label>
              <select
                value={newBreak.dayOfWeek}
                onChange={(e) => setNewBreak((p) => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                className="input"
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">משעה</label>
              <select
                value={newBreak.startTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, startTime: e.target.value }))}
                className="input"
              >
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">עד שעה</label>
              <select
                value={newBreak.endTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, endTime: e.target.value }))}
                className="input"
              >
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">תווית (אופציונלי)</label>
              <input
                type="text"
                value={newBreak.label}
                onChange={(e) => setNewBreak((p) => ({ ...p, label: e.target.value }))}
                placeholder="הפסקת צהריים"
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
            הוסף הפסקה
          </button>
        </div>

        {breaksLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}
          </div>
        ) : breaksData.length === 0 ? (
          <div className="text-center py-4 text-sm text-petra-muted">אין הפסקות מוגדרות</div>
        ) : (
          <div className="space-y-2">
            {breaksData.map((br) => (
              <div key={br.id} className="card p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Coffee className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">
                    {DAY_OPTIONS.find((d) => d.value === br.dayOfWeek)?.label ?? "כל יום"}
                    {" — "}
                    {br.startTime} עד {br.endTime}
                    {br.label && <span className="mr-2 text-xs text-petra-muted">({br.label})</span>}
                  </p>
                </div>
                <button
                  onClick={() => deleteBreakMutation.mutate(br.id)}
                  disabled={deleteBreakMutation.isPending}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Weekly Schedule ── */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">לוח זמנים שבועי</h3>
        </div>

        <div className="space-y-2">
          {(displayRules.length > 0 ? displayRules : getDefaultRules()).map((rule) => (
            <div
              key={rule.dayOfWeek}
              className={cn(
                "card p-3 flex items-center gap-3 transition-opacity",
                !rule.isOpen && "opacity-50"
              )}
            >
              {/* Toggle */}
              <button
                onClick={() => updateRule(rule.dayOfWeek, { isOpen: !rule.isOpen })}
                className={cn(
                  "w-10 h-6 rounded-full relative transition-colors flex-shrink-0",
                  rule.isOpen ? "bg-emerald-500" : "bg-slate-300"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                    rule.isOpen ? "right-0.5" : "left-0.5"
                  )}
                />
              </button>

              {/* Day name */}
              <span className="w-14 text-sm font-medium text-petra-text">
                {DAYS_HE[rule.dayOfWeek]}
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
                  <span className="text-xs text-petra-muted">עד</span>
                  <input
                    type="time"
                    value={rule.closeTime}
                    onChange={(e) => updateRule(rule.dayOfWeek, { closeTime: e.target.value })}
                    className="input text-sm py-1.5 px-2 w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-petra-muted">סגור</span>
              )}
            </div>
          ))}
        </div>

        <button
          className={cn(
            "btn-primary flex items-center gap-2 mt-4 transition-all",
            saved && "bg-emerald-500 hover:brightness-100",
            !hasChanges && !saved && "opacity-50 cursor-not-allowed"
          )}
          style={saved ? { background: "#10B981" } : undefined}
          disabled={!hasChanges || saveRulesMutation.isPending}
          onClick={() => {
            if (editedRules) saveRulesMutation.mutate(editedRules);
          }}
        >
          {saveRulesMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "נשמר!" : "שמור לוח זמנים"}
        </button>
      </div>

      {/* ── Availability Blocks ── */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-brand-500" />
            <h3 className="text-base font-semibold text-petra-text">חסימות זמינות</h3>
            <span className="text-sm text-petra-muted">חופשות, ימי סגירה מיוחדים</span>
          </div>
          <button
            onClick={() => importHolidaysMutation.mutate()}
            disabled={importHolidaysMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 text-petra-muted hover:text-petra-text hover:bg-slate-50 rounded-lg disabled:opacity-50"
          >
            {importHolidaysMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
            ייבא חגי ישראל 5786-5787
          </button>
        </div>

        {/* Add block form */}
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">תאריך ושעת התחלה *</label>
              <input
                type="datetime-local"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">תאריך ושעת סיום *</label>
              <input
                type="datetime-local"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="label">סיבה (אופציונלי)</label>
            <input
              type="text"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="חופשה, יום כיף צוות..."
              className="input"
            />
          </div>

          {addBlockMutation.isError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs mb-3">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {(addBlockMutation.error as Error)?.message || "שגיאה"}
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
            הוסף חסימה
          </button>
        </div>

        {/* Existing blocks */}
        {blocksLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-6 text-sm text-petra-muted">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>אין חסימות פעילות</p>
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
                      {start.toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                      {" "}
                      {start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {end.toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                      {" "}
                      {end.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {block.reason && (
                      <p className="text-xs text-petra-muted">{block.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteBlockMutation.mutate(block.id)}
                    disabled={deleteBlockMutation.isPending}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
