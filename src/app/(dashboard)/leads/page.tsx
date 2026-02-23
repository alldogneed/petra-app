"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  X,
  Phone,
  Mail,
} from "lucide-react";
import { LEAD_STAGES, LEAD_SOURCES } from "@/lib/constants";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  stage: string;
  notes: string | null;
  createdAt: string;
  lastContactedAt: string | null;
}

function NewLeadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "", source: "manual", notes: "" });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) throw new Error("Failed"); return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onClose();
      setForm({ name: "", phone: "", email: "", source: "manual", notes: "" });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-petra-text">ליד חדש</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">מקור</label>
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={!form.name || mutation.isPending} onClick={() => mutation.mutate(form)}>
            <Plus className="w-4 h-4" />{mutation.isPending ? "שומר..." : "הוסף ליד"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetch("/api/leads").then((r) => r.json()),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const activeStages = LEAD_STAGES.filter((s) => s.id !== "lost");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">לידים</h1>
          <p className="text-sm text-petra-muted mt-1">{leads.length} לידים במערכת</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />ליד חדש
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {activeStages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id} className="min-w-[280px] flex-1">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                <span className="text-sm font-semibold text-petra-text">{stage.label}</span>
                <span className="badge-neutral text-[10px] mr-auto">{stageLeads.length}</span>
              </div>

              <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                {stageLeads.length === 0 ? (
                  <p className="text-xs text-petra-muted text-center py-8">אין לידים</p>
                ) : (
                  stageLeads.map((lead) => {
                    const sourceLabel = LEAD_SOURCES.find((s) => s.id === lead.source)?.label || lead.source;
                    return (
                      <div key={lead.id} className="card p-3 group">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium text-petra-text">{lead.name}</div>
                            {lead.phone && (
                              <div className="text-xs text-petra-muted flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" />{lead.phone}
                              </div>
                            )}
                            {lead.email && (
                              <div className="text-xs text-petra-muted flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3" />{lead.email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="badge-neutral text-[10px]">{sourceLabel}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {activeStages.filter((s) => s.id !== stage.id).map((s) => (
                              <button
                                key={s.id}
                                className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
                                style={{ borderColor: s.color, background: `${s.color}20` }}
                                title={`העבר ל${s.label}`}
                                onClick={() => moveMutation.mutate({ id: lead.id, stage: s.id })}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NewLeadModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
