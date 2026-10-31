"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { X, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { fetchJSON } from "@/lib/utils";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

export const TASK_CATEGORIES = [
  { id: "GENERAL" },
  { id: "BOARDING" },
  { id: "TRAINING" },
  { id: "LEADS" },
  { id: "HEALTH" },
  { id: "MEDICATION" },
  { id: "FEEDING" },
];

export const TASK_PRIORITIES = [
  { id: "LOW" },
  { id: "MEDIUM" },
  { id: "HIGH" },
  { id: "URGENT" },
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
  const t = useTranslations("customers.quickTaskModal");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
      toast.success(t("created", { name: customerName }));
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
              {t("title", { name: customerName })}
            </span>
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("titleLabel")}</label>
            <input
              type="text"
              className="input w-full"
              placeholder={t("titlePlaceholder")}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("category")}</label>
              <select
                className="input w-full"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("priority")}</label>
              <select
                className="input w-full"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{t(`priorities.${p.id}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t("dueDate")}</label>
            <input
              type="date" lang={cfg.lang}
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
              {mutation.isPending ? tc("progress.saving") : t("submit")}
            </button>
            <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 text-center">{t("error")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
