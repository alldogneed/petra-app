"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  Plus,
  PenLine,
  Trash2,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

// ── System Messages Tab ───────────────────────────────────────────

interface SystemMsg {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  actionUrl?: string | null;
  actionLabel?: string | null;
  isRead: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

const MSG_TYPE_LABELS: Record<string, string> = {
  info: "מידע",
  warning: "אזהרה",
  success: "הצלחה",
  error: "שגיאה",
};
const MSG_TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-700",
};

const EMPTY_FORM = { title: "", content: "", type: "info" as const, actionUrl: "", actionLabel: "", expiresAt: "" };

export function SystemMessagesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ messages: SystemMsg[] }>({
    queryKey: ["system-messages-admin"],
    queryFn: () => fetch("/api/system-messages?all=true").then((r) => r.json()),
    staleTime: 10000,
  });
  const messages = data?.messages ?? [];

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        content: form.content,
        type: form.type,
        actionUrl: form.actionUrl || null,
        actionLabel: form.actionLabel || null,
        expiresAt: form.expiresAt || null,
      };
      if (editingId) {
        return fetch(`/api/system-messages/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json());
      }
      return fetch("/api/system-messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-messages-admin"] });
      qc.invalidateQueries({ queryKey: ["systemMessages"] });
      toast.success(editingId ? "הודעה עודכנה" : "הודעה נוצרה");
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/system-messages/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-messages-admin"] });
      qc.invalidateQueries({ queryKey: ["systemMessages"] });
      toast.success("הודעה נמחקה");
      setConfirmDeleteId(null);
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  function startEdit(msg: SystemMsg) {
    setEditingId(msg.id);
    setForm({
      title: msg.title,
      content: msg.content,
      type: msg.type as typeof EMPTY_FORM.type,
      actionUrl: msg.actionUrl ?? "",
      actionLabel: msg.actionLabel ?? "",
      expiresAt: msg.expiresAt ? msg.expiresAt.slice(0, 16) : "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-petra-muted">{messages.length} הודעות במערכת</p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            הודעה חדשה
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-slate-50 border border-petra-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-petra-text">
            {editingId ? "עריכת הודעה" : "הודעה חדשה"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <input
                placeholder="כותרת *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input w-full text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <textarea
                placeholder="תוכן ההודעה *"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={3}
                className="input w-full text-sm resize-none"
              />
            </div>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}
              className="input text-sm"
            >
              <option value="info">מידע</option>
              <option value="warning">אזהרה</option>
              <option value="success">הצלחה</option>
              <option value="error">שגיאה</option>
            </select>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="input text-sm"
              placeholder="תפוגה (אופציונלי)"
            />
            <input
              placeholder="כתובת קישור (אופציונלי)"
              value={form.actionUrl}
              onChange={(e) => setForm((f) => ({ ...f, actionUrl: e.target.value }))}
              className="input text-sm"
              dir="ltr"
            />
            <input
              placeholder="טקסט לכפתור (אופציונלי)"
              value={form.actionLabel}
              onChange={(e) => setForm((f) => ({ ...f, actionLabel: e.target.value }))}
              className="input text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={!form.title || !form.content || save.isPending}
              className="btn-primary text-sm gap-1.5"
            >
              {save.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {editingId ? "שמור שינויים" : "צור הודעה"}
            </button>
            <button onClick={cancelForm} className="btn-secondary text-sm">
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="bg-white border border-petra-border rounded-xl overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-petra-muted">אין הודעות מערכת</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-petra-muted w-20">סוג</th>
                <th className="text-right px-4 py-3 font-medium text-petra-muted">כותרת / תוכן</th>
                <th className="text-right px-4 py-3 font-medium text-petra-muted hidden sm:table-cell w-28">תאריך</th>
                <th className="text-right px-4 py-3 font-medium text-petra-muted hidden md:table-cell w-24">סטטוס</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => {
                const isExpired = msg.expiresAt && new Date(msg.expiresAt) < new Date();
                return (
                  <tr key={msg.id} className={`border-b border-slate-50 last:border-0 ${isExpired ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${MSG_TYPE_COLORS[msg.type]}`}>
                        {MSG_TYPE_LABELS[msg.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-petra-text truncate max-w-[160px] sm:max-w-xs">{msg.title}</p>
                      <p className="text-[11px] text-petra-muted truncate max-w-[160px] sm:max-w-xs mt-0.5">{msg.content}</p>
                    </td>
                    <td className="px-4 py-3 text-petra-muted text-xs hidden sm:table-cell">
                      {new Date(msg.createdAt).toLocaleDateString("he-IL")}
                      {isExpired && <span className="block text-red-400">פג תוקף</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${msg.isRead ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand-600 font-medium"}`}>
                        {msg.isRead ? "נקרא" : "לא נקרא"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {confirmDeleteId === msg.id ? (
                          <>
                            <button
                              onClick={() => del.mutate(msg.id)}
                              className="text-[11px] text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors"
                            >
                              מחק
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-petra-muted hover:text-petra-text px-2 py-1 rounded-lg transition-colors"
                            >
                              ביטול
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(msg)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="ערוך"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(msg.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="מחק"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
