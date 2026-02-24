"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";

interface FeatureFlag {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export default function OwnerSettingsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("false");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    fetch("/api/owner/feature-flags")
      .then((r) => r.json())
      .then(setFlags)
      .finally(() => setLoading(false));
  }, []);

  async function toggleFlag(flag: FeatureFlag) {
    setSaving(flag.key);
    const current = JSON.parse(flag.value);
    const newVal = !current;
    const res = await fetch("/api/owner/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: flag.key, value: newVal, description: flag.description }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? updated : f)));
    }
    setSaving(null);
  }

  async function addFlag() {
    if (!newKey) return;
    let parsedValue: unknown = newValue;
    try { parsedValue = JSON.parse(newValue); } catch {}
    const res = await fetch("/api/owner/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey, value: parsedValue, description: newDesc || undefined }),
    });
    if (res.ok) {
      const flag = await res.json();
      setFlags((prev) => [...prev.filter((f) => f.key !== flag.key), flag]);
      setNewKey("");
      setNewValue("false");
      setNewDesc("");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Platform Settings</h1>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Feature Flags</h2>
          <p className="text-xs text-slate-400 mt-0.5">Global boolean or JSON settings for platform features</p>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {flags.map((flag) => {
              let parsedValue: unknown;
              try { parsedValue = JSON.parse(flag.value); } catch { parsedValue = flag.value; }
              const isBool = typeof parsedValue === "boolean";
              return (
                <div key={flag.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-medium text-slate-800">{flag.key}</div>
                    {flag.description && (
                      <div className="text-xs text-slate-400 mt-0.5">{flag.description}</div>
                    )}
                  </div>
                  {isBool ? (
                    <button
                      onClick={() => toggleFlag(flag)}
                      disabled={saving === flag.key}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        parsedValue ? "bg-orange-500" : "bg-slate-200"
                      } ${saving === flag.key ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          parsedValue ? "translate-x-5" : "translate-x-0"
                        }`}
                        style={{ transform: parsedValue ? "translateX(-20px)" : "translateX(0)" }}
                      />
                    </button>
                  ) : (
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      {flag.value}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
            {flags.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No flags configured yet</div>
            )}
          </div>
        )}

        {/* Add new flag */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-xs font-medium text-slate-600 mb-3">Add / update flag</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="flag.key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
              dir="ltr"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="text"
              placeholder="value (JSON)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              dir="ltr"
              className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="text"
              placeholder="description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={addFlag}
              disabled={!newKey}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
