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
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

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

// Day ids (0 = Sunday … 6 = Saturday); -1 = every day. Labels come from messages.
const DAY_IDS = [0, 1, 2, 3, 4, 5, 6]
const DAY_OPTIONS = [-1, ...DAY_IDS]

const TIMES: string[] = []
for (let h = 6; h <= 22; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`)
  TIMES.push(`${String(h).padStart(2, "0")}:30`)
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const t = useTranslations("settings.availabilityPage")
  const tc = useTranslations("common")
  const { locale, cfg } = useBusinessLocale()
  const dayLabel = (day: number) => (day === -1 ? t("everyDay") : t(`days.${day}`))
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
      await ensureOk(res, t("errors.saveRules"))
      setRulesSaved(true)
      toast.success(t("toasts.rulesSaved"))
      setTimeout(() => setRulesSaved(false), 2000)
    } catch (err) {
      toast.error(errorMessage(err, t("errors.saveRules")))
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
      await ensureOk(res, t("errors.saveSettings"))
      toast.success(t("toasts.settingsSaved"))
    } catch (err) {
      toast.error(errorMessage(err, t("errors.saveSettings")))
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
      await ensureOk(res, t("errors.addBlock"))
      const data = await res.json()
      setBlocks((prev) => [...prev, data.block].sort((a, b) => a.startAt.localeCompare(b.startAt)))
      setNewBlock({ startAt: "", endAt: "", reason: "" })
    } catch (err) {
      toast.error(errorMessage(err, t("errors.addBlock")))
    } finally {
      setBlockSaving(false)
    }
  }

  // ── Delete block ─────────────────────────────────────────────────────────────
  const deleteBlock = async (id: string) => {
    if (readOnly) return
    try {
      const res = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" })
      await ensureOk(res, t("errors.deleteBlock"))
      setBlocks((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      toast.error(errorMessage(err, t("errors.deleteBlock")))
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
      await ensureOk(res, t("errors.addBreak"))
      const data = await res.json()
      setBreaks((prev) => [...prev, data.break])
      setNewBreak({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" })
      toast.success(t("toasts.breakAdded"))
    } catch (err) {
      toast.error(errorMessage(err, t("errors.addBreak")))
    } finally {
      setBreakSaving(false)
    }
  }

  // ── Delete break ────────────────────────────────────────────────────────────
  const deleteBreak = async (id: string) => {
    if (readOnly) return
    try {
      const res = await fetch(`/api/availability/breaks/${id}`, { method: "DELETE" })
      await ensureOk(res, t("errors.deleteBreak"))
      setBreaks((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      toast.error(errorMessage(err, t("errors.deleteBreak")))
    }
  }

  // ── Import holidays ─────────────────────────────────────────────────────────
  const importHolidays = async () => {
    if (readOnly) return
    setHolidaysImporting(true)
    try {
      const res = await fetch("/api/availability/import-holidays", { method: "POST" })
      await ensureOk(res, t("errors.importHolidays"))
      const data = await res.json()
      toast.success(t("toasts.holidaysCreated", { count: data.created }))
      await loadBlocks()
    } catch (err) {
      toast.error(errorMessage(err, t("errors.importHolidays")))
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
    <div className="sm:p-6 max-w-3xl mx-auto" dir={cfg.dir}>
      <BookingsTabs />
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-gray-500 text-sm">{t("subtitle")}</p>
        {bookingSlug && (
        <Link
          href={`/book/${bookingSlug}`}
          target="_blank"
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg px-3 py-2 hover:bg-amber-50"
        >
          <ExternalLink className="w-4 h-4" />
          {t("bookingPage")}
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
            {t("readOnlyNotice")}
          </span>
        </div>
      )}

      {/* ── Section A: Booking Settings ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800">{t("bookingSettings.title")}</h2>
        </div>
        <SettingsFieldset readOnly={readOnly}>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t("bookingSettings.buffer")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={bookingSettings.bookingBuffer}
                  onChange={(e) => setBookingSettings((p) => ({ ...p, bookingBuffer: Number(e.target.value) }))}
                  className={inputClass}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">{t("bookingSettings.minutes")}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("bookingSettings.minNotice")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={bookingSettings.bookingMinNotice}
                  onChange={(e) => setBookingSettings((p) => ({ ...p, bookingMinNotice: Number(e.target.value) }))}
                  className={inputClass}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">{t("bookingSettings.hours")}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("bookingSettings.maxAdvance")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={bookingSettings.bookingMaxAdvance}
                  onChange={(e) => setBookingSettings((p) => ({ ...p, bookingMaxAdvance: Number(e.target.value) }))}
                  className={inputClass}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">{t("bookingSettings.days")}</span>
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
                  bookingSettings.gcalBlockExternal ? "-translate-x-5 ltr:translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">{t("bookingSettings.gcalBlockExternal")}</span>
          </label>
          {!readOnly && (
          <button
            onClick={saveBookingSettings}
            disabled={settingsSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold rounded-lg text-sm"
          >
            <Save className="w-4 h-4" />
            {settingsSaving ? tc("progress.saving") : t("bookingSettings.save")}
          </button>
          )}
        </div>
        </SettingsFieldset>
      </div>

      {/* ── Section B: Daily Breaks ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Coffee className="w-5 h-5 text-orange-400" />
          <h2 className="font-semibold text-gray-800">{t("breaks.title")}</h2>
        </div>

        {/* Add break form */}
        {!readOnly && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-3">{t("breaks.addHint")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>{t("breaks.dayOfWeek")}</label>
              <select
                value={newBreak.dayOfWeek}
                onChange={(e) => setNewBreak((p) => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                className={`w-full ${selectClass}`}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{dayLabel(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("breaks.fromTime")}</label>
              <select
                value={newBreak.startTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, startTime: e.target.value }))}
                className={`w-full ${selectClass}`}
              >
                {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("breaks.toTime")}</label>
              <select
                value={newBreak.endTime}
                onChange={(e) => setNewBreak((p) => ({ ...p, endTime: e.target.value }))}
                className={`w-full ${selectClass}`}
              >
                {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("breaks.labelOptional")}</label>
              <input
                type="text"
                value={newBreak.label}
                onChange={(e) => setNewBreak((p) => ({ ...p, label: e.target.value }))}
                placeholder={t("breaks.labelPlaceholder")}
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
            {breakSaving ? tc("progress.saving") : t("breaks.add")}
          </button>
        </div>
        )}

        {/* Breaks list */}
        <div className="divide-y divide-gray-100">
          {breaks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">{t("breaks.empty")}</div>
          ) : (
            breaks.map((br) => (
              <div key={br.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {t("breaks.row", {
                      day: DAY_OPTIONS.includes(br.dayOfWeek) ? dayLabel(br.dayOfWeek) : t("everyDay"),
                      start: br.startTime,
                      end: br.endTime,
                    })}
                    {br.label && <span className="ms-2 text-gray-500 text-xs">({br.label})</span>}
                  </p>
                </div>
                {!readOnly && (
                <button
                  onClick={() => deleteBreak(br.id)}
                  aria-label={t("breaks.deleteAriaLabel")}
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
            <h2 className="font-semibold text-gray-800">{t("weeklyHours.title")}</h2>
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
            {rulesSaving ? tc("progress.saving") : rulesSaved ? t("weeklyHours.saved") : tc("actions.save")}
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
                  {DAY_IDS.includes(rule.dayOfWeek) ? t(`days.${rule.dayOfWeek}`) : ""}
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
                      rule.isOpen ? "-translate-x-5 ltr:translate-x-5" : "translate-x-0"
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
                      {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                    <span className="text-gray-400">{t("weeklyHours.until")}</span>
                    <select
                      value={rule.closeTime}
                      onChange={(e) => updateRule(rule.dayOfWeek, "closeTime", e.target.value)}
                      className="border border-petra-border rounded-xl px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    >
                      {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">{t("weeklyHours.closed")}</span>
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
            <h2 className="font-semibold text-gray-800">{t("blocks.title")}</h2>
          </div>
          {/* Section C: Import Israeli holidays */}
          {!readOnly && (
          <button
            onClick={importHolidays}
            disabled={holidaysImporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
          >
            <CalendarDays className="w-4 h-4" />
            {holidaysImporting ? t("blocks.importing") : t("blocks.importHolidays")}
          </button>
          )}
        </div>

        {/* Add block form */}
        {!readOnly && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-3">{t("blocks.addHint")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("blocks.from")}</label>
              <input
                type="datetime-local"
                value={newBlock.startAt}
                onChange={(e) => setNewBlock((p) => ({ ...p, startAt: e.target.value }))}
                className="w-full border border-petra-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("blocks.to")}</label>
              <input
                type="datetime-local"
                value={newBlock.endAt}
                onChange={(e) => setNewBlock((p) => ({ ...p, endAt: e.target.value }))}
                className="w-full border border-petra-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("blocks.reasonOptional")}</label>
              <input
                type="text"
                value={newBlock.reason}
                onChange={(e) => setNewBlock((p) => ({ ...p, reason: e.target.value }))}
                placeholder={t("blocks.reasonPlaceholder")}
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
            {blockSaving ? tc("progress.saving") : t("blocks.add")}
          </button>
        </div>
        )}

        {/* Blocks list */}
        <div className="divide-y divide-gray-100">
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t("blocks.empty")}</div>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {t("blocks.range", {
                      start: new Date(block.startAt).toLocaleString(locale, {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      }),
                      end: new Date(block.endAt).toLocaleString(locale, {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      }),
                    })}
                  </p>
                  {block.reason && (
                    <p className="text-xs text-gray-500 mt-0.5">{block.reason}</p>
                  )}
                </div>
                {!readOnly && (
                <button
                  onClick={() => deleteBlock(block.id)}
                  aria-label={t("blocks.deleteAriaLabel")}
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
        <p className="font-semibold mb-1">{t("tip.title")}</p>
        <p className="text-amber-700">
          {t.rich("tip.body", {
            link: (chunks) => <Link href="/pricing" className="underline mx-1 hover:text-amber-900">{chunks}</Link>,
          })}
        </p>
      </div>
    </div>
  )
}
