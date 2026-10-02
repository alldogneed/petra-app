"use client"

import { useState, useEffect } from "react"
import { Save, Plus, Trash2, Clock, CalendarOff, ExternalLink, Settings2, Coffee, CalendarDays, Lock } from "lucide-react"
import Link from "next/link";
import { BookingsTabs } from "@/components/bookings/BookingsTabs";
import { useAuth } from "@/providers/auth-provider"
import { toast } from "sonner"
import { PetraLoader } from "@/components/ui/PetraLoader";
import { SettingsFieldset } from "@/components/settings/settings-ui";
import { usePermissions } from "@/hooks/usePermissions";

/** Throws with the server's Hebrew `error` (e.g. a 403 permission message) when present. */
async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return
  const body = await res.json().catch(() => ({}))
  throw new Error((body && typeof body.error === "string" && body.error) || fallback)
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AvailabilityRule {
  id?: string
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface Block {
  id: string
  startAt: string
  endAt: string
  reason: string | null
}

interface BookingSettings {
  bookingBuffer: number
  bookingMinNotice: number
  bookingMaxAdvance: number
  gcalBlockExternal: boolean
}

interface AvailabilityBreak {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  label: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
const DAY_OPTIONS = [
  { value: -1, label: "כל יום" },
  ...DAY_NAMES.map((name, i) => ({ value: i, label: name })),
]

const TIMES: string[] = []
for (let h = 6; h <= 22; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`)
  TIMES.push(`${String(h).padStart(2, "0")}:30`)
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesSaving, setRulesSaving] = useState(false)
  const [rulesSaved, setRulesSaved] = useState(false)

  // New block form
  const [newBlock, setNewBlock] = useState({ startAt: "", endAt: "", reason: "" })
  const [blockSaving, setBlockSaving] = useState(false)

  // Booking settings
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>({
    bookingBuffer: 0,
    bookingMinNotice: 0,
    bookingMaxAdvance: 60,
    gcalBlockExternal: false,
  })
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Breaks
  const [breaks, setBreaks] = useState<AvailabilityBreak[]>([])
  const [newBreak, setNewBreak] = useState({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" })
  const [breakSaving, setBreakSaving] = useState(false)

  // Import holidays
  const [holidaysImporting, setHolidaysImporting] = useState(false)

  // Real public booking slug for THIS business (was hardcoded to /book/demo,
  // which showed every business a foreign demo page)
  const { user } = useAuth()
  const bookingSlug = user?.businessSlug || null

  // AVAILABILITY_MANAGE — without it the page is view-only (server enforces too).
  const { canManageAvailability } = usePermissions()
  const readOnly = !canManageAvailability

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // Tenant-scoped weekly rules (returns defaults when none are saved yet).
    fetch("/api/booking/availability")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => { setRules(Array.isArray(d) ? d : []); setRulesLoading(false) })
      .catch(() => setRulesLoading(false))

    loadBlocks()

    fetch("/api/availability/settings")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => setBookingSettings(d))
      .catch(() => {})

    fetch("/api/availability/breaks")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => setBreaks(d.breaks ?? []))
      .catch(() => {})
  }, [])

  // Blocks: the full list (incl. past) needs AVAILABILITY_MANAGE; view-only
  // members fall back to the open list of upcoming blocks.
  async function loadBlocks() {
    try {
      const res = await fetch("/api/admin/blocks")
      if (res.ok) {
        const d = await res.json()
        setBlocks(Array.isArray(d?.blocks) ? d.blocks : [])
        return
      }
      const fallback = await fetch("/api/booking/blocks")
      if (fallback.ok) {
        const d = await fallback.json()
        setBlocks(Array.isArray(d) ? d : [])
      }
    } catch {
      /* keep current list */
    }
  }

  // ── Save working hours ──────────────────────────────────────────────────────
  const saveRules = async () => {
    if (readOnly) return
    setRulesSaving(true)
    try {
      const res = await fetch("/api/booking/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rules.map(({ dayOfWeek, isOpen, openTime, closeTime }) => ({ dayOfWeek, isOpen, openTime, closeTime })),
        }),
      })
      await ensureOk(res, "שגיאה בשמירת שעות הפעילות")
      setRulesSaved(true)
      toast.success("שעות הפעילות נשמרו")
      setTimeout(() => setRulesSaved(false), 2000)
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה בשמירת שעות הפעילות"))
    } finally {
      setRulesSaving(false)
    }
  }

  // ── Save booking settings ───────────────────────────────────────────────────
  const saveBookingSettings = async () => {
    if (readOnly) return
    setSettingsSaving(true)
    try {
      const res = await fetch("/api/availability/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingSettings),
      })
      await ensureOk(res, "שגיאה בשמירת ההגדרות")
      toast.success("הגדרות תיאום נשמרו")
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה בשמירת ההגדרות"))
    } finally {
      setSettingsSaving(false)
    }
  }

  // ── Add block ───────────────────────────────────────────────────────────────
  const addBlock = async () => {
    if (readOnly) return
    if (!newBlock.startAt || !newBlock.endAt) return
    setBlockSaving(true)
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // datetime-local has no timezone — the API expects full ISO strings.
        body: JSON.stringify({
          startAt: new Date(newBlock.startAt).toISOString(),
          endAt: new Date(newBlock.endAt).toISOString(),
          reason: newBlock.reason || undefined,
        }),
      })
      await ensureOk(res, "שגיאה בהוספת חסימה")
      const data = await res.json()
      setBlocks((prev) => [...prev, data.block].sort((a, b) => a.startAt.localeCompare(b.startAt)))
      setNewBlock({ startAt: "", endAt: "", reason: "" })
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה בהוספת חסימה"))
    } finally {
      setBlockSaving(false)
    }
  }

  // ── Delete block ─────────────────────────────────────────────────────────────
  const deleteBlock = async (id: string) => {
    if (readOnly) return
    try {
      const res = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" })
      await ensureOk(res, "שגיאה במחיקת החסימה")
      setBlocks((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה במחיקת החסימה"))
    }
  }

  // ── Add break ──────────────────────────────────────────────────────────────
  const addBreak = async () => {
    if (readOnly) return
    if (!newBreak.startTime || !newBreak.endTime) return
    setBreakSaving(true)
    try {
      const res = await fetch("/api/availability/breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: newBreak.dayOfWeek,
          startTime: newBreak.startTime,
          endTime: newBreak.endTime,
          label: newBreak.label || null,
        }),
      })
      await ensureOk(res, "שגיאה בהוספת הפסקה")
      const data = await res.json()
      setBreaks((prev) => [...prev, data.break])
      setNewBreak({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" })
      toast.success("הפסקה נוספה")
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה בהוספת הפסקה"))
    } finally {
      setBreakSaving(false)
    }
  }

  // ── Delete break ────────────────────────────────────────────────────────────
  const deleteBreak = async (id: string) => {
    if (readOnly) return
    try {
      const res = await fetch(`/api/availability/breaks/${id}`, { method: "DELETE" })
      await ensureOk(res, "שגיאה במחיקת ההפסקה")
      setBreaks((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה במחיקת ההפסקה"))
    }
  }

  // ── Import holidays ─────────────────────────────────────────────────────────
  const importHolidays = async () => {
    if (readOnly) return
    setHolidaysImporting(true)
    try {
      const res = await fetch("/api/availability/import-holidays", { method: "POST" })
      await ensureOk(res, "שגיאה בייבוא חגים")
      const data = await res.json()
      toast.success(`נוצרו ${data.created} חסימות חגים`)
      await loadBlocks()
    } catch (err) {
      toast.error(errorMessage(err, "שגיאה בייבוא חגים"))
    } finally {
      setHolidaysImporting(false)
    }
  }

  const updateRule = (dayOfWeek: number, field: keyof AvailabilityRule, value: unknown) => {
    if (readOnly) return
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r))
    )
    setRulesSaved(false)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const selectClass = "border border-petra-border rounded-xl px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
  const inputClass  = "w-full border border-petra-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
  const labelClass  = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="sm:p-6 max-w-3xl mx-auto" dir="rtl">
      <BookingsTabs />
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">זמינות ושעות פעילות</h1>
        <p className="text-gray-500 text-sm">הגדר מתי לקוחות יכולים להזמין תורים</p>
        {bookingSlug && (
        <Link
          href={`/book/${bookingSlug}`}
          target="_blank"
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg px-3 py-2 hover:bg-amber-50"
        >
          <ExternalLink className="w-4 h-4" />
          דף ההזמנה
        </Link>
        )}
      </div>

      {readOnly && (
        <div
          role="note"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            תצוגה בלבד — רק בעלי העסק, או מי שקיבל ממנו את ההרשאה &quot;לשנות שעות פעילות וזמינות&quot;, יכולים לשנות שעות, הפסקות וחסימות.
          </span>
        </div>
      )}

      {/* ── Section A: Booking Settings ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800">הגדרות תיאום</h2>
        </div>
        <SettingsFieldset readOnly={readOnly}>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>מרווח בין פגישות</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={bookingSettings.bookingBuffer}
                  onChange={(e) => setBookingSettings((p) => ({ ...p, bookingBuffer: Number(e.target.value) }))}
                  className={inputClass}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">דקות</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>מינימום הודעה מראש</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={bookingSettings.bookingMinNotice}
                  onChange={(e) => setBookingSettings((p) => ({ ...p, bookingMinNotice: Number(e.target.value) }))}
                  className={inputClass}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">שעות</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>כמה ימים קדימה ניתן לקבוע</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={bookingSettings.bookingMaxAdvance}
                  onChange={(e) => setBookingSettings((p) => ({ ...p, bookingMaxAdvance: Number(e.target.value) }))}
                  className={inputClass}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">ימים</span>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={bookingSettings.gcalBlockExternal}
              onClick={() => setBookingSettings((p) => ({ ...p, gcalBlockExternal: !p.gcalBlockExternal }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                bookingSettings.gcalBlockExternal ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  bookingSettings.gcalBlockExternal ? "-translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">חסום פגישות גוגל קלנדר (כולל אישיות)</span>
          </label>
          {!readOnly && (
          <button
            onClick={saveBookingSettings}
            disabled={settingsSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold rounded-lg text-sm"
          >
            <Save className="w-4 h-4" />
            {settingsSaving ? "שומר..." : "שמור הגדרות"}
          </button>
          )}
        </div>
        </SettingsFieldset>
      </div>

      {/* ── Section B: Daily Breaks ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Coffee className="w-5 h-5 text-orange-400" />
          <h2 className="font-semibold text-gray-800">הפסקות יומיות</h2>
        </div>

        {/* Add break form */}
        {!readOnly && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-3">הוסף הפסקה חוזרת (צהריים, תפילה וכד׳)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>יום בשבוע</label>
              <select
                value={newBreak.dayOfWeek}
                onChange={(e) => setNewBreak((p) => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                className={`w-full ${selectClass}`}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>משעה</label>
              <select
                value={newBreak.startTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, startTime: e.target.value }))}
                className={`w-full ${selectClass}`}
              >
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>עד שעה</label>
              <select
                value={newBreak.endTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, endTime: e.target.value }))}
                className={`w-full ${selectClass}`}
              >
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>תווית (אופציונלי)</label>
              <input
                type="text"
                value={newBreak.label}
                onChange={(e) => setNewBreak((p) => ({ ...p, label: e.target.value }))}
                placeholder="הפסקת צהריים"
                className={inputClass}
              />
            </div>
          </div>
          <button
            onClick={addBreak}
            disabled={breakSaving}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            {breakSaving ? "שומר..." : "הוסף הפסקה"}
          </button>
        </div>
        )}

        {/* Breaks list */}
        <div className="divide-y divide-gray-100">
          {breaks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">אין הפסקות מוגדרות</div>
          ) : (
            breaks.map((br) => (
              <div key={br.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {DAY_OPTIONS.find((d) => d.value === br.dayOfWeek)?.label ?? "כל יום"}
                    {" — "}
                    {br.startTime} עד {br.endTime}
                    {br.label && <span className="mr-2 text-gray-500 text-xs">({br.label})</span>}
                  </p>
                </div>
                {!readOnly && (
                <button
                  onClick={() => deleteBreak(br.id)}
                  aria-label="מחק הפסקה"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Working Hours Card ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">שעות פעילות שבועיות</h2>
          </div>
          {!readOnly && (
          <button
            onClick={saveRules}
            disabled={rulesSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              rulesSaved
                ? "bg-green-100 text-green-700"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            } disabled:opacity-60`}
          >
            <Save className="w-4 h-4" />
            {rulesSaving ? "שומר..." : rulesSaved ? "נשמר!" : "שמור"}
          </button>
          )}
        </div>

        <SettingsFieldset readOnly={readOnly}>
        <div className="divide-y divide-gray-100">
          {rulesLoading ? (
            <PetraLoader variant="inline" />
          ) : (
            rules.map((rule) => (
              <div
                key={rule.dayOfWeek}
                className={`px-4 sm:px-6 py-4 flex items-center gap-2 sm:gap-4 transition-colors ${
                  rule.isOpen ? "" : "bg-gray-50 opacity-60"
                }`}
              >
                {/* Day name */}
                <span className="w-12 sm:w-16 text-sm font-medium text-gray-700 flex-shrink-0">
                  {DAY_NAMES[rule.dayOfWeek]}
                </span>

                {/* Toggle */}
                <button
                  onClick={() => updateRule(rule.dayOfWeek, "isOpen", !rule.isOpen)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    rule.isOpen ? "bg-amber-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      rule.isOpen ? "-translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                {/* Times */}
                {rule.isOpen ? (
                  <div className="flex items-center gap-2 text-sm min-w-0 flex-wrap">
                    <select
                      value={rule.openTime}
                      onChange={(e) => updateRule(rule.dayOfWeek, "openTime", e.target.value)}
                      className="border border-petra-border rounded-xl px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    >
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-gray-400">עד</span>
                    <select
                      value={rule.closeTime}
                      onChange={(e) => updateRule(rule.dayOfWeek, "closeTime", e.target.value)}
                      className="border border-petra-border rounded-xl px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    >
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">סגור</span>
                )}
              </div>
            ))
          )}
        </div>
        </SettingsFieldset>
      </div>

      {/* ── Blocks Card ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-red-400" />
            <h2 className="font-semibold text-gray-800">חסימות וחופשות</h2>
          </div>
          {/* Section C: Import Israeli holidays */}
          {!readOnly && (
          <button
            onClick={importHolidays}
            disabled={holidaysImporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
          >
            <CalendarDays className="w-4 h-4" />
            {holidaysImporting ? "מייבא..." : "ייבא חגי ישראל 5786-5787"}
          </button>
          )}
        </div>

        {/* Add block form */}
        {!readOnly && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-3">הוסף תקופת חסימה (חגים, חופשות, סגירה חד-פעמית)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">מתאריך ושעה</label>
              <input
                type="datetime-local"
                value={newBlock.startAt}
                onChange={(e) => setNewBlock((p) => ({ ...p, startAt: e.target.value }))}
                className="w-full border border-petra-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">עד תאריך ושעה</label>
              <input
                type="datetime-local"
                value={newBlock.endAt}
                onChange={(e) => setNewBlock((p) => ({ ...p, endAt: e.target.value }))}
                className="w-full border border-petra-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סיבה (אופציונלי)</label>
              <input
                type="text"
                value={newBlock.reason}
                onChange={(e) => setNewBlock((p) => ({ ...p, reason: e.target.value }))}
                placeholder="חופשה, יום סגור..."
                className="w-full border border-petra-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
              />
            </div>
          </div>
          <button
            onClick={addBlock}
            disabled={!newBlock.startAt || !newBlock.endAt || blockSaving}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            {blockSaving ? "שומר..." : "הוסף חסימה"}
          </button>
        </div>
        )}

        {/* Blocks list */}
        <div className="divide-y divide-gray-100">
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">אין חסימות פעילות</div>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(block.startAt).toLocaleString("he-IL", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                    {" ← "}
                    {new Date(block.endAt).toLocaleString("he-IL", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {block.reason && (
                    <p className="text-xs text-gray-500 mt-0.5">{block.reason}</p>
                  )}
                </div>
                {!readOnly && (
                <button
                  onClick={() => deleteBlock(block.id)}
                  aria-label="מחק חסימה"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Online Booking Services hint ──────────────────────────────────────── */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">טיפ: הפעלת הזמנה אונליין לשירותים</p>
        <p className="text-amber-700">
          כדי ששירות יופיע בדף ההזמנה הציבורי, עבור ל
          <Link href="/pricing" className="underline mx-1 hover:text-amber-900">מחירון</Link>
          {`והפעל "זמין לתיאום תור אונליין" עבור כל שירות רצוי.`}
        </p>
      </div>
    </div>
  )
}
