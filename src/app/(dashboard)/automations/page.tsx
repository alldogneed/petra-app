"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  X,
  MessageSquare,
  Clock,
  ToggleLeft,
  ToggleRight,
  Bell,
  CalendarClock,
  UserCheck,
  PawPrint,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";

interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  triggerOffset: number;
  isActive: boolean;
  createdAt: string;
  template: MessageTemplate;
}

const TRIGGERS = [
  {
    id: "appointment_reminder",
    label: "תזכורת לפני תור",
    icon: CalendarClock,
    color: "#3B82F6",
    offsetLabel: "שעות לפני",
    defaultOffset: 24,
  },
  {
    id: "appointment_followup",
    label: "מעקב אחרי תור",
    icon: UserCheck,
    color: "#22C55E",
    offsetLabel: "שעות אחרי",
    defaultOffset: 2,
  },
  {
    id: "lead_followup",
    label: "מעקב ליד חדש",
    icon: Bell,
    color: "#F59E0B",
    offsetLabel: "שעות אחרי יצירה",
    defaultOffset: 24,
  },
  {
    id: "birthday_reminder",
    label: "תזכורת יום הולדת",
    icon: PawPrint,
    color: "#EC4899",
    offsetLabel: "ימים לפני",
    defaultOffset: 3,
  },
];

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#22C55E" },
  sms: { label: "SMS", color: "#3B82F6" },
  email: { label: "אימייל", color: "#6366F1" },
};

function getTriggerInfo(triggerId: string) {
  return TRIGGERS.find((t) => t.id === triggerId) ?? {
    id: triggerId,
    label: triggerId,
    icon: Zap,
    color: "#94A3B8",
    offsetLabel: "שעות",
    defaultOffset: 24,
  };
}

const emptyForm = { name: "", trigger: "appointment_reminder", triggerOffset: 24, templateId: "", isActive: true };

export default function AutomationsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["automations"],
    queryFn: () => fetchJSON<AutomationRule[]>("/api/automations"),
  });

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["templates-for-automations"],
    queryFn: () => fetchJSON<MessageTemplate[]>("/api/messages"),
    enabled: showModal,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה ביצירה"); return d; }),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("אוטומציה נוצרה");
      closeModal();
    },
    onError: () => toast.error("שגיאה ביצירת אוטומציה"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) =>
      fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("אוטומציה עודכנה");
      closeModal();
    },
    onError: () => toast.error("שגיאה בעדכון אוטומציה"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/automations/${id}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקה"); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("אוטומציה נמחקה");
      setDeleteId(null);
    },
    onError: () => toast.error("שגיאה במחיקת אוטומציה"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success(res.isActive ? "אוטומציה הופעלה" : "אוטומציה כובתה");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  function openCreate() {
    setEditRule(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditRule(rule);
    setForm({
      name: rule.name,
      trigger: rule.trigger,
      triggerOffset: rule.triggerOffset,
      templateId: rule.template.id,
      isActive: rule.isActive,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditRule(null);
    setForm(emptyForm);
  }

  function handleSubmit() {
    if (!form.name || !form.templateId) {
      toast.error("יש למלא שם ותבנית");
      return;
    }
    if (editRule) {
      updateMutation.mutate({ id: editRule.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">אוטומציות</h1>
          <p className="text-sm text-petra-muted mt-0.5">
            {rules.length} כללים • {activeCount} פעילים
          </p>
        </div>
        <div className="flex-1" />
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          אוטומציה חדשה
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-5 p-4 rounded-xl bg-brand-50 border border-brand-100 flex items-start gap-3">
        <Zap className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-brand-700">כיצד עובדות האוטומציות?</p>
          <p className="text-xs text-brand-600 mt-0.5">
            הגדר כלל טריגר + תבנית הודעה → המערכת תשלח הודעות אוטומטיות ללקוחות בזמן הנכון.
          </p>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-5 animate-pulse h-20" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Zap className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין אוטומציות עדיין</h3>
          <p className="text-sm text-petra-muted mb-4">צור כלל ראשון ושלח הודעות אוטומטיות ללקוחות</p>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            אוטומציה חדשה
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const trig = getTriggerInfo(rule.trigger);
            const TrigIcon = trig.icon;
            const ch = CHANNEL_LABELS[rule.template.channel] ?? { label: rule.template.channel, color: "#94A3B8" };

            return (
              <div key={rule.id} className={cn("card p-4 transition-opacity", !rule.isActive && "opacity-60")}>
                <div className="flex items-center gap-3">
                  {/* Trigger icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${trig.color}15` }}
                  >
                    <TrigIcon className="w-5 h-5" style={{ color: trig.color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-petra-text">{rule.name}</span>
                      {!rule.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                          כבוי
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-petra-muted">
                      <span className="flex items-center gap-1">
                        <TrigIcon className="w-3 h-3" style={{ color: trig.color }} />
                        {trig.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rule.triggerOffset} {trig.offsetLabel}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {rule.template.name}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${ch.color}15`, color: ch.color }}
                      >
                        {ch.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title={rule.isActive ? "כבה" : "הפעל"}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-5 h-5 text-brand-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                      title="עריכה"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="מחק"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-petra-text flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-500" />
                {editRule ? "עריכת אוטומציה" : "אוטומציה חדשה"}
              </h3>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="label">שם האוטומציה *</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder='למשל: "תזכורת יום לפני תור"'
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="label">טריגר *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRIGGERS.map((t) => {
                    const TIcon = t.icon;
                    const selected = form.trigger === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, trigger: t.id, triggerOffset: t.defaultOffset }))}
                        className={cn(
                          "p-3 rounded-xl border-2 text-right transition-all flex items-center gap-2",
                          selected
                            ? "border-brand-500 bg-brand-50"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${t.color}20` }}
                        >
                          <TIcon className="w-3.5 h-3.5" style={{ color: t.color }} />
                        </div>
                        <span className={cn("text-xs font-medium", selected ? "text-brand-700" : "text-petra-text")}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Offset */}
              <div>
                <label className="label">
                  {getTriggerInfo(form.trigger).offsetLabel} *
                </label>
                <input
                  type="number"
                  className="input w-full"
                  min={1}
                  max={720}
                  value={form.triggerOffset}
                  onChange={(e) => setForm((f) => ({ ...f, triggerOffset: Number(e.target.value) }))}
                  dir="ltr"
                />
              </div>

              {/* Template */}
              <div>
                <label className="label">תבנית הודעה *</label>
                {templates.length === 0 ? (
                  <p className="text-xs text-petra-muted p-3 bg-slate-50 rounded-xl">
                    אין תבניות. צור תבנית בדף <strong>הודעות</strong> תחילה.
                  </p>
                ) : (
                  <select
                    className="input w-full"
                    value={form.templateId}
                    onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                  >
                    <option value="">— בחר תבנית —</option>
                    {templates.map((t) => {
                      const ch = CHANNEL_LABELS[t.channel];
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({ch?.label ?? t.channel})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-petra-text">פעיל</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className="p-1"
                >
                  {form.isActive ? (
                    <ToggleRight className="w-7 h-7 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Buttons */}
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving || !form.name || !form.templateId}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "שומר..." : editRule ? "שמור שינויים" : "צור אוטומציה"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-petra-text mb-1">מחיקת אוטומציה</h3>
              <p className="text-sm text-petra-muted mb-4">פעולה זו אינה ניתנת לביטול.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {deleteMutation.isPending ? "מוחק..." : "מחק"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
