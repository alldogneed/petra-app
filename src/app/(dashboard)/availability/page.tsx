"use client"

import { useState, useEffect } from "react"
import { Save, Plus, Trash2, Clock, CalendarOff, ExternalLink, Settings2, Coffee, CalendarDays } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AvailabilityRule {
  id: string
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

  const DEMO_SLUG = "demo"

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/availability")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => { setRules(d.rules ?? []); setRulesLoading(false) })
      .catch(() => setRulesLoading(false))

    fetch("/api/admin/blocks")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => setBlocks(d.blocks ?? []))
      .catch(() => {})

    fetch("/api/availability/settings")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => setBookingSettings(d))
      .catch(() => {})

    fetch("/api/availability/breaks")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((d) => setBreaks(d.breaks ?? []))
      .catch(() => {})
  }, [])

  // ── Save working hours ──────────────────────────────────────────────────────
  const saveRules = async () => {
    setRulesSaving(true)
    try {
      const res = await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      })
      if (!res.ok) throw new Error("Failed")
      setRulesSaved(true)
      setTimeout(() => setRulesSaved(false), 2000)
    } catch {
      toast.error("שגיאה בשמירת שעות הפעילות")
    } finally {
      setRulesSaving(false)
    }
  }

  // ── Save booking settings ───────────────────────────────────────────────────
  const saveBookingSettings = async () => {
    setSettingsSaving(true)
    try {
      const res = await fetch("/api/availability/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingSettings),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("הגדרות תיאום נשמרו")
    } catch {
      toast.error("שגיאה בשמירת ההגדרות")
    } finally {
      setSettingsSaving(false)
    }
  }

  // ── Add block ───────────────────────────────────────────────────────────────
  const addBlock = async () => {
    if (!newBlock.startAt || !newBlock.endAt) return
    setBlockSaving(true)
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBlock),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setBlocks((prev) => [...prev, data.block].sort((a, b) => a.startAt.localeCompare(b.startAt)))
      setNewBlock({ startAt: "", endAt: "", reason: "" })
    } catch {
      toast.error("שגיאה בהוספת חסימה")
    } finally {
      setBlockSaving(false)
    }
  }

  // ── Delete block ─────────────────────────────────────────────────────────────
  const deleteBlock = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      setBlocks((prev) => prev.filter((b) => b.id !== id))
    } catch {
      toast.error("שגיאה במחיקת החסימה")
    }
  }

  // ── Add break ──────────────────────────────────────────────────────────────
  const addBreak = async () => {
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
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setBreaks((prev) => [...prev, data.break])
      setNewBreak({ dayOfWeek: -1, startTime: "13:00", endTime: "14:00", label: "" })
      toast.success("הפסקה נוספה")
    } catch {
      toast.error("שגיאה בהוספת הפסקה")
    } finally {
      setBreakSaving(false)
    }
  }

  // ── Delete break ────────────────────────────────────────────────────────────
  const deleteBreak = async (id: string) => {
    try {
      const res = await fetch(`/api/availability/breaks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      setBreaks((prev) => prev.filter((b) => b.id !== id))
    } catch {
      toast.error("שגיאה במחיקת ההפסקה")
    }
  }

  // ── Import holidays ─────────────────────────────────────────────────────────
  const importHolidays = async () => {
    setHolidaysImporting(true)
    try {
      const res = await fetch("/api/availability/import-holidays", { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      toast.success(`נוצרו ${data.created} חסימות חגים`)
      // Reload blocks
      const blocksRes = await fetch("/api/admin/blocks")
      if (blocksRes.ok) {
        const d = await blocksRes.json()
        setBlocks(d.blocks ?? [])
      }
    } catch {
      toast.error("שגיאה בייבוא חגים")
    } finally {
      setHolidaysImporting(false)
    }
  }

  const updateRule = (dayOfWeek: number, field: keyof AvailabilityRule, value: unknown) => {
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
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">זמינות ושעות פעילות</h1>
        <p className="text-gray-500 text-sm">הגדר מתי לקוחות יכולים להזמין תורים</p>
        <Link
          href={`/book/${DEMO_SLUG}`}
          target="_blank"
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg px-3 py-2 hover:bg-amber-50"
        >
          <ExternalLink className="w-4 h-4" />
          דף ההזמנה
        </Link>
      </div>

      {/* ── Section A: Booking Settings ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800">הגדרות תיאום</h2>
        </div>
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
                  bookingSettings.gcalBlockExternal ? "translate-x-0" : "translate-x-5"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">חסום פגישות גוגל קלנדר (כולל אישיות)</span>
          </label>
          <button
            onClick={saveBookingSettings}
            disabled={settingsSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold rounded-lg text-sm"
          >
            <Save className="w-4 h-4" />
            {settingsSaving ? "שומר..." : "שמור הגדרות"}
          </button>
        </div>
      </div>

      {/* ── Section B: Daily Breaks ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Coffee className="w-5 h-5 text-orange-400" />
          <h2 className="font-semibold text-gray-800">הפסקות יומיות</h2>
        </div>

        {/* Add break form */}
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
                <button
                  onClick={() => deleteBreak(br.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
        </div>

        <div className="divide-y divide-gray-100">
          {rulesLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full" />
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.dayOfWeek}
                className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                  rule.isOpen ? "" : "bg-gray-50 opacity-60"
                }`}
              >
                {/* Day name */}
                <span className="w-16 text-sm font-medium text-gray-700 flex-shrink-0">
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
                      rule.isOpen ? "translate-x-0" : "translate-x-5"
                    }`}
                  />
                </button>

                {/* Times */}
                {rule.isOpen ? (
                  <div className="flex items-center gap-2 text-sm">
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
      </div>

      {/* ── Blocks Card ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-red-400" />
            <h2 className="font-semibold text-gray-800">חסימות וחופשות</h2>
          </div>
          {/* Section C: Import Israeli holidays */}
          <button
            onClick={importHolidays}
            disabled={holidaysImporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
          >
            <CalendarDays className="w-4 h-4" />
            {holidaysImporting ? "מייבא..." : "ייבא חגי ישראל 5786-5787"}
          </button>
        </div>

        {/* Add block form */}
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
                    {" → "}
                    {new Date(block.endAt).toLocaleString("he-IL", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {block.reason && (
                    <p className="text-xs text-gray-500 mt-0.5">{block.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteBlock(block.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
          <Link href="/settings" className="underline mx-1 hover:text-amber-900">הגדרות → שירותים</Link>
          {`והפעל "זמין להזמנה אונליין" עבור כל שירות רצוי.`}
        </p>
      </div>
    </div>
  )
}
