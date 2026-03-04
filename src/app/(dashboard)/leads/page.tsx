"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Phone, Mail, Check, XCircle, MessageCircle,
  Trophy, Archive, PhoneCall, Pencil, Trash2, Lock, GripVertical, UserCheck, Search, FileText
} from "lucide-react";
import { fetchJSON, toWhatsAppPhone, cn } from "@/lib/utils";
import { toast } from "sonner";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { LeadTreatmentModal } from "@/components/leads/LeadTreatmentModal";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  wonAt: string | null;
  lostAt: string | null;
  lostReasonCode: string | null;
  lostReasonText: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  callLogs?: {
    id: string;
    summary: string;
    treatment: string;
    createdAt: string;
  }[];
}

interface LeadStage {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
}

const STAGE_COLORS = [
  "#8B5CF6", "#3B82F6", "#6366F1", "#06B6D4",
  "#22C55E", "#EAB308", "#F97316", "#EF4444",
];

function NewLeadModal({ isOpen, onClose, stages }: { isOpen: boolean; onClose: () => void; stages: LeadStage[] }) {
  const queryClient = useQueryClient();
  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);
  const [form, setForm] = useState({ name: "", phone: "", email: "", source: "manual", notes: "", stage: activeStages[0]?.id || "new" });

  useEffect(() => {
    if (isOpen) {
      setForm({ name: "", phone: "", email: "", source: "manual", notes: "", stage: activeStages[0]?.id || "new" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) throw new Error("Failed"); return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onClose();
      toast.success("הליד נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת הליד. נסה שוב."),
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מקור</label>
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">שלב</label>
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {activeStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
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

function getSourceEmoji(source: string): string {
  switch (source) {
    case "google": return "🔍";
    case "instagram": return "📸";
    case "facebook": return "📘";
    case "website": return "🌐";
    case "referral": return "🤝";
    case "manual": return "✏️";
    default: return "📋";
  }
}

// ─── Edit Mode: Sortable Column Wrapper ──────────────────────────────────────

function SortableColumn({
  stage,
  leads,
  editMode,
  editingStageId,
  editingName,
  onStartEdit,
  onChangeName,
  onSaveName,
  onChangeColor,
  onDelete,
  onLeadClick,
  onQuickAction,
  onWon,
  onDetails,
  stages,
}: {
  stage: LeadStage;
  leads: Lead[];
  editMode: boolean;
  editingStageId: string | null;
  editingName: string;
  onStartEdit: (id: string, name: string) => void;
  onChangeName: (name: string) => void;
  onSaveName: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (stage: LeadStage) => void;
  onLeadClick: (l: Lead) => void;
  onQuickAction: (l: Lead, action: string) => void;
  onWon: (l: Lead) => void;
  onDetails: (l: Lead) => void;
  stages: LeadStage[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="min-w-[calc(100vw-2rem)] md:min-w-[280px] flex-1 flex flex-col snap-center">
      <KanbanColumn
        stage={stage}
        leads={leads}
        editMode={editMode}
        editingStageId={editingStageId}
        editingName={editingName}
        onStartEdit={onStartEdit}
        onChangeName={onChangeName}
        onSaveName={onSaveName}
        onChangeColor={onChangeColor}
        onDelete={onDelete}
        onLeadClick={onLeadClick}
        onQuickAction={onQuickAction}
        onWon={onWon}
        onDetails={onDetails}
        dragAttributes={attributes}
        dragListeners={listeners}
        stages={stages}
      />
    </div>
  );
}

// ─── Kanban Column ───────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  leads,
  editMode,
  editingStageId,
  editingName,
  onStartEdit,
  onChangeName,
  onSaveName,
  onChangeColor,
  onDelete,
  onLeadClick,
  onQuickAction,
  onWon,
  onDetails,
  dragAttributes,
  dragListeners,
  stages,
}: {
  stage: LeadStage;
  leads: Lead[];
  editMode: boolean;
  editingStageId: string | null;
  editingName: string;
  onStartEdit: (id: string, name: string) => void;
  onChangeName: (name: string) => void;
  onSaveName: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (stage: LeadStage) => void;
  onLeadClick: (l: Lead) => void;
  onQuickAction: (l: Lead, action: string) => void;
  onWon: (l: Lead) => void;
  onDetails: (l: Lead) => void;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  stages: LeadStage[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
    disabled: editMode,
  });

  const isWon = stage.isWon;
  const isLost = stage.isLost;

  const columnBg = isWon
    ? "bg-green-50/60 border-green-100"
    : isLost
      ? "bg-red-50/60 border-red-100"
      : "bg-slate-50/80 border-slate-100";

  const columnBgHover = isOver
    ? isWon
      ? "bg-green-100 border-dashed border-green-300"
      : isLost
        ? "bg-red-100 border-dashed border-red-300"
        : "bg-slate-100 border-dashed border-slate-300"
    : columnBg;

  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <>
      {/* Column Header */}
      <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg transition-colors ${editMode ? "bg-amber-50/80 border border-amber-200/60" : ""}`}>
        {editMode && dragListeners && (
          <button
            className="cursor-grab active:cursor-grabbing text-amber-500 hover:text-amber-700"
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {isWon ? (
          <Trophy className="w-4 h-4 text-green-500" />
        ) : isLost ? (
          <Archive className="w-4 h-4 text-red-400" />
        ) : (
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
        )}

        {editMode && editingStageId === stage.id ? (
          <input
            className="text-sm font-semibold text-petra-text bg-white border border-brand-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={editingName}
            onChange={(e) => onChangeName(e.target.value)}
            onBlur={() => onSaveName(stage.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveName(stage.id);
              if (e.key === "Escape") onSaveName(stage.id);
            }}
            autoFocus
          />
        ) : (
          <span
            className={`text-sm font-semibold text-petra-text ${editMode ? "cursor-pointer hover:text-brand-600 border-b border-dashed border-amber-400" : ""}`}
            onClick={() => editMode && onStartEdit(stage.id, stage.name)}
          >
            {stage.name}
          </span>
        )}

        <span className="badge-neutral text-[10px] ms-auto">{leads.length}</span>

        {editMode && (
          <div className="flex items-center gap-1.5 relative">
            {/* Color picker */}
            <button
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: stage.color }}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="שנה צבע"
            />
            {showColorPicker && (
              <div className="absolute top-8 right-0 z-50 bg-white shadow-lg rounded-lg p-2 flex gap-1.5 border border-slate-200">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-125 ${c === stage.color ? "border-slate-800 scale-110" : "border-white"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      onChangeColor(stage.id, c);
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Delete / Lock */}
            {isWon || isLost ? (
              <span title="לא ניתן למחוק שלב זה">
                <Lock className="w-4 h-4 text-petra-muted" />
              </span>
            ) : (
              <button
                onClick={() => onDelete(stage)}
                className="w-6 h-6 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="מחק שלב"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-3 min-h-[400px] p-3 rounded-xl transition-colors border ${columnBgHover}`}
      >
        {leads.length === 0 && !isOver && (
          <p className="text-xs text-petra-muted text-center py-8">אין לידים</p>
        )}
        {!editMode && leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            stage={stage}
            onClick={() => onLeadClick(lead)}
            onQuickAction={(action) => onQuickAction(lead, action)}
            onWon={() => onWon(lead)}
            onDetails={() => onDetails(lead)}
            stages={stages}
          />
        ))}
        {editMode && leads.map((lead) => (
          <div key={lead.id} className="card p-4 opacity-60">
            <div className="text-sm font-bold text-petra-text">{lead.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Draggable Lead Card ─────────────────────────────────────────────────────

function DraggableLeadCard({
  lead,
  stage,
  onClick,
  onQuickAction,
  onWon,
  onDetails,
  stages,
}: {
  lead: Lead;
  stage: LeadStage;
  onClick: () => void;
  onQuickAction: (action: string) => void;
  onWon: () => void;
  onDetails: () => void;
  stages: LeadStage[];
}) {
  const [converting, setConverting] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const sourceLabel = LEAD_SOURCES.find((s) => s.id === lead.source)?.label || lead.source;
  const sourceEmoji = getSourceEmoji(lead.source);
  const callLogCount = lead.callLogs?.length || 0;
  const isWon = stage.isWon;
  const isLost = stage.isLost;

  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);

  const daysSinceCreation = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const showStaleness = !isWon && !isLost && daysSinceCreation > 7;
  const stalenessColor = daysSinceCreation > 30
    ? "bg-red-50 text-red-600 border border-red-100"
    : daysSinceCreation > 14
      ? "bg-orange-50 text-orange-600 border border-orange-100"
      : "bg-amber-50 text-amber-600 border border-amber-100";

  const lostReasonLabel = lead.lostReasonCode
    ? LOST_REASON_CODES.find((r) => r.id === lead.lostReasonCode)?.label
    : null;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const borderAccent = isWon
    ? "border-r-[3px] border-r-green-400"
    : isLost
      ? "border-r-[3px] border-r-red-400"
      : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`card p-4 group cursor-pointer hover:shadow-md transition-shadow ${borderAccent} ${isDragging ? "opacity-50 border-2 border-brand-500 shadow-xl" : ""
        }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
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
          <div className="text-[10px] text-petra-muted mt-1.5">
            {new Date(lead.createdAt).toLocaleDateString("he-IL")}
          </div>
          {lead.lastContactedAt && (
            <div className="text-[10px] text-brand-500 flex items-center gap-1 mt-0.5">
              <PhoneCall className="w-2.5 h-2.5" />
              שוחח: {new Date(lead.lastContactedAt).toLocaleDateString("he-IL")}
            </div>
          )}
        </div>
      </div>

      {/* Last call snippet or notes preview */}
      {lead.callLogs && lead.callLogs.length > 0 ? (
        <p className="text-[10px] text-petra-muted line-clamp-1 mt-1.5 italic border-t border-slate-100 pt-1.5">
          &ldquo;{lead.callLogs[0].summary}&rdquo;
        </p>
      ) : lead.notes ? (
        <p className="text-[10px] text-petra-muted line-clamp-2 mt-1.5 border-t border-slate-100 pt-1.5">
          {lead.notes}
        </p>
      ) : null}

      {/* Won/Lost date and reason */}
      {isWon && lead.wonAt && (
        <div className="mt-2 text-[10px] text-green-600 font-medium">
          נסגר: {new Date(lead.wonAt).toLocaleDateString("he-IL")}
        </div>
      )}
      {isLost && (
        <div className="mt-2 space-y-1">
          {lead.lostAt && (
            <div className="text-[10px] text-red-500 font-medium">
              אבוד: {new Date(lead.lostAt).toLocaleDateString("he-IL")}
            </div>
          )}
          {lostReasonLabel && (
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {lostReasonLabel}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge-neutral text-[10px]">{sourceEmoji} {sourceLabel}</span>
          {callLogCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">
              <PhoneCall className="w-2.5 h-2.5" />
              {callLogCount}
            </span>
          )}
          {showStaleness && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stalenessColor}`}>
              {daysSinceCreation}י׳
            </span>
          )}
        </div>
        <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onDetails(); }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-brand-600 hover:bg-brand-100 transition-colors"
            title="פרטי ליד וישויות שיחה"
          >
            <FileText className="w-4 h-4" />
          </button>
          {lead.phone && !isWon && !isLost && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(lead.phone!)}`, "_blank");
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full text-green-600 hover:bg-green-100 transition-colors"
              title="שלח וואטסאפ"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          {!isWon && !isLost && wonStage && lostStage && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (converting) return;
                  setConverting(true);
                  onWon();
                  setTimeout(() => setConverting(false), 4000);
                }}
                disabled={converting}
                className="w-7 h-7 flex items-center justify-center rounded-full text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                title="לקוח נסגר (זכינו!) — ממיר ללקוח"
              >
                {converting
                  ? <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onQuickAction(lostStage.id); }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-red-600 hover:bg-red-100 transition-colors"
                title="זרוק לאבודים"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Stage Inline ────────────────────────────────────────────────────────

function AddStageInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <div className="min-w-[200px] flex flex-col">
        <button
          onClick={() => {
            setIsAdding(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-petra-muted hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">הוסף שלב</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] flex flex-col">
      <div className="flex items-center gap-2 px-1 mb-3">
        <input
          ref={inputRef}
          className="text-sm font-semibold text-petra-text bg-white border border-brand-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") { setIsAdding(false); setName(""); }
          }}
          onBlur={() => {
            if (name.trim()) handleSubmit();
            else { setIsAdding(false); setName(""); }
          }}
          placeholder="שם השלב..."
          autoFocus
        />
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteStageModal({
  stage,
  leadCount,
  onConfirm,
  onClose,
}: {
  stage: LeadStage;
  leadCount: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <h3 className="text-lg font-bold text-petra-text mb-3">
          מחיקת שלב &quot;{stage.name}&quot;
        </h3>
        {leadCount > 0 ? (
          <>
            <p className="text-sm text-petra-muted mb-4">
              לא ניתן למחוק שלב זה כי יש בו {leadCount} לידים. העבר את הלידים לשלב אחר לפני המחיקה.
            </p>
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={onClose}>הבנתי</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-petra-muted mb-4">
              האם למחוק את השלב? לא ניתן לשחזר פעולה זו.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={onClose}>ביטול</button>
              <button className="btn-danger" onClick={onConfirm}>מחק שלב</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Archive List ────────────────────────────────────────────────────────────

function ArchiveList({
  leads,
  wonStage,
  lostStage,
  onLeadClick,
}: {
  leads: Lead[];
  wonStage?: LeadStage;
  lostStage?: LeadStage;
  onLeadClick: (l: Lead) => void;
}) {
  const { setNodeRef: setWonNodeRef, isOver: isWonOver } = useDroppable({ id: wonStage?.id || "won", disabled: !wonStage });
  const { setNodeRef: setLostNodeRef, isOver: isLostOver } = useDroppable({ id: lostStage?.id || "lost", disabled: !lostStage });

  if (!wonStage && !lostStage) return null;

  return (
    <div className="mt-4 mb-20 space-y-4">
      <h2 className="text-xl font-bold text-petra-text px-1">ארכיון לידים (שטופלו)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {wonStage && (
          <div
            ref={setWonNodeRef}
            className={`bg-white rounded-xl shadow-sm border transition-colors flex flex-col ${isWonOver ? "border-green-400 bg-green-50 shadow-lg" : "border-slate-200"
              }`}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-green-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-green-800">נסגרו (לקוחות)</h3>
              </div>
              <span className="badge-neutral text-xs">{leads.filter((l) => l.stage === wonStage.id).length}</span>
            </div>
            <div className="p-0 overflow-y-auto max-h-[400px]">
              <table className="w-full text-sm text-right whitespace-nowrap">
                <thead className="bg-slate-50 text-petra-muted border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="font-medium p-3">שם</th>
                    <th className="font-medium p-3">טלפון</th>
                    <th className="font-medium p-3">תאריך סגירה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads
                    .filter((l) => l.stage === wonStage.id)
                    .sort((a, b) => new Date(b.wonAt || 0).getTime() - new Date(a.wonAt || 0).getTime())
                    .map((lead) => (
                      <tr key={lead.id} onClick={() => onLeadClick(lead)} className="hover:bg-slate-50 cursor-pointer transition-colors text-xs sm:text-sm">
                        <td className="p-3 font-medium text-petra-text">{lead.name}</td>
                        <td className="p-3 text-petra-muted" dir="ltr">{lead.phone || "-"}</td>
                        <td className="p-3 text-petra-muted">
                          {lead.wonAt ? new Date(lead.wonAt).toLocaleDateString("he-IL") : ""}
                        </td>
                      </tr>
                    ))}
                  {leads.filter((l) => l.stage === wonStage.id).length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-petra-muted">אין לידים שנסגרו</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lostStage && (
          <div
            ref={setLostNodeRef}
            className={`bg-white rounded-xl shadow-sm border transition-colors flex flex-col ${isLostOver ? "border-red-400 bg-red-50 shadow-lg" : "border-slate-200"
              }`}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-red-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-red-800">אבודים</h3>
              </div>
              <span className="badge-neutral text-xs">{leads.filter((l) => l.stage === lostStage.id).length}</span>
            </div>
            <div className="p-0 overflow-y-auto max-h-[400px]">
              <table className="w-full text-sm text-right whitespace-nowrap">
                <thead className="bg-slate-50 text-petra-muted border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="font-medium p-3">שם</th>
                    <th className="font-medium p-3">סיבה</th>
                    <th className="font-medium p-3">תאריך אובדן</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads
                    .filter((l) => l.stage === lostStage.id)
                    .sort((a, b) => new Date(b.lostAt || 0).getTime() - new Date(a.lostAt || 0).getTime())
                    .map((lead) => {
                      const lostReasonLabel = lead.lostReasonCode
                        ? LOST_REASON_CODES.find((r) => r.id === lead.lostReasonCode)?.label
                        : null;
                      return (
                        <tr key={lead.id} onClick={() => onLeadClick(lead)} className="hover:bg-slate-50 cursor-pointer transition-colors text-xs sm:text-sm">
                          <td className="p-3 font-medium text-petra-text">{lead.name}</td>
                          <td className="p-3 text-petra-muted">
                            {lostReasonLabel && (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] whitespace-normal max-w-[150px] leading-tight">
                                {lostReasonLabel}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-petra-muted">
                            {lead.lostAt ? new Date(lead.lostAt).toLocaleDateString("he-IL") : ""}
                          </td>
                        </tr>
                      );
                    })}
                  {leads.filter((l) => l.stage === lostStage.id).length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-petra-muted">אין לידים אבודים</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);
  const [wonToast, setWonToast] = useState<{ name: string; customerId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ stage: LeadStage; leadCount: number } | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetchJSON<Lead[]>("/api/leads"),
  });

  const { data: stages = [] } = useQuery<LeadStage[]>({
    queryKey: ["lead-stages"],
    queryFn: () => fetchJSON<LeadStage[]>("/api/leads/stages"),
  });

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (sourceFilter) {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        (l.phone?.includes(q) ?? false) ||
        (l.email?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [leads, searchQuery, sourceFilter]);

  // ─── Mutations ──────────────────────────────────────────────────────────

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("שגיאה בהזזת הליד. נסה שוב."),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      fetch(`/api/leads/stages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-stages"] }),
    onError: () => toast.error("שגיאה בעדכון השלב. נסה שוב."),
  });

  const createStageMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      fetch("/api/leads/stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-stages"] });
      toast.success("השלב נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת השלב. נסה שוב."),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/leads/stages/${id}`, { method: "DELETE" }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-stages"] });
      toast.success("השלב נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת השלב. נסה שוב."),
  });

  const reorderMutation = useMutation({
    mutationFn: (stageIds: string[]) =>
      fetch("/api/leads/stages/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageIds }) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-stages"] }),
    onError: () => toast.error("שגיאה בסידור השלבים. נסה שוב."),
  });

  const convertMutation = useMutation({
    mutationFn: (leadId: string) =>
      fetch(`/api/leads/${leadId}/convert`, { method: "POST" }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (data, leadId) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (data.customer) {
        const lead = leads.find((l) => l.id === leadId);
        setWonToast({ name: lead?.name || data.customer.name, customerId: data.customer.id });
        setTimeout(() => setWonToast(null), 6000);
      }
    },
    onError: () => toast.error("שגיאה בהמרת הליד ללקוח. נסה שוב."),
  });

  // ─── Lead DnD Sensors ──────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // ─── Lead DnD Handlers ─────────────────────────────────────────────────

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
      const targetStage = stages.find((s) => s.id === targetStageId);

      if (lead && lead.stage !== targetStageId) {
        queryClient.setQueryData(["leads"], (old: Lead[]) =>
          old.map(l => l.id === activeLeadId ? { ...l, stage: targetStageId } : l)
        );

        if (targetStage?.isWon) {
          // Open treatment modal — it will call close-won and create the customer
          setSelectedLead({ ...lead, stage: targetStageId });
        } else {
          moveMutation.mutate({ id: activeLeadId, stage: targetStageId });
          if (targetStage?.isLost) {
            setSelectedLead({ ...lead, stage: targetStageId });
          }
        }
      }
    }
  };

  // ─── Column Reorder DnD Handler (edit mode) ────────────────────────────

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(stages, oldIndex, newIndex);

    // Optimistic update
    queryClient.setQueryData(["lead-stages"], newOrder.map((s, i) => ({ ...s, sortOrder: i })));

    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  // ─── Edit Mode Handlers ────────────────────────────────────────────────

  const handleStartEdit = (id: string, name: string) => {
    setEditingStageId(id);
    setEditingName(name);
  };

  const handleSaveName = (id: string) => {
    if (editingName.trim() && editingName.trim() !== stages.find((s) => s.id === id)?.name) {
      updateStageMutation.mutate({ id, name: editingName.trim() });
    }
    setEditingStageId(null);
    setEditingName("");
  };

  const handleChangeColor = (id: string, color: string) => {
    updateStageMutation.mutate({ id, color });
  };

  const handleDelete = (stage: LeadStage) => {
    const count = leads.filter((l) => l.stage === stage.id).length;
    setDeleteTarget({ stage, leadCount: count });
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteStageMutation.mutate(deleteTarget.stage.id);
      setDeleteTarget(null);
    }
  };

  const handleAddStage = (name: string) => {
    createStageMutation.mutate({ name });
  };

  const handleWon = useCallback((lead: Lead) => {
    convertMutation.mutate(lead.id);
  }, [convertMutation]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);
  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);

  const funnelStats = useMemo(() => {
    const wonCount = wonStage ? leads.filter((l) => l.stage === wonStage.id).length : 0;
    const lostCount = lostStage ? leads.filter((l) => l.stage === lostStage.id).length : 0;
    const activeCount = leads.filter((l) => {
      const s = stages.find((s) => s.id === l.stage);
      return s && !s.isWon && !s.isLost;
    }).length;
    const conversionRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

    const stageBreakdown = activeStages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      count: leads.filter((l) => l.stage === s.id).length,
    }));

    const sourceCounts: Record<string, number> = {};
    for (const l of leads) {
      if (l.source) sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
    }
    const topSourceId = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topSource = topSourceId
      ? LEAD_SOURCES.find((s) => s.id === topSourceId)?.label ?? topSourceId
      : null;

    return { wonCount, lostCount, activeCount, conversionRate, stageBreakdown, topSource };
  }, [leads, stages, activeStages, wonStage, lostStage]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">לידים</h1>
        <p className="text-sm text-petra-muted">
          {(searchQuery.trim() || sourceFilter) ? `${filteredLeads.length} מתוך ${leads.length}` : `${leads.length}`} לידים
        </p>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />ליד חדש
        </button>
        <button
          className={`btn-secondary flex items-center gap-1.5 ${editMode ? "!bg-brand-50 !text-brand-700 !border-brand-300" : ""}`}
          onClick={() => {
            setEditMode(!editMode);
            setEditingStageId(null);
            setEditingName("");
          }}
        >
          <Pencil className="w-3.5 h-3.5" />
          {editMode ? "סיום עריכה" : "עריכת שלבים"}
        </button>
        <div className="relative w-full sm:w-auto sm:ms-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
          <input
            type="text"
            placeholder="חפש ליד..."
            className="input pr-9 pl-3 text-sm w-full sm:w-56"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Source Filter */}
      {!editMode && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-1 flex-nowrap">
          <button
            onClick={() => setSourceFilter(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              sourceFilter === null
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-petra-muted hover:bg-slate-200"
            )}
          >
            כל המקורות
          </button>
          {LEAD_SOURCES.map((src) => {
            const count = leads.filter((l) => l.source === src.id).length;
            if (count === 0) return null;
            return (
              <button
                key={src.id}
                onClick={() => setSourceFilter(sourceFilter === src.id ? null : src.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  sourceFilter === src.id
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-petra-muted hover:bg-slate-200"
                )}
              >
                {src.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  sourceFilter === src.id ? "bg-white/20 text-white" : "bg-slate-200 text-petra-muted"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lead Funnel Stats */}
      {!editMode && leads.length > 0 && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-petra-text">{leads.length}</p>
            <p className="text-xs text-petra-muted mt-0.5">סה"כ לידים</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-brand-600">{funnelStats.activeCount}</p>
            <p className="text-xs text-petra-muted mt-0.5">בתהליך</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-green-600">{funnelStats.wonCount}</p>
            <p className="text-xs text-petra-muted mt-0.5">נסגרו</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-petra-text">{funnelStats.conversionRate}%</p>
            <p className="text-xs text-petra-muted mt-0.5">שיעור המרה</p>
          </div>
          {funnelStats.stageBreakdown.length > 0 && (
            <div className="col-span-2 sm:col-span-4 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-petra-muted mb-3">פילוח לפי שלב</p>
              <div className="flex gap-2 items-end h-16">
                {funnelStats.stageBreakdown.map((s) => {
                  const max = Math.max(...funnelStats.stageBreakdown.map((x) => x.count), 1);
                  const pct = Math.max((s.count / max) * 100, s.count > 0 ? 12 : 4);
                  return (
                    <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-petra-text">{s.count > 0 ? s.count : ""}</span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{ height: `${pct}%`, backgroundColor: s.color || "#6366F1" }}
                      />
                      <span className="text-[10px] text-petra-muted truncate w-full text-center leading-tight">{s.name}</span>
                    </div>
                  );
                })}
              </div>
              {funnelStats.topSource && (
                <p className="text-[11px] text-petra-muted mt-3">
                  מקור מוביל: <span className="font-semibold text-petra-text">{funnelStats.topSource}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Won Toast */}
      {wonToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-white border border-green-200 shadow-xl rounded-2xl px-5 py-3.5 animate-in slide-in-from-bottom-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-petra-text">🎉 {wonToast.name} הפך ללקוח!</p>
            <p className="text-xs text-petra-muted">הליד הומר בהצלחה ללקוח חדש במערכת</p>
          </div>
          <button
            onClick={() => router.push(`/customers/${wonToast.customerId}`)}
            className="mr-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            צפה בלקוח
          </button>
          <button onClick={() => setWonToast(null)} className="text-petra-muted hover:text-petra-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {editMode ? (
        /* ─── Edit Mode: Column reorder DnD ─── */
        <>
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Pencil className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{"מצב עריכה פעיל"}</span>
              {" — "}
              {"לחץ על שם שלב כדי לשנות אותו, גרור את "}
              <GripVertical className="w-3.5 h-3.5 inline-block align-middle" />
              {" לשינוי סדר, לחץ על העיגול הצבעוני לשינוי צבע, או "}
              <Trash2 className="w-3.5 h-3.5 inline-block align-middle text-red-500" />
              {" למחיקה."}
            </p>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={activeStages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 overflow-x-auto pb-6 items-stretch mb-8 snap-x snap-mandatory scrollbar-hide" style={{ minHeight: "500px" }}>
                {activeStages.map((stage) => {
                  const stageLeads = filteredLeads.filter((l) => l.stage === stage.id);
                  return (
                    <SortableColumn
                      key={stage.id}
                      stage={stage}
                      leads={stageLeads}
                      editMode={editMode}
                      editingStageId={editingStageId}
                      editingName={editingName}
                      onStartEdit={handleStartEdit}
                      onChangeName={setEditingName}
                      onSaveName={handleSaveName}
                      onChangeColor={handleChangeColor}
                      onDelete={handleDelete}
                      onLeadClick={(lead) => setSelectedLead(lead)}
                      onQuickAction={(lead, action) => setSelectedLead({ ...lead, stage: action })}
                      onWon={handleWon}
                      onDetails={(lead) => setDetailsLead(lead)}
                      stages={stages}
                    />
                  );
                })}
                <AddStageInline onAdd={handleAddStage} />
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        /* ─── Normal Mode: Lead card DnD ─── */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-6 items-stretch mb-8 snap-x snap-mandatory scrollbar-hide" style={{ minHeight: "500px" }}>
            {activeStages.map((stage) => {
              const stageLeads = leads.filter((l) => l.stage === stage.id);
              return (
                <div key={stage.id} className="min-w-[calc(100vw-2rem)] md:min-w-[280px] flex-1 flex flex-col snap-center">
                  <KanbanColumn
                    stage={stage}
                    leads={stageLeads}
                    editMode={false}
                    editingStageId={null}
                    editingName=""
                    onStartEdit={() => { }}
                    onChangeName={() => { }}
                    onSaveName={() => { }}
                    onChangeColor={() => { }}
                    onDelete={() => { }}
                    onLeadClick={(lead) => setSelectedLead(lead)}
                    onQuickAction={(lead, action) => setSelectedLead({ ...lead, stage: action })}
                    onWon={handleWon}
                    onDetails={(lead) => setDetailsLead(lead)}
                    stages={stages}
                  />
                </div>
              );
            })}
          </div>

          <ArchiveList leads={filteredLeads} wonStage={wonStage} lostStage={lostStage} onLeadClick={(lead) => setSelectedLead(lead)} />

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
      )}

      <NewLeadModal isOpen={showModal} onClose={() => setShowModal(false)} stages={stages} />

      <LeadTreatmentModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        stages={stages}
        onWon={(name, customerId) => {
          setSelectedLead(null);
          setWonToast({ name, customerId });
          setTimeout(() => setWonToast(null), 6000);
        }}
      />

      {detailsLead && (
        <LeadDetailsModal
          lead={detailsLead}
          isOpen={true}
          onClose={() => setDetailsLead(null)}
        />
      )}

      {deleteTarget && (
        <DeleteStageModal
          stage={deleteTarget.stage}
          leadCount={deleteTarget.leadCount}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
