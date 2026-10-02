"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { X, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { fetchJSON } from "@/lib/utils";

export const TASK_CATEGORIES = [
  { id: "GENERAL", label: "כללי" },
  { id: "BOARDING", label: "פנסיון" },
  { id: "TRAINING", label: "אילוף" },
  { id: "LEADS", label: "לידים" },
  { id: "HEALTH", label: "בריאות" },
  { id: "MEDICATION", label: "תרופות" },
  { id: "FEEDING", label: "האכלה" },
];

export const TASK_PRIORITIES = [
  { id: "LOW", label: "נמוכה" },
  { id: "MEDIUM", label: "בינונית" },
  { id: "HIGH", label: "גבוהה" },
  { id: "URGENT", label: "דחופה" },
];

export function QuickTaskModal({
  customerId,
  customerName,
  onClose,
  onSuccess,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "",
    category: "GENERAL",
    priority: "MEDIUM",
    dueDate: today,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJSON("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          category: data.category,
          priority: data.priority,
          dueDate: data.dueDate || undefined,
          relatedEntityType: "customer",
          relatedEntityId: customerId,
        }),
      }),
    onSuccess: () => {
      toast.success(`משימה נוצרה עבור ${customerName}`);
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-petra-text">
            <span className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-brand-500" />
              משימה חדשה — {customerName}
            </span>
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">כותרת *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="תאר את המשימה..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <select
                className="input w-full"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">עדיפות</label>
              <select
                className="input w-full"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">תאריך יעד</label>
            <input
              type="date" lang="he"
              className="input w-full"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              className="btn-primary flex-1"
              disabled={!form.title.trim() || mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "שומר..." : "צור משימה"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 text-center">שגיאה ביצירת המשימה. נסה שוב.</p>
          )}
        </div>
      </div>
    </div>
  );
}
