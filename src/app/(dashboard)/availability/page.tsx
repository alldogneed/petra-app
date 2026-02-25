"use client"

import { useState, useEffect } from "react"
import { Save, Plus, Trash2, Clock, CalendarOff, ExternalLink } from "lucide-react"
import Link from "next/link"

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

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

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

  const DEMO_SLUG = "demo"

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/availability")
      .then((r) => r.json())
      .then((d) => { setRules(d.rules ?? []); setRulesLoading(false) })

    fetch("/api/admin/blocks")
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks ?? []))
  }, [])

  // ── Save working hours ──────────────────────────────────────────────────────
  const saveRules = async () => {
    setRulesSaving(true)
    await fetch("/api/admin/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    })
    setRulesSaving(false)
    setRulesSaved(true)
    setTimeout(() => setRulesSaved(false), 2000)
  }

  // ── Add block ───────────────────────────────────────────────────────────────
  const addBlock = async () => {
    if (!newBlock.startAt || !newBlock.endAt) return
    setBlockSaving(true)
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBlock),
    })
    const data = await res.json()
    setBlocks((prev) => [...prev, data.block].sort((a, b) => a.startAt.localeCompare(b.startAt)))
    setNewBlock({ startAt: "", endAt: "", reason: "" })
    setBlockSaving(false)
  }

  // ── Delete block ─────────────────────────────────────────────────────────────
  const deleteBlock = async (id: string) => {
    await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" })
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const updateRule = (dayOfWeek: number, field: keyof AvailabilityRule, value: unknown) => {
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r))
    )
    setRulesSaved(false)
  }

  // ─────────────────────────────────────────────────────────────────────────────

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
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-gray-400">עד</span>
                    <select
                      value={rule.closeTime}
                      onChange={(e) => updateRule(rule.dayOfWeek, "closeTime", e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
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
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarOff className="w-5 h-5 text-red-400" />
          <h2 className="font-semibold text-gray-800">חסימות וחופשות</h2>
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">עד תאריך ושעה</label>
              <input
                type="datetime-local"
                value={newBlock.endAt}
                onChange={(e) => setNewBlock((p) => ({ ...p, endAt: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סיבה (אופציונלי)</label>
              <input
                type="text"
                value={newBlock.reason}
                onChange={(e) => setNewBlock((p) => ({ ...p, reason: e.target.value }))}
                placeholder="חופשה, יום סגור..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
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
