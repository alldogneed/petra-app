"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Trash2, Edit2, Plus, CheckCircle, Calendar, CheckCircle2, XCircle, PawPrint } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import { LOST_REASON_CODES } from "@/lib/constants";
import LostReasonModal from "@/components/leads/LostReasonModal";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  stage: string;
  notes: string | null;
  customerId: string | null;
  lastContactedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReasonCode: string | null;
  lostReasonText: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
}

interface CallLog {
  id: string;
  summary: string;
  treatment: string;
  createdAt: string;
  updatedAt: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
  customerId?: string;
}

// ─── Toast Component ─────────────────────────────────────────────────────────

function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="animate-slide-up bg-white rounded-xl shadow-modal border border-petra-border p-4 max-w-sm w-full">
      <div className="flex items-start gap-3">
        {toast.type === "success" ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-petra-text font-medium">{toast.message}</p>
          {toast.customerId && (
            <Link
              href={`/customers/${toast.customerId}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg px-3 py-1.5 transition-colors"
            >
              <PawPrint className="w-3.5 h-3.5" />
              הוסף כלב עכשיו
            </Link>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="w-6 h-6 flex items-center justify-center rounded text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LeadDetailsModal({
  lead,
  isOpen,
  onClose,
}: {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"logs" | "task">("logs");
  const [summaryForm, setSummaryForm] = useState({ summary: "", treatment: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ description: "", dueDate: "" });
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const closed = lead.stage === "won" || lead.stage === "lost";

  const addToast = useCallback((message: string, type: "success" | "error", customerId?: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, customerId }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Close Won mutation ──────────────────────────────────────────────────
  const closeWonMutation = useMutation({
    mutationFn: (leadId: string) =>
      fetch(`/api/leads/${leadId}/close-won`, { method: "POST" }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || "Failed");
        }
        return r.json();
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      addToast("הליד נסגר ונוצר לקוח חדש", "success", data.customerId);
    },
    onError: (err: Error) => {
      addToast(err.message || "שגיאה בסגירת הליד", "error");
    },
  });

  // ─── Close Lost mutation ─────────────────────────────────────────────────
  const closeLostMutation = useMutation({
    mutationFn: ({ leadId, reasonCode, reasonText }: { leadId: string; reasonCode: string; reasonText: string | null }) =>
      fetch(`/api/leads/${leadId}/close-lost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCode, reasonText }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || "Failed");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setLostModalOpen(false);
      addToast("הליד סומן כאבוד ונשמרה הסיבה.", "success");
    },
    onError: (err: Error) => {
      addToast(err.message || "שגיאה בסימון הליד כאבוד", "error");
    },
  });

  const isClosing = closeWonMutation.isPending || closeLostMutation.isPending;

  const handleCloseWon = () => {
    if (isClosing) return;
    if (confirm("לסגור ליד וליצור לקוח?")) {
      closeWonMutation.mutate(lead.id);
    }
  };

  const handleCloseLost = () => {
    if (isClosing) return;
    setLostModalOpen(true);
  };

  const handleLostConfirm = (reasonCode: string, reasonText: string | null) => {
    closeLostMutation.mutate({
      leadId: lead.id,
      reasonCode,
      reasonText,
    });
  };

  // ─── Call logs ───────────────────────────────────────────────────────────

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ["callLogs", lead.id],
    queryFn: () =>
      fetch(`/api/leads/${lead.id}/call-logs`).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
    enabled: isOpen,
  });

  const callLogMutation = useMutation({
    mutationFn: async (data: typeof summaryForm) => {
      if (editingId) {
        const res = await fetch(`/api/leads/${lead.id}/call-logs/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        return res.json();
      } else {
        const res = await fetch(`/api/leads/${lead.id}/call-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callLogs", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setSummaryForm({ summary: "", treatment: "" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (logId: string) =>
      fetch(`/api/leads/${lead.id}/call-logs/${logId}`, {
        method: "DELETE",
      }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callLogs", lead.id] });
    },
  });

  // ─── Task ────────────────────────────────────────────────────────────────

  const taskMutation = useMutation({
    mutationFn: async (data: typeof taskForm) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `טיפול בליד: ${lead.name}`,
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
          priority: "HIGH",
        }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskForm({ description: "", dueDate: "" });
      setActiveTab("logs");
    },
  });

  const handleEditLog = (log: CallLog) => {
    setSummaryForm({ summary: log.summary, treatment: log.treatment });
    setEditingId(log.id);
  };

  const handleCancelEdit = () => {
    setSummaryForm({ summary: "", treatment: "" });
    setEditingId(null);
  };

  const handleAddCallLog = () => {
    if (!summaryForm.summary.trim() || !summaryForm.treatment.trim()) return;
    callLogMutation.mutate(summaryForm);
  };

  const handleCreateTask = () => {
    if (!taskForm.description.trim() || !taskForm.dueDate) return;
    taskMutation.mutate(taskForm);
  };

  const lostReasonLabel = lead.lostReasonCode
    ? LOST_REASON_CODES.find((r) => r.id === lead.lostReasonCode)?.label ?? lead.lostReasonCode
    : null;

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-backdrop" onClick={onClose} />
        <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-petra-text">{lead.name}</h2>
              <p className="text-sm text-petra-muted mt-0.5">ניהול רשומות וטיפולים</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Outcome Buttons or Status Banner */}
          {closed ? (
            <div
              className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm font-medium"
              style={{
                backgroundColor: lead.stage === "won" ? "#F0FDF4" : "#FEF2F2",
                color: lead.stage === "won" ? "#16A34A" : "#DC2626",
                border: `1px solid ${lead.stage === "won" ? "#BBF7D0" : "#FECACA"}`,
              }}
            >
              {lead.stage === "won" ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  ליד נסגר בהצלחה
                  {lead.wonAt && <span className="text-xs opacity-75 mr-1">· {formatDate(lead.wonAt)}</span>}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  ליד אבוד
                  {lostReasonLabel && <span className="text-xs opacity-75 mr-1">· {lostReasonLabel}</span>}
                  {lead.lostReasonText && <span className="text-xs opacity-75 mr-1">({lead.lostReasonText})</span>}
                </>
              )}
            </div>
          ) : (
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleCloseWon}
                disabled={isClosing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                {closeWonMutation.isPending ? "סוגר..." : "נסגר"}
              </button>
              <button
                onClick={handleCloseLost}
                disabled={isClosing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle className="w-4 h-4" />
                אבוד
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-petra-border">
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "logs"
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-petra-muted hover:text-petra-text"
              }`}
            >
              רשומות שיחה
            </button>
            <button
              onClick={() => setActiveTab("task")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "task"
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-petra-muted hover:text-petra-text"
              }`}
            >
              משימה קדימה
            </button>
          </div>

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div className="space-y-4">
              {/* Form */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div>
                  <label className="label">סיכום השיחה *</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder="תיאור קצר של השיחה..."
                    value={summaryForm.summary}
                    onChange={(e) =>
                      setSummaryForm({ ...summaryForm, summary: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">הטיפול שתעשה *</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder="מה הצעדים הבאים?"
                    value={summaryForm.treatment}
                    onChange={(e) =>
                      setSummaryForm({ ...summaryForm, treatment: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCallLog}
                    disabled={
                      !summaryForm.summary.trim() ||
                      !summaryForm.treatment.trim() ||
                      callLogMutation.isPending
                    }
                    className="btn-primary flex-1"
                  >
                    <Plus className="w-4 h-4" />
                    {editingId ? "עדכן" : "הוסף"} רשומה
                  </button>
                  {editingId && (
                    <button
                      onClick={handleCancelEdit}
                      className="btn-secondary"
                    >
                      ביטול
                    </button>
                  )}
                </div>
              </div>

              {/* Call Logs List */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-petra-text">רשומות קודמות</h3>
                {isLoading ? (
                  <div className="text-center py-6 text-petra-muted text-sm">
                    טוען...
                  </div>
                ) : callLogs.length === 0 ? (
                  <div className="text-center py-6 text-petra-muted text-sm">
                    אין רשומות שיחה עדיין
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {callLogs.map((log: CallLog) => (
                      <div
                        key={log.id}
                        className="bg-white border border-petra-border rounded-lg p-3 hover:border-brand-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-petra-muted">
                              {formatDate(log.createdAt)} בשעה{" "}
                              {formatTime(log.createdAt)}
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleEditLog(log)}
                              className="w-6 h-6 flex items-center justify-center rounded text-petra-muted hover:text-brand-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(log.id)}
                              className="w-6 h-6 flex items-center justify-center rounded text-petra-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-0.5">
                              סיכום
                            </p>
                            <p className="text-sm text-petra-text">{log.summary}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-0.5">
                              טיפול
                            </p>
                            <p className="text-sm text-petra-text">{log.treatment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Task Tab */}
          {activeTab === "task" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm text-blue-800">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>המשימה תופיע בדשבורד בתאריך שנבחר</p>
              </div>

              <div>
                <label className="label">תיאור המשימה *</label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  placeholder="תיאור מפורט של המשימה..."
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">תאריך הטיפול *</label>
                <input
                  type="date"
                  className="input"
                  value={taskForm.dueDate}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, dueDate: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateTask}
                  disabled={
                    !taskForm.description.trim() ||
                    !taskForm.dueDate ||
                    taskMutation.isPending
                  }
                  className="btn-primary flex-1"
                >
                  <Calendar className="w-4 h-4" />
                  {taskMutation.isPending ? "יוצר..." : "צור משימה"}
                </button>
                <button onClick={onClose} className="btn-secondary">
                  סגור
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lost Reason Modal */}
      <LostReasonModal
        isOpen={lostModalOpen}
        onClose={() => setLostModalOpen(false)}
        onConfirm={handleLostConfirm}
        isPending={closeLostMutation.isPending}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-6 z-[70] flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastNotification
              key={toast.id}
              toast={toast}
              onDismiss={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
