"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Megaphone, Loader2, CheckCircle } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { toast } from "sonner";

interface Business {
  id: string;
  name: string;
  status: string;
}

const TYPE_OPTIONS = [
  { value: "info", label: "מידע", color: "bg-blue-100 text-blue-700" },
  { value: "update", label: "עדכון מוצר", color: "bg-violet-100 text-violet-700" },
  { value: "warning", label: "אזהרה", color: "bg-amber-100 text-amber-700" },
];

export default function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"info" | "warning" | "update">("info");
  const [targetBusinessId, setTargetBusinessId] = useState<string>("");
  const [lastResult, setLastResult] = useState<{ sent: number } | null>(null);

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ["owner", "tenants", "list"],
    queryFn: () => fetchJSON("/api/owner/tenants").then((d: unknown) => {
      const res = d as { tenants?: Business[] } | Business[];
      return Array.isArray(res) ? res : (res.tenants ?? []);
    }),
  });

  const activeBusinesses = (businesses ?? []).filter((b) => b.status === "active");

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/owner/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          type,
          ...(targetBusinessId ? { targetBusinessId } : {}),
        }),
      }),
    onSuccess: (data: unknown) => {
      const result = data as { sent: number };
      setLastResult(result);
      setTitle("");
      setContent("");
      setType("info");
      setTargetBusinessId("");
      toast.success(`הודעה נשלחה ל-${result.sent} עסקים`);
    },
    onError: () => toast.error("שגיאה בשליחת ההודעה"),
  });

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="page-title">שידור הודעה</h1>
          <p className="text-sm text-slate-400">שליחת הודעת מערכת לכל העסקים או לעסק ספציפי</p>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        {/* Type */}
        <div>
          <div className="label mb-2">סוג הודעה</div>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value as "info" | "warning" | "update")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  type === opt.value
                    ? opt.color + " ring-2 ring-current ring-offset-1"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="label">כותרת</label>
          <input
            type="text"
            className="input mt-1"
            placeholder="לדוגמה: עדכון גרסה 2.1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Content */}
        <div>
          <label className="label">תוכן</label>
          <textarea
            className="input mt-1 min-h-[120px] resize-y"
            placeholder="פרטי ההודעה..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
          />
          <p className="text-xs text-slate-400 mt-1 text-left">{content.length}/2000</p>
        </div>

        {/* Target */}
        <div>
          <div className="label mb-1">יעד</div>
          <select
            className="input"
            value={targetBusinessId}
            onChange={(e) => setTargetBusinessId(e.target.value)}
          >
            <option value="">כל העסקים הפעילים ({activeBusinesses.length})</option>
            {activeBusinesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</>
          ) : (
            <><Megaphone className="w-4 h-4" /> שלח הודעה</>
          )}
        </button>

        {lastResult && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ההודעה נשלחה בהצלחה ל-{lastResult.sent} עסקים
          </div>
        )}
      </div>
    </div>
  );
}
