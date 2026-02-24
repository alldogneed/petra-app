"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, Phone, Mail, Check, XCircle } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { LEAD_STAGES, LEAD_SOURCES } from "@/lib/constants";
import { LeadTreatmentModal } from "@/components/leads/LeadTreatmentModal";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";

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

function KanbanColumn({ stage, leads, onLeadClick, onQuickAction }: { stage: { id: string, label: string, color: string }, leads: Lead[], onLeadClick: (l: Lead) => void, onQuickAction: (l: Lead, action: string) => void }) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="min-w-[280px] flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
        <span className="text-sm font-semibold text-petra-text">{stage.label}</span>
        <span className="badge-neutral text-[10px] mr-auto">{leads.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-3 min-h-[400px] p-3 rounded-xl transition-colors border ${isOver ? "bg-slate-100 border-dashed border-slate-300" : "bg-slate-50/80 border-slate-100"
          }`}
      >
        {leads.length === 0 && !isOver && (
          <p className="text-xs text-petra-muted text-center py-8">אין לידים</p>
        )}
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} onQuickAction={(action) => onQuickAction(lead, action)} />
        ))}
      </div>
    </div>
  );
}

function DraggableLeadCard({ lead, onClick, onQuickAction }: { lead: Lead, onClick: () => void, onQuickAction: (action: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const sourceLabel = LEAD_SOURCES.find((s) => s.id === lead.source)?.label || lead.source;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`card p-4 group cursor-pointer hover:shadow-md transition-shadow ${isDragging ? "opacity-50 border-2 border-brand-500 shadow-xl" : ""
        }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold text-petra-text">{lead.name}</div>
          {lead.phone && (
            <div className="text-xs text-petra-muted flex items-center gap-1.5 mt-2">
              <Phone className="w-3.5 h-3.5" />{lead.phone}
            </div>
          )}
          {lead.email && (
            <div className="text-xs text-petra-muted flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" />{lead.email}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="badge-neutral text-[10px]">{sourceLabel}</span>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAction('won'); }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-green-600 hover:bg-green-100 transition-colors"
            title="לקוח נסגר (זכינו!)"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAction('lost'); }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-red-600 hover:bg-red-100 transition-colors"
            title="זרוק לאבודים"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);

  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetchJSON<Lead[]>("/api/leads"),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // minimum drag distance before taking over, allows clicking vs dragging
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = active.data.current?.lead;
    if (lead) setActiveDragLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLead(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeLeadId = active.id as string;
      const targetStageId = over.id as string;
      const lead = leads.find((l) => l.id === activeLeadId);

      if (lead && lead.stage !== targetStageId) {
        // Optimistic update locally
        queryClient.setQueryData(["leads"], (old: Lead[]) =>
          old.map(l => l.id === activeLeadId ? { ...l, stage: targetStageId } : l)
        );

        moveMutation.mutate({ id: activeLeadId, stage: targetStageId });

        // If moving to won/lost automatically open modal for follow up options/lost reason?
        // Let's just do it directly for won, for lost they can click it manually or we can open modal.
        if (targetStageId === "lost" || targetStageId === "won") {
          setSelectedLead({ ...lead, stage: targetStageId });
        }
      }
    }
  };

  const activeStages = LEAD_STAGES.filter((s) => s.id !== "lost" && s.id !== "won");
  // Let's also show won and lost as column on the board or in a separate section. 
  // It's better to show them at the end.
  const boardStages = [...activeStages, LEAD_STAGES.find(s => s.id === "won") as { id: string, label: string, color: string }, LEAD_STAGES.find(s => s.id === "lost") as { id: string, label: string, color: string }];

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-8 items-stretch h-[calc(100vh-200px)]">
          {boardStages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.id);
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={stageLeads}
                onLeadClick={(lead) => setSelectedLead(lead)}
                onQuickAction={(lead, action) => setSelectedLead({ ...lead, stage: action })}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeDragLead ? (
            <div className="card p-4 shadow-2xl opacity-90 rotate-2 w-[280px]">
              <div className="text-sm font-bold text-petra-text">{activeDragLead.name}</div>
              <span className="badge-neutral text-[10px] mt-3 inline-block">
                {LEAD_SOURCES.find((s) => s.id === activeDragLead.source)?.label || activeDragLead.source}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <NewLeadModal isOpen={showModal} onClose={() => setShowModal(false)} />

      <LeadTreatmentModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
