"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import Link from "next/link";
import {
  UserCheck, Plus, X, Search, Phone, ChevronLeft, Dog,
  LayoutGrid, LayoutList, Pencil, Trash2, GripVertical, Check, Upload,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import {
  DISABILITY_TYPE_MAP,
  PLACEMENT_STATUS_MAP,
  RECIPIENT_FUNDING_SOURCES,
  FUNDING_SOURCE_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";
import { TierGate } from "@/components/paywall/TierGate";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";
import { ImportModal } from "@/components/import/ImportModal";

interface Stage {
  id: string;
  key: string;
  name: string;
  color: string;
  sortOrder: number;
  isBuiltIn: boolean;
}

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  disabilityType: string | null;
  fundingSource: string | null;
  status: string;
  waitlistDate: string | null;
  notes: string | null;
  placements: Array<{
    id: string;
    status: string;
    serviceDog: { id: string; pet: { name: string } };
  }>;
}

// ─── Column colors for new stage picker ───
const STAGE_COLORS = [
  { key: "gray", value: "bg-slate-100 text-slate-600" },
  { key: "blue", value: "bg-blue-100 text-blue-700" },
  { key: "green", value: "bg-emerald-100 text-emerald-700" },
  { key: "purple", value: "bg-purple-100 text-purple-700" },
  { key: "orange", value: "bg-amber-100 text-amber-700" },
  { key: "red", value: "bg-red-100 text-red-600" },
  { key: "indigo", value: "bg-indigo-100 text-indigo-700" },
];

// ─── Draggable recipient card ───
function DraggableRecipientCard({ recipient, stageKey, onDelete }: { recipient: Recipient; stageKey: string; onDelete: (id: string, name: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${recipient.id}`,
    data: { type: "card", recipientId: recipient.id, stageKey },
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const activePlacement = recipient.placements.find((p) => p.status === "ACTIVE");
  const t = useTranslations("serviceDogs.serviceDogsRecipientsPage");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-white rounded-xl border p-3 text-start cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && "opacity-40 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      <Link
        href={`/service-dogs/recipients/${recipient.id}`}
        className="block"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-semibold text-sm mb-0.5">{recipient.name}</p>
        {recipient.disabilityType && (
          <p className="text-xs text-petra-muted mb-1.5">
            {DISABILITY_TYPE_MAP[recipient.disabilityType] || recipient.disabilityType}
          </p>
        )}
        {recipient.fundingSource && (
          <p className="text-xs text-brand-500 font-medium mb-1.5">
            {FUNDING_SOURCE_MAP[recipient.fundingSource] || recipient.fundingSource}
          </p>
        )}
        {activePlacement && (
          <div className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full w-fit mb-1.5">
            <Dog className="w-3 h-3" />
            <span>{activePlacement.serviceDog.pet.name}</span>
          </div>
        )}
        {recipient.phone && (
          <div className="flex items-center gap-1 text-xs text-petra-muted">
            <Phone className="w-3 h-3" />
            <span>{recipient.phone}</span>
          </div>
        )}
      </Link>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(recipient.id, recipient.name); }}
        className="absolute top-2 end-2 w-6 h-6 flex items-center justify-center rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-50 text-petra-muted hover:text-red-500 transition-all"
        title={t("deleteRecipientTitle")}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Droppable column ───
function DroppableColumn({
  stage, recipients, onRename, onDelete, isEditMode, onDeleteRecipient,
}: {
  stage: Stage;
  recipients: Recipient[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isEditMode: boolean;
  onDeleteRecipient: (id: string, name: string) => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsRecipientsPage");
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage.key}` });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRenameSubmit = () => {
    if (editName.trim() && editName.trim() !== stage.name) {
      onRename(stage.id, editName.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col w-full min-w-[200px] sm:min-w-[240px] sm:w-[240px] shrink-0">
      {/* Column header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 rounded-t-xl border-b font-semibold text-sm",
        stage.color.replace("text-", "text-").replace("bg-", "bg-"),
      )}>
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(); if (e.key === "Escape") setEditing(false); }}
            onBlur={handleRenameSubmit}
            className="bg-white/80 rounded px-1 py-0.5 text-sm font-medium w-full border border-white/60 outline-none"
          />
        ) : (
          <span>{stage.name}</span>
        )}
        <div className="flex items-center gap-1 ms-2 shrink-0">
          <span className="text-xs opacity-70 font-normal">{recipients.length}</span>
          {isEditMode && (
            <>
              <button
                onClick={() => { setEditing(true); setEditName(stage.name); }}
                className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-white/40 transition-all"
              >
                <Pencil className="w-3 h-3" />
              </button>
              {!stage.isBuiltIn && (
                <button
                  onClick={() => onDelete(stage.id)}
                  className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-white/40 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[300px] p-2 space-y-2 rounded-b-xl border border-t-0 transition-colors",
          isOver ? "bg-brand-50 border-brand-200" : "bg-slate-50/60 border-slate-200"
        )}
      >
        <SortableContext
          items={recipients.map((r) => `card-${r.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {recipients.map((r) => (
            <DraggableRecipientCard key={r.id} recipient={r} stageKey={stage.key} onDelete={onDeleteRecipient} />
          ))}
        </SortableContext>
        {recipients.length === 0 && (
          <div className={cn("flex items-center justify-center h-20 text-xs text-petra-muted/60 rounded-lg border-2 border-dashed transition-colors", isOver && "border-brand-300 text-brand-400")}>
            {isOver ? t("column.dropHere") : t("empty")}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable column wrapper (for column reordering) ───
function SortableColumn({ stage, children }: { stage: Stage; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${stage.key}`,
    data: { type: "column", stageKey: stage.key },
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn("flex flex-col", isDragging && "opacity-50")}>
      {children}
    </div>
  );
}

// ─── Main Page ───
function RecipientsPageContent() {
  const t = useTranslations("serviceDogs.serviceDogsRecipientsPage");
  const tc = useTranslations("common");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [view, setView] = useState<"kanban" | "table">("table");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(STAGE_COLORS[0].value);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: stages = [], isLoading: stagesLoading } = useQuery<Stage[]>({
    queryKey: ["recipient-stages"],
    queryFn: () => fetch("/api/service-recipient-stages").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch stages");
      return r.json();
    }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<Recipient[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch recipients");
      return r.json();
    }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/service-recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-recipients"] }),
    onError: () => toast.error(t("toasts.statusUpdateError")),
  });

  const renameStageMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      fetch(`/api/service-recipient-stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipient-stages"] });
      toast.success(t("toasts.stageUpdated"));
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/service-recipient-stages/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipient-stages"] });
      toast.success(t("toasts.stageDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.stageDeleteError")),
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/service-recipients/${id}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_RECIPIENT_${id}` },
      }).then(async (r) => {
        const data = await r.json();
        if (r.status === 202) { toast.success(t("toasts.pendingApproval")); return data; }
        if (!r.ok) throw new Error(data.error || t("toasts.genericError"));
        return data;
      }),
    onSuccess: (data) => {
      if (!data.pendingApproval) toast.success(t("toasts.recipientDeleted"));
      queryClient.invalidateQueries({ queryKey: ["service-recipients"] });
      setConfirmDelete(null);
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.deleteError")),
  });

  const addStageMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      fetch("/api/service-recipient-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipient-stages"] });
      setShowAddColumn(false);
      setNewColName("");
      toast.success(t("toasts.stageAdded"));
    },
  });

  const reorderStageMutation = useMutation({
    mutationFn: (updates: { id: string; sortOrder: number }[]) =>
      Promise.all(updates.map(({ id, sortOrder }) =>
        fetch(`/api/service-recipient-stages/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder }),
        })
      )),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipient-stages"] }),
  });

  // ── DnD handlers ──────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    if (activeData?.type === "card") {
      // Card dropped on a column or another card
      let targetStageKey: string | null = null;
      if (overId.startsWith("col-")) {
        targetStageKey = overId.replace("col-", "");
      } else if (overId.startsWith("card-")) {
        // Find which column the target card is in
        const targetRecipientId = overId.replace("card-", "");
        const targetRecipient = recipients.find((r) => r.id === targetRecipientId);
        targetStageKey = targetRecipient?.status ?? null;
      }
      if (targetStageKey && targetStageKey !== activeData.stageKey) {
        moveMutation.mutate({ id: activeData.recipientId, status: targetStageKey });
      }
    } else if (activeData?.type === "column") {
      // Column reordered
      const activeColKey = activeData.stageKey;
      const overColKey = overId.replace("col-", "");
      if (activeColKey !== overColKey) {
        const oldIndex = stages.findIndex((s) => s.key === activeColKey);
        const newIndex = stages.findIndex((s) => s.key === overColKey);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(stages, oldIndex, newIndex);
          reorderStageMutation.mutate(
            reordered.map((s, i) => ({ id: s.id, sortOrder: i }))
          );
          // Optimistic update
          queryClient.setQueryData(["recipient-stages"], reordered.map((s, i) => ({ ...s, sortOrder: i })));
        }
      }
    }
  };

  // ── Filtered data ──────────────────────────────────────────────
  const activeStages = stages.filter((s) => showArchive || s.key !== "REJECTED");
  const filtered = recipients.filter((r) => {
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchSearch = !search || r.name.includes(search) || (r.phone || "").includes(search);
    const matchArchive = showArchive || r.status !== "REJECTED";
    return matchStatus && matchSearch && matchArchive;
  });

  const activeRecipient = activeId?.startsWith("card-")
    ? recipients.find((r) => r.id === activeId.replace("card-", ""))
    : null;

  const isLoading = stagesLoading || recipientsLoading;

  return (
    <div className="animate-fade-in space-y-4">
      <ServiceDogsTabs />

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-petra-muted mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">{t("breadcrumb.serviceDogs")}</Link>
            <ChevronLeft className="w-3.5 h-3.5 ltr:-scale-x-100" />
            <span>{t("breadcrumb.recipients")}</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-500" />
            {t("title")}
          </h1>
          <p className="text-sm text-petra-muted mt-1">
            {t("subtitle", {
              total: recipients.length,
              waitlist: recipients.filter((r) => r.status === "WAITLIST").length,
              active: recipients.filter((r) => r.status === "ACTIVE").length,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 absolute top-2.5 start-3 text-petra-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="input ps-9 text-sm w-full sm:w-52"
            />
          </div>
          {/* Edit mode toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn("btn-secondary text-sm flex items-center gap-1.5", isEditMode && "border-brand-400 text-brand-600 bg-brand-50")}
            title={t("editColumns")}
          >
            <Pencil className="w-3.5 h-3.5" />
            {isEditMode ? t("finishEditing") : t("editColumns")}
          </button>
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={() => setView("kanban")} className={cn("p-1.5 rounded transition-colors", view === "kanban" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted")}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView("table")} className={cn("p-1.5 rounded transition-colors", view === "table" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted")}>
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowArchive(!showArchive)}
            className={cn("btn-secondary flex items-center gap-2", showArchive && "border-red-300 text-red-600 bg-red-50")}
          >
            {showArchive ? t("hideArchive") : t("archive")}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t("importFromFile")}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t("addRecipient")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : view === "kanban" ? (
        // ── Kanban view ──────────────────────────────────────────
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeStages.map((s) => `col-${s.key}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 overflow-x-auto pb-6 min-h-[400px]">
              {activeStages.map((stage) => {
                const stageRecipients = filtered.filter((r) => r.status === stage.key);
                return (
                  <SortableColumn key={stage.key} stage={stage}>
                    <DroppableColumn
                      stage={stage}
                      recipients={stageRecipients}
                      onRename={(id, name) => renameStageMutation.mutate({ id, name })}
                      onDelete={(id) => { if (confirm(t("confirmDeleteStage"))) deleteStageMutation.mutate(id); }}
                      isEditMode={isEditMode}
                      onDeleteRecipient={(id, name) => setConfirmDelete({ id, name })}
                    />
                  </SortableColumn>
                );
              })}

              {/* Add column button */}
              {isEditMode && (
                <div className="shrink-0 w-[200px]">
                  {showAddColumn ? (
                    <div className="card p-3 space-y-2">
                      <p className="text-xs font-semibold">{t("newStage")}</p>
                      <input
                        autoFocus
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && newColName.trim()) addStageMutation.mutate({ name: newColName, color: newColColor }); if (e.key === "Escape") setShowAddColumn(false); }}
                        className="input w-full text-sm"
                        placeholder={t("stageNamePlaceholder")}
                      />
                      <div className="flex flex-wrap gap-1">
                        {STAGE_COLORS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => setNewColColor(c.value)}
                            className={cn("w-5 h-5 rounded-full border-2 transition-all", c.value.replace("text-", "bg-").split(" ")[0], newColColor === c.value ? "border-slate-600" : "border-transparent")}
                            title={t(`stageColors.${c.key}`)}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="btn-primary text-xs flex-1"
                          onClick={() => { if (newColName.trim()) addStageMutation.mutate({ name: newColName, color: newColColor }); }}
                          disabled={!newColName.trim() || addStageMutation.isPending}
                        >
                          <Check className="w-3 h-3 inline me-1" />{tc("actions.add")}
                        </button>
                        <button className="btn-secondary text-xs" onClick={() => setShowAddColumn(false)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddColumn(true)}
                      className="w-full h-12 border-2 border-dashed border-slate-300 rounded-xl text-sm text-petra-muted hover:border-brand-300 hover:text-brand-500 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {t("addColumn")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay>
            {activeRecipient && (
              <div className="bg-white rounded-xl border shadow-xl p-3 w-[230px] opacity-95 rotate-1">
                <p className="font-semibold text-sm">{activeRecipient.name}</p>
                {activeRecipient.disabilityType && (
                  <p className="text-xs text-petra-muted">{DISABILITY_TYPE_MAP[activeRecipient.disabilityType] || activeRecipient.disabilityType}</p>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        // ── Table view ──────────────────────────────────────────
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            {activeStages.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(statusFilter === s.key ? "" : s.key)}
                className={cn("text-xs px-3 py-1 rounded-full border transition-all", statusFilter === s.key ? s.color + " border-current" : "border-transparent text-petra-muted hover:text-foreground")}
              >
                {s.name} ({recipients.filter((r) => r.status === s.key).length})
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3 text-start font-medium text-petra-muted">{t("table.name")}</th>
                <th className="p-3 text-start font-medium text-petra-muted">{t("table.idNumber")}</th>
                <th className="p-3 text-start font-medium text-petra-muted">{t("table.residence")}</th>
                <th className="p-3 text-start font-medium text-petra-muted">{t("table.funding")}</th>
                <th className="p-3 text-start font-medium text-petra-muted">{t("table.stage")}</th>
                <th className="p-3 text-start font-medium text-petra-muted">{t("table.dogName")}</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const stage = stages.find((s) => s.key === r.status);
                const activePlacement = r.placements.find((p) => p.status === "ACTIVE");
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="p-3">
                      <Link href={`/service-dogs/recipients/${r.id}`} className="font-medium hover:text-brand-600">{r.name}</Link>
                    </td>
                    <td className="p-3 text-petra-muted">{r.idNumber || "—"}</td>
                    <td className="p-3 text-petra-muted">{r.address || "—"}</td>
                    <td className="p-3">{r.fundingSource ? (FUNDING_SOURCE_MAP[r.fundingSource] || r.fundingSource) : "—"}</td>
                    <td className="p-3">
                      {stage && <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", stage.color)}>{stage.name}</span>}
                    </td>
                    <td className="p-3 text-petra-muted">
                      {activePlacement ? activePlacement.serviceDog.pet.name : "—"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setConfirmDelete({ id: r.id, name: r.name })}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors"
                        title={t("deleteRecipientTitle")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-10 text-center text-petra-muted">{t("empty")}</div>
          )}
        </div>
      )}

      {/* Add recipient modal */}
      {showAddModal && (
        <AddRecipientModal
          stages={stages.filter((s) => s.key !== "REJECTED")}
          onClose={() => setShowAddModal(false)}
          onAdded={() => queryClient.invalidateQueries({ queryKey: ["service-recipients"] })}
        />
      )}
      {showImportModal && (
        <ImportModal
          title={t("importTitle")}
          templateUrl="/api/service-recipients/import/template"
          importUrl="/api/service-recipients/import"
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["service-recipients"] })}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Delete recipient confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-petra-text">{t("deleteModal.title")}</h3>
                <p className="text-sm text-petra-muted mt-1">
                  {t.rich("deleteModal.question", {
                    name: confirmDelete.name,
                    b: (c) => <span className="font-medium text-petra-text">{c}</span>,
                  })}
                  <br />{t("deleteModal.irreversible")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>{tc("actions.cancel")}</button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                onClick={() => deleteRecipientMutation.mutate(confirmDelete.id)}
                disabled={deleteRecipientMutation.isPending}
              >
                {deleteRecipientMutation.isPending ? tc("progress.deleting") : tc("actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecipientsPage() {
  const t = useTranslations("serviceDogs.serviceDogsRecipientsPage");
  const perms = usePermissions();

  if (!perms.canSeeRecipientsSensitive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCheck className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-petra-text mb-2">{t("noPermission.title")}</h2>
        <p className="text-sm text-petra-muted">{t("noPermission.body")}</p>
      </div>
    );
  }

  return (
    <TierGate
      feature="service_dogs"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
      upgradeTier="service_dog"
    >
      <RecipientsPageContent />
    </TierGate>
  );
}

// ─── Add Recipient Modal ────────────────────────────────────────
function AddRecipientModal({
  stages, onClose, onAdded,
}: {
  stages: Stage[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsRecipientsPage");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [disabilityType, setDisabilityType] = useState("");
  const [disabilityNotes, setDisabilityNotes] = useState("");
  const [fundingSource, setFundingSource] = useState("");
  const [status, setStatus] = useState(stages[0]?.key || "LEAD");
  const [notes, setNotes] = useState("");

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => { toast.success(t("toasts.added")); onAdded(); onClose(); },
    onError: () => toast.error(t("toasts.addError")),
  });

  const DISABILITY_TYPES_LIST = [
    { id: "PTSD" }, { id: "VISUAL" },
    { id: "HEARING" }, { id: "MOBILITY" },
    { id: "AUTISM" }, { id: "DIABETES" },
    { id: "EPILEPSY" }, { id: "OTHER" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-500" />
            {t("addModal.title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label text-xs">{t("addModal.fullName")}</label>
              <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("addModal.fullNamePlaceholder")} />
            </div>
            <div>
              <label className="label text-xs">{t("addModal.mobile")}</label>
              <input type="tel" dir="ltr" className="input w-full text-right" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("addModal.email")}</label>
              <input type="email" dir="ltr" className="input w-full text-right" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("addModal.phone")}</label>
              <input type="tel" dir="ltr" className="input w-full text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("addModal.idNumber")}</label>
              <input className="input w-full" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("addModal.stageStatus")}</label>
              <select className="input w-full text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t("addModal.address")}</label>
              <input className="input w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("addModal.disabilityType")}</label>
              <select className="input w-full text-sm" value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)}>
                <option value="">{t("addModal.choose")}</option>
                {DISABILITY_TYPES_LIST.map((d) => <option key={d.id} value={d.id}>{t(`addModal.disabilityTypes.${d.id}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">{t("addModal.fundingSource")}</label>
              <select className="input w-full text-sm" value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
                <option value="">{t("addModal.choose")}</option>
                {RECIPIENT_FUNDING_SOURCES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t("addModal.disabilityNotes")}</label>
              <input className="input w-full" value={disabilityNotes} onChange={(e) => setDisabilityNotes(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t("addModal.notes")}</label>
              <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="btn-primary flex-1"
            onClick={() => addMutation.mutate({ name, phone, mobile, email, idNumber, address, disabilityType, disabilityNotes, fundingSource, notes, status })}
            disabled={!name.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? t("addModal.adding") : t("addRecipient")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
