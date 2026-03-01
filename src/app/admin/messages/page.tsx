"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  Users,
  RefreshCw,
  X,
} from "lucide-react";

const MESSAGE_TYPES = [
  { value: "info",    label: "מידע",    icon: Info,           color: "#06B6D4" },
  { value: "success", label: "הצלחה",   icon: CheckCircle2,   color: "#22C55E" },
  { value: "warning", label: "אזהרה",   icon: AlertTriangle,  color: "#F59E0B" },
  { value: "error",   label: "שגיאה/חירום", icon: XCircle,   color: "#EF4444" },
];

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Broadcast {
  title: string;
  content: string;
  type: string;
  sentAt: string;
  businesses: number;
}

export default function AdminMessagesPage() {
  const qc = useQueryClient();

  // Form state
  const [title, setTitle]           = useState("");
  const [content, setContent]       = useState("");
  const [type, setType]             = useState("info");
  const [actionUrl, setActionUrl]   = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [expiresAt, setExpiresAt]   = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // History
  const { data: historyData, isLoading: historyLoading, refetch } = useQuery({
    queryKey: ["admin-broadcast-history"],
    queryFn: () => fetch("/api/admin/broadcast-messages").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const broadcasts: Broadcast[] = historyData?.broadcasts ?? [];

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: (payload: object) =>
      fetch("/api/admin/broadcast-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "שגיאה בשליחה");
        return json;
      }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setType("info");
      setActionUrl("");
      setActionLabel("");
      setExpiresAt("");
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ["admin-broadcast-history"] });
    },
  });

  const selectedType = MESSAGE_TYPES.find((t) => t.value === type) ?? MESSAGE_TYPES[0];
  const TypeIcon = selectedType.icon;

  function handleSend() {
    if (!title.trim() || !content.trim()) return;
    sendMutation.mutate({
      title,
      content,
      type,
      actionUrl: actionUrl || undefined,
      actionLabel: actionLabel || undefined,
      expiresAt: expiresAt || undefined,
    });
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">הודעות שידור</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            שלח הודעת מערכת לכל המשתמשים בפטרה
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
          <Megaphone className="w-5 h-5" style={{ color: "#F97316" }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Compose form ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <h2 className="text-sm font-semibold text-white">הרכבת הודעה</h2>
            <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
              ההודעה תופיע בממשק של כל משתמש רשום בפלטפורמה
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Message type selector */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#94A3B8" }}>
                סוג הודעה
              </label>
              <div className="flex gap-2 flex-wrap">
                {MESSAGE_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: active ? `${t.color}18` : "#0A0A0F",
                        color: active ? t.color : "#64748B",
                        border: `1px solid ${active ? `${t.color}30` : "#1E1E2E"}`,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>
                כותרת *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="לדוגמה: עדכון מערכת חשוב"
                dir="rtl"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-600"
                style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              />
              <div className="text-right text-[10px] mt-1" style={{ color: "#334155" }}>
                {title.length}/120
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>
                תוכן ההודעה *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="פרט את תוכן העדכון או השינוי..."
                dir="rtl"
                rows={5}
                maxLength={1000}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-600 resize-none"
                style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              />
              <div className="text-right text-[10px] mt-1" style={{ color: "#334155" }}>
                {content.length}/1000
              </div>
            </div>

            {/* Optional: action link */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>
                  כתובת קישור (אופציונלי)
                </label>
                <input
                  type="url"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-600"
                  style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>
                  טקסט כפתור (אופציונלי)
                </label>
                <input
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="לפרטים נוספים"
                  dir="rtl"
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-600"
                  style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
                />
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>
                תאריך תפוגה (אופציונלי — ברירת מחדל: ללא תפוגה)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              />
            </div>

            {/* Preview banner */}
            {(title || content) && (
              <div
                className="rounded-xl p-4 flex gap-3"
                style={{
                  background: `${selectedType.color}08`,
                  border: `1px solid ${selectedType.color}20`,
                }}
              >
                <TypeIcon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: selectedType.color }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: selectedType.color }}>
                    {title || "כותרת ההודעה"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {content || "תוכן ההודעה יופיע כאן..."}
                  </p>
                  {actionUrl && actionLabel && (
                    <span
                      className="inline-block mt-2 text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: `${selectedType.color}15`, color: selectedType.color }}
                    >
                      {actionLabel}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {sendMutation.isError && (
              <div
                className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {(sendMutation.error as Error).message}
              </div>
            )}

            {/* Success */}
            {sendMutation.isSuccess && (
              <div
                className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ההודעה נשלחה בהצלחה לכל העסקים!
              </div>
            )}

            {/* Send button */}
            {!showConfirm ? (
              <button
                onClick={() => {
                  if (!title.trim() || !content.trim()) return;
                  setShowConfirm(true);
                }}
                disabled={!title.trim() || !content.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(249,115,22,0.15)",
                  color: "#F97316",
                  border: "1px solid rgba(249,115,22,0.25)",
                }}
              >
                <Send className="w-4 h-4" />
                שלח לכל המשתמשים
              </button>
            ) : (
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}
              >
                <p className="text-sm text-white font-medium">
                  אישור שליחה
                </p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  פעולה זו תשלח את ההודעה לכל העסקים הפעילים בפטרה ולא ניתן לביטול. האם להמשיך?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: "rgba(249,115,22,0.2)", color: "#F97316" }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendMutation.isPending ? "שולח..." : "כן, שלח"}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={sendMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: "#1E1E2E", color: "#64748B" }}
                  >
                    <X className="w-3.5 h-3.5" />
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── History ───────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <h2 className="text-sm font-semibold text-white">היסטוריית שידורים</h2>
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: "#475569" }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[600px]">
            {historyLoading ? (
              <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
            ) : !broadcasts.length ? (
              <div className="p-8 text-center">
                <Megaphone className="w-8 h-8 mx-auto mb-3" style={{ color: "#1E1E2E" }} />
                <p className="text-sm" style={{ color: "#475569" }}>לא נשלחו הודעות עדיין</p>
              </div>
            ) : (
              broadcasts.map((b, i) => {
                const t = MESSAGE_TYPES.find((t) => t.value === b.type) ?? MESSAGE_TYPES[0];
                const Icon = t.icon;
                return (
                  <div
                    key={i}
                    className="px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: "1px solid #1E1E2E" }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${t.color}15` }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{b.title}</p>
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: "#64748B" }}
                        >
                          {b.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: "#475569" }}>
                            <Clock className="w-3 h-3" />
                            {relativeTime(b.sentAt)}
                          </span>
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: "#475569" }}>
                            <Users className="w-3 h-3" />
                            {Number(b.businesses)} עסקים
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md"
                            style={{ background: `${t.color}12`, color: t.color }}
                          >
                            {t.label}
                          </span>
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: "#334155" }}>
                          {formatDate(b.sentAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
