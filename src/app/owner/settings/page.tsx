"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { fetchJSON, cn } from "@/lib/utils";

interface FeatureFlag {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export default function OwnerSettingsPage() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("false");
  const [newDesc, setNewDesc] = useState("");

  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["owner", "feature-flags"],
    queryFn: () => fetchJSON("/api/owner/feature-flags"),
  });

  const toggleMutation = useMutation({
    mutationFn: (flag: FeatureFlag) => {
      const current = JSON.parse(flag.value);
      return fetchJSON("/api/owner/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flag.key, value: !current, description: flag.description }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner", "feature-flags"] }),
  });

  const addMutation = useMutation({
    mutationFn: () => {
      let parsedValue: unknown = newValue;
      try { parsedValue = JSON.parse(newValue); } catch { /* keep as string */ }
      return fetchJSON("/api/owner/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: parsedValue, description: newDesc || undefined }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "feature-flags"] });
      setNewKey("");
      setNewValue("false");
      setNewDesc("");
    },
  });

  return (
    <div>
      <h1 className="page-title mb-6">הגדרות פלטפורמה</h1>

      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Feature Flags</h2>
          <p className="text-xs text-slate-400 mt-0.5">הגדרות בוליאניות או JSON גלובליות לפיצ׳רים של הפלטפורמה</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {flags.map((flag) => {
              let parsedValue: unknown;
              try { parsedValue = JSON.parse(flag.value); } catch { parsedValue = flag.value; }
              const isBool = typeof parsedValue === "boolean";
              const isToggling = toggleMutation.isPending;
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
                      onClick={() => toggleMutation.mutate(flag)}
                      disabled={isToggling}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        parsedValue ? "bg-orange-500" : "bg-slate-200",
                        isToggling && "opacity-50"
                      )}
                      dir="ltr"
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          parsedValue ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  ) : (
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      {flag.value}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(flag.updatedAt).toLocaleDateString("he-IL")}
                  </span>
                </div>
              );
            })}
            {flags.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">אין flags מוגדרים עדיין</div>
            )}
          </div>
        )}

        {/* Add new flag */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-xs font-medium text-slate-600 mb-3">הוספה / עדכון flag</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="flag.key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
              dir="ltr"
              className="input flex-1 font-mono"
            />
            <input
              type="text"
              placeholder="ערך (JSON)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              dir="ltr"
              className="input w-32 font-mono"
            />
            <input
              type="text"
              placeholder="תיאור (אופציונלי)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input flex-1"
            />
            <button
              onClick={() => addMutation.mutate()}
              disabled={!newKey || addMutation.isPending}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              שמור
            </button>
          </div>
          {addMutation.error && (
            <p className="text-xs text-red-600 mt-2">{(addMutation.error as Error).message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
