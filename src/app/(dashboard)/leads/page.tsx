"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import dynamic from "next/dynamic";
import { TierGate } from "@/components/paywall/TierGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Phone, Mail, Check, XCircle, MessageCircle,
  Trophy, Archive, PhoneCall, Pencil, Trash2, Lock, GripVertical, UserCheck, Search, FileText,
  CalendarClock, Clock, CheckCircle, RefreshCw, Sparkles, MapPin, Tag, Download, AlertCircle, RotateCcw, ChevronDown,
} from "lucide-react";
import { fetchJSON, toWhatsAppPhone, cn } from "@/lib/utils";
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName, normalizeIsraeliPhone } from "@/lib/validation";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { LeadTreatmentModal } from "@/components/leads/LeadTreatmentModal";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";
const LeadsReports = dynamic(() => import("@/components/leads/LeadsReports").then(m => ({ default: m.LeadsReports })), { ssr: false });
import { BarChart2 } from "lucide-react";
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
  nextFollowUpAt: string | null;
  followUpStatus: string | null;
  previousStageId: string | null;
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
  const emptyForm = { name: "", phone: "", email: "", city: "", address: "", requestedService: "", source: "manual", notes: "", stage: activeStages[0]?.id || "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (isOpen) setForm({ ...emptyForm, stage: activeStages[0]?.id || "" });
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

  const [leadFieldErrors, setLeadFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  function validateAndSubmitLead() {
    const errors: typeof leadFieldErrors = {};
    const nameErr = validateName(form.name);
    if (nameErr) errors.name = nameErr;
    if (!form.phone.trim()) {
      errors.phone = "טלפון הוא שדה חובה";
    } else {
      const phoneErr = validateIsraeliPhone(form.phone);
      if (phoneErr) errors.phone = phoneErr;
    }
    if (form.email.trim()) {
      const emailErr = validateEmail(form.email);
      if (emailErr) errors.email = emailErr;
    }
    setLeadFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate({ ...form, name: sanitizeName(form.name) });
  }

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
            <input
              className={cn("input", leadFieldErrors.name && "border-red-300 focus:ring-red-200")}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (leadFieldErrors.name) setLeadFieldErrors({ ...leadFieldErrors, name: undefined }); }}
            />
            {leadFieldErrors.name && <p className="text-xs text-red-500 mt-1">{leadFieldErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className={cn("input", leadFieldErrors.phone && "border-red-300 focus:ring-red-200")}
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (leadFieldErrors.phone) setLeadFieldErrors({ ...leadFieldErrors, phone: undefined }); }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const normalized = normalizeIsraeliPhone(pasted);
                  setForm((f) => ({ ...f, phone: normalized }));
                  if (leadFieldErrors.phone) setLeadFieldErrors((err) => ({ ...err, phone: undefined }));
                }}
                placeholder="050-0000000"
                inputMode="tel"
              />
              {leadFieldErrors.phone && <p className="text-xs text-red-500 mt-1">{leadFieldErrors.phone}</p>}
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className={cn("input", leadFieldErrors.email && "border-red-300 focus:ring-red-200")}
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); if (leadFieldErrors.email) setLeadFieldErrors({ ...leadFieldErrors, email: undefined }); }}
              />
              {leadFieldErrors.email && <p className="text-xs text-red-500 mt-1">{leadFieldErrors.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">עיר מגורים</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="תל אביב"
              />
            </div>
            <div>
              <label className="label">כתובת מדויקת</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="רחוב, מספר"
              />
            </div>
          </div>
          <div>
            <label className="label">שירות מבוקש</label>
            <input
              className="input"
              value={form.requestedService}
              onChange={(e) => setForm({ ...form, requestedService: e.target.value })}
              placeholder="אילוף, פנסיון, גרומינג..."
            />
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
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={validateAndSubmitLead}>
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

/** מחלץ עיר ושירות מבוקש מתוך שדה ה-notes */
function parseLeadMeta(notes: string | null): { city: string | null; service: string | null; cleanNotes: string | null } {
  if (!notes) return { city: null, service: null, cleanNotes: null };
  let city: string | null = null;
  let service: string | null = null;
  const lines = notes.split("\n").filter((line) => {
    const cityMatch = line.match(/^עיר:\s*(.+)/);
    const serviceMatch = line.match(/^שירות מבוקש:\s*(.+)/);
    if (cityMatch) { city = cityMatch[1].trim(); return false; }
    if (serviceMatch) { service = serviceMatch[1].trim(); return false; }
    return true;
  });
  const cleanNotes = lines.join("\n").trim() || null;
  return { city, service, cleanNotes };
}

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(
    lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : ""
  );
  const queryClient = useQueryClient();

  const followUpMutation = useMutation({
    mutationFn: (date: string | null) =>
      fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUpAt: date }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(pickerDate ? "מועד מעקב נשמר ומשימה נוצרה" : "מועד מעקב נוקה");
    },
    onError: () => toast.error("שגיאה בעדכון מועד המעקב"),
  });

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const sourceLabel = LEAD_SOURCES.find((s) => s.id === lead.source)?.label || lead.source;
  const sourceEmoji = getSourceEmoji(lead.source);
  const callLogCount = lead.callLogs?.length || 0;
  const { city, service, cleanNotes } = parseLeadMeta(lead.notes);
  const isWon = stage.isWon;
  const isLost = stage.isLost;

  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);

  // Follow-up date logic
  const followUpDate = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isFollowUpToday = followUpDate
    ? followUpDate >= todayStart && followUpDate < new Date(todayStart.getTime() + 86400000)
    : false;
  const isFollowUpOverdue = followUpDate ? followUpDate < todayStart : false;
  const followUpLabel = followUpDate
    ? followUpDate.toLocaleDateString("he-IL", { day: "numeric", month: "long" })
    : null;

  const lostReasonLabel = lead.lostReasonCode
    ? LOST_REASON_CODES.find((r) => r.id === lead.lostReasonCode)?.label
    : null;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // ── Lead status (3 clear states for active leads) ──
  const daysSinceCreation = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const hasActivity = callLogCount > 0 || !!lead.lastContactedAt;
  const hasFutureFollowUp = !!followUpDate && !isFollowUpOverdue && lead.followUpStatus !== "completed";
  const isHandled = hasActivity || hasFutureFollowUp || lead.followUpStatus === "completed";

  type LeadStatus = "overdue" | "untouched" | "handled" | "won" | "lost";
  const leadStatus: LeadStatus = isWon ? "won" : isLost ? "lost"
    : isFollowUpOverdue ? "overdue"
    : !isHandled ? "untouched"
    : "handled";

  const cardBorder = leadStatus === "overdue"
    ? "border-2 border-red-300 bg-red-50/40"
    : leadStatus === "untouched"
      ? "border-2 border-amber-300 bg-amber-50/30"
      : "border border-slate-200 bg-white";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`rounded-xl p-4 group cursor-pointer hover:shadow-md transition-shadow ${cardBorder} ${isDragging ? "opacity-50 !border-2 !border-brand-500 shadow-xl" : ""}`}
    >
      {/* Status banner */}
      {leadStatus === "overdue" && (
        <div className="flex items-center gap-1.5 -mx-4 -mt-4 mb-3 px-3 py-1.5 bg-red-100 rounded-t-xl border-b border-red-200">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-red-700">עבר מועד פולואפ</span>
          {followUpLabel && <span className="text-xs text-red-500 mr-auto">{followUpLabel}</span>}
        </div>
      )}
      {leadStatus === "untouched" && (
        <div className="flex items-center gap-1.5 -mx-4 -mt-4 mb-3 px-3 py-1.5 bg-amber-100 rounded-t-xl border-b border-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-700">ליד חדש · לא טופל</span>
          <span className="text-xs text-amber-500 mr-auto">{daysSinceCreation === 0 ? "היום" : `${daysSinceCreation} ימים`}</span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
            <span className="text-sm font-bold text-petra-text">{lead.name}</span>
          </div>
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
          {(city || service) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {city && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                  <MapPin className="w-3 h-3" />{city}
                </span>
              )}
              {service && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium border border-violet-100">
                  <Tag className="w-3 h-3" />{service}
                </span>
              )}
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
      ) : cleanNotes ? (
        <p className="text-[10px] text-petra-muted line-clamp-2 mt-1.5 border-t border-slate-100 pt-1.5">
          {cleanNotes}
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
          {lead.lostReasonText && (
            <p className="text-[10px] text-red-600 italic line-clamp-2">{lead.lostReasonText}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="badge-neutral text-[10px]">{sourceEmoji} {sourceLabel}</span>
          {callLogCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">
              <PhoneCall className="w-2.5 h-2.5" />
              {callLogCount}
            </span>
          )}
          {/* Follow-up / status badge */}
          {leadStatus === "handled" && hasFutureFollowUp && followUpLabel && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
              isFollowUpToday
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}>
              <CalendarClock className="w-2.5 h-2.5" />
              {isFollowUpToday ? "פולואפ היום!" : followUpLabel}
            </span>
          )}
          {leadStatus === "handled" && lead.followUpStatus === "completed" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="w-2.5 h-2.5" />
              טופל
            </span>
          )}
          {leadStatus === "handled" && !hasFutureFollowUp && lead.followUpStatus !== "completed" && hasActivity && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-slate-50 text-slate-500 border-slate-200">
              <CheckCircle className="w-2.5 h-2.5" />
              בטיפול
            </span>
          )}
        </div>
        <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 relative">
          {/* Follow-up date picker button */}
          {!isWon && !isLost && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker); }}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  followUpDate ? "text-blue-600 hover:bg-blue-100" : "text-petra-muted hover:bg-slate-100"
                }`}
                title="קבע מועד פולואפ"
              >
                <CalendarClock className="w-4 h-4" />
              </button>
              {showDatePicker && (
                <div className="absolute left-0 top-8 z-50 bg-white shadow-xl rounded-xl border border-slate-200 p-3 w-52">
                  <p className="text-xs font-semibold text-petra-text mb-2">מועד פולואפ</p>
                  <input
                    type="date"
                    className="input text-xs w-full"
                    value={pickerDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setPickerDate(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn-primary text-xs flex-1 py-1.5"
                      disabled={followUpMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        followUpMutation.mutate(pickerDate ? new Date(pickerDate).toISOString() : null);
                        setShowDatePicker(false);
                      }}
                    >
                      {followUpMutation.isPending ? "..." : "שמור"}
                    </button>
                    {followUpDate && (
                      <button
                        className="btn-secondary text-xs py-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPickerDate("");
                          followUpMutation.mutate(null);
                          setShowDatePicker(false);
                        }}
                      >
                        נקה
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
                window.open(`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(lead.phone!)}`, "whatsapp_window");
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

function AddStageInline({ onAdd, triggerOpen = 0 }: { onAdd: (name: string) => void; triggerOpen?: number }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // When the header "הוסף שלב" button is clicked, open the inline input
  useEffect(() => {
    if (triggerOpen > 0) {
      setIsAdding(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [triggerOpen]);

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

// ─── Archive Tab ─────────────────────────────────────────────────────────────

function ArchiveTab({
  leads,
  wonStage,
  lostStage,
  activeStages,
  searchQuery,
  onLeadClick,
}: {
  leads: Lead[];
  wonStage?: LeadStage;
  lostStage?: LeadStage;
  activeStages: LeadStage[];
  searchQuery: string;
  onLeadClick: (l: Lead) => void;
}) {
  const queryClient = useQueryClient();
  const [restoreLead, setRestoreLead] = useState<Lead | null>(null);
  const [filterType, setFilterType] = useState<"all" | "won" | "lost">("all");

  const archivedLeads = leads.filter(l => l.stage === wonStage?.id || l.stage === lostStage?.id);

  const filtered = archivedLeads
    .filter(l => filterType === "all" || (filterType === "won" ? l.stage === wonStage?.id : l.stage === lostStage?.id))
    .filter(l => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q)
        || (l.phone || "").includes(q)
        || (l.email || "").toLowerCase().includes(q)
        || (l.lostReasonText || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dateA = new Date(a.lostAt || a.wonAt || a.createdAt).getTime();
      const dateB = new Date(b.lostAt || b.wonAt || b.createdAt).getTime();
      return dateB - dateA;
    });

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["all", "lost", "won"] as const).map(f => {
          const label = f === "all" ? "הכל" : f === "lost" ? "🔴 אבודים" : "🏆 נסגרו";
          const count = f === "all" ? archivedLeads.length
            : f === "lost" ? archivedLeads.filter(l => l.stage === lostStage?.id).length
            : archivedLeads.filter(l => l.stage === wonStage?.id).length;
          return (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                filterType === f ? "bg-brand-500 text-white" : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {label}
              <span className={cn("text-[10px] px-1.5 rounded-full", filterType === f ? "bg-white/20" : "bg-slate-200")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Archive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-petra-muted">{searchQuery ? "לא נמצאו תוצאות" : "הארכיון ריק"}</p>
          </div>
        ) : (
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-petra-muted border-b border-slate-100 text-xs">
              <tr>
                <th className="font-medium p-3">שם</th>
                <th className="font-medium p-3">טלפון</th>
                <th className="font-medium p-3">סטטוס</th>
                <th className="font-medium p-3">סיבה / הערה</th>
                <th className="font-medium p-3">תאריך</th>
                <th className="font-medium p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(lead => {
                const isWon = lead.stage === wonStage?.id;
                const lostReasonLabel = lead.lostReasonCode
                  ? LOST_REASON_CODES.find(r => r.id === lead.lostReasonCode)?.label
                  : null;
                const date = isWon ? lead.wonAt : lead.lostAt;
                return (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-petra-text cursor-pointer" onClick={() => onLeadClick(lead)}>
                      {lead.name}
                    </td>
                    <td className="p-3 text-petra-muted text-xs" dir="ltr">{lead.phone || "—"}</td>
                    <td className="p-3">
                      {isWon ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                          <Trophy className="w-3 h-3" /> נסגר
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                          <Archive className="w-3 h-3" /> אבוד
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-petra-muted max-w-[200px] truncate">
                      {lostReasonLabel || lead.lostReasonText || "—"}
                    </td>
                    <td className="p-3 text-xs text-petra-muted whitespace-nowrap">
                      {date ? new Date(date).toLocaleDateString("he-IL") : "—"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setRestoreLead(lead)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200 font-medium transition-colors whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" />
                        החזר ליד
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {restoreLead && (
        <RestoreLeadModal
          lead={restoreLead}
          activeStages={activeStages}
          onClose={() => setRestoreLead(null)}
          onRestored={() => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setRestoreLead(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Restore Lead Modal ───────────────────────────────────────────────────────

function RestoreLeadModal({
  lead,
  activeStages,
  onClose,
  onRestored,
}: {
  lead: Lead;
  activeStages: LeadStage[];
  onClose: () => void;
  onRestored: () => void;
}) {
  // If previousStageId is set and still exists as active stage → pre-select it
  const prevStage = lead.previousStageId
    ? activeStages.find(s => s.id === lead.previousStageId)
    : null;
  const [selectedStage, setSelectedStage] = useState(prevStage?.id || activeStages[0]?.id || "");
  const [showPicker, setShowPicker] = useState(!prevStage); // skip picker if we know previous stage
  const [saving, setSaving] = useState(false);

  const handleRestore = async (stageId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: stageId,
          lostAt: null,
          wonAt: null,
          lostReasonCode: null,
          lostReasonText: null,
          previousStageId: null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`"${lead.name}" הוחזר למערכת הלידים`);
      onRestored();
    } catch {
      toast.error("שגיאה בהחזרת הליד");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">החזר ליד לקנבן</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Fast path: known previous stage */}
        {!showPicker && prevStage ? (
          <>
            <p className="text-sm text-petra-muted mb-4">
              להחזיר את <span className="font-semibold text-petra-text">{lead.name}</span> לשלב האחרון שלו?
            </p>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-brand-300 bg-brand-50 mb-5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: prevStage.color }} />
              <span className="text-sm font-semibold text-brand-700">{prevStage.name}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(prevStage.id)}
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                החזר לשלב זה
              </button>
              <button onClick={() => setShowPicker(true)} className="btn-secondary px-3" title="בחר שלב אחר">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-petra-muted mb-4">
              לאיזה שלב להחזיר את <span className="font-semibold text-petra-text">{lead.name}</span>?
            </p>
            <div className="space-y-2 mb-5">
              {activeStages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-right",
                    selectedStage === stage.id
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 hover:border-slate-300 text-petra-text"
                  )}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(selectedStage)}
                disabled={!selectedStage || saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                החזר ליד
              </button>
              <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Archive Drop Zones (DnD targets inside kanban DndContext) ────────────────

function ArchiveList({
  leads,
  wonStage,
  lostStage,
}: {
  leads: Lead[];
  wonStage?: LeadStage;
  lostStage?: LeadStage;
}) {
  const { setNodeRef: setWonNodeRef, isOver: isWonOver } = useDroppable({ id: wonStage?.id || "won", disabled: !wonStage });
  const { setNodeRef: setLostNodeRef, isOver: isLostOver } = useDroppable({ id: lostStage?.id || "lost", disabled: !lostStage });

  if (!wonStage && !lostStage) return null;

  return (
    <div className="mt-4 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {wonStage && (
          <div ref={setWonNodeRef}
            className={`rounded-xl border-2 border-dashed transition-colors p-4 text-center ${isWonOver ? "border-green-400 bg-green-50" : "border-slate-200 bg-slate-50/50"}`}>
            <Trophy className={`w-5 h-5 mx-auto mb-1 ${isWonOver ? "text-green-600" : "text-slate-400"}`} />
            <p className={`text-xs font-medium ${isWonOver ? "text-green-700" : "text-petra-muted"}`}>
              {isWonOver ? "שחרר — סגירה!" : `גרור לכאן לסגירה · ${leads.filter(l => l.stage === wonStage.id).length} נסגרו`}
            </p>
          </div>
        )}
        {lostStage && (
          <div ref={setLostNodeRef}
            className={`rounded-xl border-2 border-dashed transition-colors p-4 text-center ${isLostOver ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50/50"}`}>
            <Archive className={`w-5 h-5 mx-auto mb-1 ${isLostOver ? "text-red-600" : "text-slate-400"}`} />
            <p className={`text-xs font-medium ${isLostOver ? "text-red-700" : "text-petra-muted"}`}>
              {isLostOver ? "שחרר — ארכוב!" : `גרור לכאן לארכוב · ${leads.filter(l => l.stage === lostStage.id).length} אבודים`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Priority sort ────────────────────────────────────────────────────────────
// Groups: 0=overdue (red) → 1=untouched (amber) → 2=handled (grey)
// Within each group: oldest first (waiting longest = top of column)

function sortLeadsByPriority(leads: Lead[]): Lead[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const getPriority = (lead: Lead): 0 | 1 | 2 => {
    const followUpDate = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
    if (followUpDate && followUpDate < todayStart && lead.followUpStatus !== "completed") return 0;
    const hasActivity = (lead.callLogs?.length || 0) > 0 || !!lead.lastContactedAt;
    const hasFutureFollowUp = !!followUpDate && followUpDate >= todayStart;
    return (hasActivity || hasFutureFollowUp || lead.followUpStatus === "completed") ? 2 : 1;
  };

  const getAgeMs = (lead: Lead): number => {
    // For overdue: how long ago was the follow-up due (most overdue = oldest = first)
    const followUpDate = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
    if (followUpDate && followUpDate < todayStart) return followUpDate.getTime();
    // For untouched/handled: how long ago was the lead created
    return new Date(lead.createdAt).getTime();
  };

  return [...leads].sort((a, b) => {
    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa !== pb) return pa - pb;
    return getAgeMs(a) - getAgeMs(b); // older = smaller timestamp = sorts first
  });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function LeadsPageContent() {
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);
  const [wonToast, setWonToast] = useState<{ name: string; customerId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"kanban" | "reports" | "archive">("kanban");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { maxLeads, tier } = useSubscription();

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [addStageTrigger, setAddStageTrigger] = useState(0);
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ stage: LeadStage; leadCount: number } | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: leads = [], isFetching: leadsLoading, refetch: refetchLeads } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetchJSON<Lead[]>("/api/leads"),
  });

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  function exportLeads() {
    const p = new URLSearchParams();
    if (exportFrom) p.set("from", exportFrom);
    if (exportTo) p.set("to", exportTo);
    window.location.href = `/api/leads/export${p.toString() ? `?${p.toString()}` : ""}`;
    setShowExportMenu(false);
  }

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
    mutationFn: async ({ id, stage, fromStageName, toStageName, isLost, previousStageId }: { id: string; stage: string; fromStageName?: string; toStageName?: string; isLost?: boolean; previousStageId?: string }) => {
      const payload: Record<string, unknown> = { stage };
      if (isLost) { payload.lostAt = new Date().toISOString(); }
      if (previousStageId) payload.previousStageId = previousStageId;
      await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });
      if (fromStageName && toStageName) {
        await fetch(`/api/leads/${id}/logs`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "stage_change", summary: `הועבר מ"${fromStageName}" ל"${toStageName}"`, treatment: "" }),
        });
      }
    },
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
        const fromStage = stages.find((s) => s.id === lead.stage);
        queryClient.setQueryData(["leads"], (old: Lead[]) =>
          old.map(l => l.id === activeLeadId ? { ...l, stage: targetStageId } : l)
        );

        if (targetStage?.isWon) {
          // Open treatment modal — it will call close-won and create the customer
          setSelectedLead({ ...lead, stage: targetStageId });
        } else {
          moveMutation.mutate({
            id: activeLeadId, stage: targetStageId,
            fromStageName: fromStage?.name, toStageName: targetStage?.name,
            isLost: !!targetStage?.isLost,
            previousStageId: (targetStage?.isLost || targetStage?.isWon) ? lead.stage : undefined,
          });
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

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
          <button
            onClick={() => setActiveTab("kanban")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "kanban" ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            קנבן
          </button>
          <button
            onClick={() => setActiveTab("archive")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "archive" ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
            )}
          >
            <Archive className="w-3.5 h-3.5" />
            ארכיון
            {(() => {
              const count = (wonStage ? leads.filter(l => l.stage === wonStage.id).length : 0)
                + (lostStage ? leads.filter(l => l.stage === lostStage.id).length : 0);
              return count > 0 ? (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  activeTab === "archive" ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
                )}>{count}</span>
              ) : null;
            })()}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "reports" ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
            )}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            דוחות
          </button>
        </div>

        {activeTab === "kanban" && (
          maxLeads !== null && leads.length >= maxLeads ? (
            <a
              href="/upgrade"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              שדרג לבייסיק
              <span className="opacity-80 text-xs font-normal">({leads.length}/{maxLeads})</span>
            </a>
          ) : (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />ליד חדש
              {maxLeads !== null && (
                <span className="mr-1 opacity-70 text-xs">({leads.length}/{maxLeads})</span>
              )}
            </button>
          )
        )}

        {/* Search — right side */}
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
            <input
              type="text"
              placeholder={activeTab === "archive" ? "חפש בארכיון..." : "חפש ליד..."}
              className="input pr-9 pl-3 text-sm w-full sm:w-52"
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
          {/* Archive hint — show when searching in kanban and archive has matches */}
          {activeTab === "kanban" && searchQuery.trim() && (() => {
            const q = searchQuery.toLowerCase();
            const archiveHits = leads.filter(l =>
              (l.stage === wonStage?.id || l.stage === lostStage?.id) &&
              (l.name.toLowerCase().includes(q) || (l.phone || "").includes(q) || (l.email || "").toLowerCase().includes(q))
            ).length;
            return archiveHits > 0 ? (
              <button
                onClick={() => setActiveTab("archive")}
                className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
              >
                <Archive className="w-3 h-3" />
                נמצא {archiveHits} בארכיון ←
              </button>
            ) : null;
          })()}
        </div>

        {/* Export button */}
        <div className="relative" ref={exportMenuRef}>
          <button
            className="btn-secondary text-sm gap-1.5"
            onClick={() => setShowExportMenu((v) => !v)}
            title="ייצוא לידים"
          >
            <Download className="w-4 h-4" />
            ייצוא
          </button>
          {showExportMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-petra-border z-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-petra-text">ייצוא לידים לאקסל</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-petra-muted mb-1 block">מתאריך</label>
                  <input
                    type="date"
                    className="input text-sm py-1.5"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-petra-muted mb-1 block">עד תאריך</label>
                  <input
                    type="date"
                    className="input text-sm py-1.5"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[11px] text-petra-muted">ללא סינון תאריך — ייצא את כל הלידים</p>
              <button className="btn-primary w-full text-sm" onClick={exportLeads}>
                <Download className="w-3.5 h-3.5" />
                הורד CSV
              </button>
            </div>
          )}
        </div>

        {/* Refresh controls — pushed to the left */}
        <div className="flex items-center gap-2 mr-auto">
          <button
            onClick={() => refetchLeads()}
            disabled={leadsLoading}
            title="רענן עכשיו"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", leadsLoading && "animate-spin")} />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "כבה אוטו-רענון" : "הפעל אוטו-רענון (30 שנ׳)"}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-all",
              autoRefresh
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-slate-200 text-petra-muted hover:text-petra-text"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            {autoRefresh ? "רענון אוטו פעיל" : "אוטו-רענון"}
          </button>
        </div>
        {activeTab === "kanban" && (
          <>
            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => {
                setAddStageTrigger((t) => t + 1);
                // Scroll kanban to the end so user sees the new input
                setTimeout(() => {
                  kanbanScrollRef.current?.scrollTo({ left: kanbanScrollRef.current.scrollWidth, behavior: "smooth" });
                }, 50);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              הוסף שלב
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
          </>
        )}
      </div>

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <LeadsReports leads={leads} stages={stages} />
      )}

      {/* Archive Tab */}
      {activeTab === "archive" && (
        <ArchiveTab
          leads={leads}
          wonStage={wonStage}
          lostStage={lostStage}
          activeStages={activeStages}
          searchQuery={searchQuery}
          onLeadClick={(lead) => setSelectedLead(lead)}
        />
      )}

      {/* Kanban Tab */}
      {activeTab === "kanban" && <>

      {/* Limit banner — shown when free tier reaches 20 leads */}
      {maxLeads !== null && leads.length >= maxLeads && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">הגעת ל-{maxLeads} לידים</span> — מגבלת המנוי החינמי.
            </p>
          </div>
          <a
            href="/upgrade"
            className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
          >
            שדרג לבייסיק ←
          </a>
        </div>
      )}

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
            <p className="text-2xl font-bold text-petra-text">{funnelStats.activeCount}</p>
            <p className="text-xs text-petra-muted mt-0.5">סה"כ לידים בטיפול</p>
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
          {funnelStats.topSource && (
            <div className="col-span-2 sm:col-span-4 bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-petra-muted">
                מקור מוביל: <span className="font-semibold text-petra-text">{funnelStats.topSource}</span>
              </p>
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
              <div ref={kanbanScrollRef} className="flex gap-4 overflow-x-auto pb-6 items-stretch mb-8 snap-x snap-mandatory scrollbar-hide" style={{ minHeight: "500px" }}>
                {activeStages.map((stage) => {
                  const stageLeads = sortLeadsByPriority(filteredLeads.filter((l) => l.stage === stage.id));
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
                <AddStageInline onAdd={handleAddStage} triggerOpen={addStageTrigger} />
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
          <div ref={kanbanScrollRef} className="flex gap-4 overflow-x-auto pb-6 items-stretch mb-8 snap-x snap-mandatory scrollbar-hide" style={{ minHeight: "500px" }}>
            {activeStages.map((stage) => {
              const stageLeads = sortLeadsByPriority(filteredLeads.filter((l) => l.stage === stage.id));
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
            <AddStageInline onAdd={handleAddStage} triggerOpen={addStageTrigger} />
          </div>

          <ArchiveList leads={leads} wonStage={wonStage} lostStage={lostStage} />

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

      </>}

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

export default function LeadsPage() {
  return (
    <>
      <PageTitle title="לידים" />
      <TierGate
      feature="leads"
      title="מערכת לידים ומכירות"
      description="ניהול לידים, CRM ועוקב מכירות. עקוב אחרי לקוחות פוטנציאליים, שלח הודעות ועקוב אחרי המרות."
    >
      <LeadsPageContent />
    </TierGate>
    </>
  );
}
