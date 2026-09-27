"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LOST_REASON_CODES, LEAD_SOURCES } from "@/lib/constants";
import {
    Phone, Mail, X, Check, CheckCircle2, XCircle, MessageCircle, Pencil, Trash2,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";
import LostReasonModal from "@/components/leads/LostReasonModal";
import { normalizeDealValue, formatIls } from "@/lib/lead-deal-value";

interface Lead {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    city?: string | null;
    address?: string | null;
    requestedService?: string | null;
    source: string;
    stage: string;
    notes: string | null;
    createdAt: string;
    lastContactedAt: string | null;
    nextFollowUpAt?: string | null;
    followUpStatus?: string | null;
    wonAt?: string | null;
    lostAt?: string | null;
    lostReasonCode?: string | null;
    lostReasonText?: string | null;
    dealValue?: number | null;
    callLogs?: {
        id: string;
        type?: string;
        summary: string;
        treatment: string;
        createdAt: string;
    }[];
}

interface LeadStage {
    id: string;
    name: string;
    color: string;
    isWon: boolean;
    isLost: boolean;
}

interface LeadTreatmentModalProps {
    lead: Lead | null;
    isOpen: boolean;
    onClose: () => void;
    stages: LeadStage[];
    onWon?: (name: string, customerId: string) => void;
    onDeleted?: () => void;
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const FIELD_BASE =
    "w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-colors focus:border-[#FB923C] focus:ring-[3px] focus:ring-orange-500/15";
const INPUT_CLS = cn(FIELD_BASE, "h-10");
const TEXTAREA_CLS = cn(FIELD_BASE, "py-2 leading-relaxed resize-y");
const FIELD_LABEL_CLS = "block text-[13px] font-medium text-[#0F172A] mb-1.5";
const SECTION_TITLE_CLS = "text-xs font-semibold text-slate-500 mb-3";

/** datetime-local wants local wall-clock time — toISOString() is UTC and shifted the follow-up by the TZ offset on every save. */
function toLocalDatetimeInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

type TLType = "created" | "call_log" | "stage_change" | "deal_value" | "follow_up" | "won" | "lost";

interface TLEvent {
    id: string;
    type: TLType;
    date: string;
    title: string;
    description?: string;
    action?: string;
    isFuture?: boolean;
}

function dotClass(event: TLEvent): string {
    if (event.type === "won") return "bg-emerald-500";
    if (event.type === "lost") return "bg-red-500";
    if (event.type === "follow_up" && event.isFuture) return "bg-orange-400";
    return "bg-slate-300";
}

interface TimelineItemProps {
    event: TLEvent;
    editingLogId: string | null;
    editLogSummary: string;
    editLogTreatment: string;
    onEditChange: (field: "summary" | "treatment", value: string) => void;
    onEditSave: () => void;
    onEditCancel: () => void;
    onEdit: (event: TLEvent) => void;
    onDelete: (event: TLEvent) => void;
    isSaving: boolean;
}

function TimelineItem({
    event, editingLogId, editLogSummary, editLogTreatment,
    onEditChange, onEditSave, onEditCancel, onEdit, onDelete, isSaving,
}: TimelineItemProps) {
    const isEditing = event.type === "call_log" && editingLogId === event.id;

    return (
        <div className="group relative grid grid-cols-[14px_1fr] gap-2.5 p-2 rounded-[10px] hover:bg-slate-50 transition-colors">
            {/* dot */}
            <div className="flex justify-center pt-[5px]">
                <span className={cn("relative z-10 w-[7px] h-[7px] rounded-full ring-2 ring-white", dotClass(event))} />
            </div>

            {/* content */}
            <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-slate-400 tabular-nums flex items-center gap-1.5">
                        {new Date(event.date).toLocaleString("he-IL", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                        })}
                        {event.isFuture && (
                            <span className="text-[10px] font-semibold text-[#C2410C] bg-[#FFF7ED] border border-[#FED7AA] px-1.5 rounded-full">
                                מתוכנן
                            </span>
                        )}
                    </div>
                    {event.type === "call_log" && !isEditing && (
                        <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEdit(event)}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700 transition-colors"
                                title="ערוך"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => onDelete(event)}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="מחק"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="text-sm font-medium leading-relaxed text-[#0F172A]">{event.title}</div>

                {isEditing ? (
                    <div className="mt-2 space-y-2.5 rounded-[10px] border border-slate-200 bg-white p-3">
                        <div>
                            <label className={FIELD_LABEL_CLS}>סיכום</label>
                            <textarea
                                className={TEXTAREA_CLS}
                                rows={2}
                                value={editLogSummary}
                                onChange={e => onEditChange("summary", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS}>משימת חזרה ללקוח</label>
                            <textarea
                                className={TEXTAREA_CLS}
                                rows={2}
                                value={editLogTreatment}
                                onChange={e => onEditChange("treatment", e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={onEditCancel}
                                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={onEditSave}
                                disabled={isSaving}
                                className="h-8 px-3 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                {isSaving
                                    ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    : <Check className="w-3 h-3" />}
                                שמור
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {event.description && (
                            <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                                {event.description}
                            </p>
                        )}
                        {event.action && (
                            <div className="mt-2 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] p-2 text-[13px] text-[#9A3412]">
                                <span className="block text-[11px] font-semibold mb-0.5">משימת חזרה</span>
                                <p className="whitespace-pre-wrap break-words">{event.action}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function LeadTreatmentModal({ lead, isOpen, onClose, stages, onWon, onDeleted }: LeadTreatmentModalProps) {
    const queryClient = useQueryClient();

    // Use live data from cache so call logs update after saving
    const leadsCache = queryClient.getQueryData<typeof lead[]>(["leads"]);
    const liveLead = leadsCache?.find((l) => l?.id === lead?.id) ?? lead;

    const [summary, setSummary] = useState("");
    const [treatment, setTreatment] = useState("");

    const [selectedStage, setSelectedStage] = useState(lead?.stage || stages[0]?.id || "");

    const [nextFollowUpAt, setNextFollowUpAt] = useState("");
    const [followUpStatus, setFollowUpStatus] = useState("pending");
    const [followUpError, setFollowUpError] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", city: "", address: "", requestedService: "", source: "" });

    const [lostModalOpen, setLostModalOpen] = useState(false);

    // Call log editing
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editLogSummary, setEditLogSummary] = useState("");
    const [editLogTreatment, setEditLogTreatment] = useState("");

    // Delete lead confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Deal value ("ערך עסקה") — edited only here, saved independently of "שמור וסגור"
    const [editingDeal, setEditingDeal] = useState(false);
    const [dealInput, setDealInput] = useState("");
    const [dealError, setDealError] = useState<string | null>(null);

    const lostStage = stages.find((s) => s.isLost);
    const wonStage = stages.find((s) => s.isWon);
    const isClosed = (wonStage && lead?.stage === wonStage.id) || (lostStage && lead?.stage === lostStage.id);
    const isSelectedWon = wonStage && selectedStage === wonStage.id;

    useEffect(() => {
        if (lead) {
            setSelectedStage(lead.stage);
            setEditForm({ name: lead.name, phone: lead.phone || "", email: lead.email || "", city: lead.city || "", address: lead.address || "", requestedService: lead.requestedService || "", source: lead.source });
            setIsEditing(false);
            setSummary("");
            setTreatment("");

            setFollowUpError(false);
            setEditingLogId(null);
            setShowDeleteConfirm(false);
            setEditingDeal(false);
            setDealError(null);
            setNextFollowUpAt(lead.nextFollowUpAt ? toLocalDatetimeInput(lead.nextFollowUpAt) : "");
            setFollowUpStatus(lead.followUpStatus || "pending");
        }
    }, [lead]);

    // ── Build CRM Timeline ────────────────────────────────────────────────

    const timeline = useMemo((): TLEvent[] => {
        if (!liveLead) return [];
        const events: TLEvent[] = [];

        events.push({
            id: "created",
            type: "created",
            date: liveLead.createdAt,
            title: "ליד נוצר במערכת",
            description: liveLead.notes || undefined,
        });

        if (liveLead.callLogs) {
            [...liveLead.callLogs]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .forEach((log) => {
                    const isStageChange = log.type === "stage_change";
                    const isDealValue = log.type === "deal_value";
                    const isSystem = isStageChange || isDealValue;
                    events.push({
                        id: log.id,
                        type: isStageChange ? "stage_change" : isDealValue ? "deal_value" : "call_log",
                        date: log.createdAt,
                        title: isStageChange ? "שינוי שלב" : isDealValue ? "ערך עסקה" : "שיחה תועדה",
                        description: log.summary,
                        action: !isSystem && log.treatment && log.treatment !== "ללא טיפול" ? log.treatment : undefined,
                    });
                });
        }

        if (liveLead.nextFollowUpAt) {
            const isFuture = new Date(liveLead.nextFollowUpAt) > new Date();
            events.push({
                id: "follow_up",
                type: "follow_up",
                date: liveLead.nextFollowUpAt,
                title: liveLead.followUpStatus === "completed" ? "פולואפ הושלם" : "פולואפ מתוזמן",
                isFuture,
            });
        }

        if (liveLead.wonAt) {
            events.push({ id: "won", type: "won", date: liveLead.wonAt, title: "ליד נסגר — לקוח נוצר" });
        }

        if (liveLead.lostAt) {
            const reasonLabel = liveLead.lostReasonCode
                ? LOST_REASON_CODES.find((r) => r.id === liveLead.lostReasonCode)?.label
                : undefined;
            events.push({
                id: "lost",
                type: "lost",
                date: liveLead.lostAt,
                title: "ליד אבד",
                description: reasonLabel || liveLead.lostReasonText || undefined,
            });
        }

        return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [liveLead]);

    // ── Mutations ─────────────────────────────────────────────────────────

    const updateLeadMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) =>
            fetch(`/api/leads/${lead!.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            }).then((r) => r.json()),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
        onError: () => toast.error("שגיאה בעדכון הליד. נסה שוב."),
    });

    const dealValueMutation = useMutation({
        mutationFn: async (value: number | null) => {
            const r = await fetch(`/api/leads/${lead!.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dealValue: value }),
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || "שגיאה בשמירת ערך העסקה");
            return data;
        },
        onSuccess: async (data: { id?: string; dealValue?: number | null }) => {
            // Patch the cached lead right away so the card never shows the old value while the list refetches
            queryClient.setQueryData<Lead[]>(["leads"], (old) =>
                old?.map((l) => (l.id === lead!.id ? { ...l, dealValue: data.dealValue ?? null } : l))
            );
            setEditingDeal(false);
            setDealError(null);
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        onError: (err: Error) => setDealError(err.message),
    });

    const closeWonMutation = useMutation({
        mutationFn: () =>
            fetch(`/api/leads/${lead!.id}/close-won`, { method: "POST" }).then(async (r) => {
                if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
                return r.json();
            }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            if (data.customerId && onWon) onWon(lead!.name, data.customerId);
            onClose();
        },
        onError: () => toast.error("שגיאה בסגירת הליד. נסה שוב."),
    });

    const closeLostMutation = useMutation({
        mutationFn: ({ reasonCode, reasonText }: { reasonCode: string; reasonText: string | null }) =>
            fetch(`/api/leads/${lead!.id}/close-lost`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reasonCode, reasonText }),
            }).then(async (r) => {
                if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
                return r.json();
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setLostModalOpen(false);
            onClose();
        },
        onError: () => toast.error("שגיאה בסימון הליד כאבוד. נסה שוב."),
    });

    const addCallLogMutation = useMutation({
        mutationFn: (data: { summary: string; treatment: string }) =>
            fetch(`/api/leads/${lead!.id}/logs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            }).then((r) => r.json()),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    });

    const editCallLogMutation = useMutation({
        mutationFn: ({ logId, summary, treatment }: { logId: string; summary: string; treatment: string }) =>
            fetch(`/api/leads/${lead!.id}/call-logs/${logId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ summary, treatment }),
            }).then((r) => r.json()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setEditingLogId(null);
        },
        onError: () => toast.error("שגיאה בעדכון יומן השיחה. נסה שוב."),
    });

    const deleteCallLogMutation = useMutation({
        mutationFn: (logId: string) =>
            fetch(`/api/leads/${lead!.id}/call-logs/${logId}`, { method: "DELETE" }).then((r) => r.json()),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
        onError: () => toast.error("שגיאה במחיקת יומן השיחה. נסה שוב."),
    });

    const deleteLeadMutation = useMutation({
        mutationFn: async () => {
            const r = await fetch(`/api/leads/${lead!.id}`, {
                method: "DELETE",
                headers: { "x-confirm-action": `DELETE_LEAD_${lead!.id}` },
            });
            // Parse defensively — a transient non-JSON response (timeout/gateway)
            // shouldn't blow up with a cryptic SyntaxError.
            const data = await r.json().catch(() => ({}));
            // 404 = lead already gone (e.g. another team member deleted it while
            // this board was stale). The end state is what the user wanted, so
            // treat it as done rather than an error.
            if (r.status === 404) return { status: 404, data };
            if (!r.ok && r.status !== 202) throw new Error(data.error || "שגיאה במחיקת הליד");
            return { status: r.status, data };
        },
        onSuccess: ({ status, data }) => {
            if (status === 202) {
                toast.success(data.message || "הבקשה נשלחה לאישור הבעלים");
            } else if (status === 404) {
                toast.success("הליד כבר נמחק");
            } else {
                toast.success("הליד נמחק");
            }
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setShowDeleteConfirm(false);
            onClose();
            if (onDeleted) onDeleted();
        },
        onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת הליד. נסה שוב."),
    });

    const isWorking = updateLeadMutation.isPending || closeWonMutation.isPending || closeLostMutation.isPending || dealValueMutation.isPending;

    const currentDealValue = liveLead?.dealValue ?? null;

    const startDealEdit = () => {
        setDealInput(currentDealValue != null ? String(currentDealValue) : "");
        setDealError(null);
        setEditingDeal(true);
    };

    /** Returns false when the input is invalid (caller should stop). */
    const saveDealValue = async (): Promise<boolean> => {
        if (dealValueMutation.isPending) return false;
        const parsed = normalizeDealValue(dealInput);
        if (!parsed.ok) { setDealError(parsed.error); return false; }
        if (parsed.value === currentDealValue) { setEditingDeal(false); setDealError(null); return true; }
        try {
            await dealValueMutation.mutateAsync(parsed.value);
            return true;
        } catch {
            return false;
        }
    };

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!lead) return;

        // An open deal-value edit is saved first so "שמור וסגור" never drops it
        if (editingDeal && !(await saveDealValue())) return;

        const hasCallContent = summary.trim() || treatment.trim();

        // If there's call content, require a follow-up date
        if (hasCallContent && !nextFollowUpAt) {
            setFollowUpError(true);
            document.getElementById("followup-date-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        setFollowUpError(false);

        if (isSelectedWon) {
            if (isEditing) {
                await updateLeadMutation.mutateAsync({
                    name: editForm.name, phone: editForm.phone || null,
                    email: editForm.email || null, source: editForm.source,
                    city: editForm.city || null, address: editForm.address || null,
                    requestedService: editForm.requestedService || null,
                });
            }
            await closeWonMutation.mutateAsync();
            return;
        }

        // Create call log entry if there's content
        if (hasCallContent) {
            await addCallLogMutation.mutateAsync({
                summary: summary.trim() || "ללא סיכום",
                treatment: treatment.trim() || "ללא טיפול",
            });
            setSummary("");
            setTreatment("");
        }

        // Log stage change if stage was changed
        const stageChanged = selectedStage !== lead.stage;
        if (stageChanged) {
            const fromStage = stages.find((s) => s.id === lead.stage);
            const toStage = stages.find((s) => s.id === selectedStage);
            if (fromStage && toStage) {
                await fetch(`/api/leads/${lead.id}/logs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "stage_change", summary: `הועבר מ"${fromStage.name}" ל"${toStage.name}"`, treatment: "" }),
                });
            }
        }

        await updateLeadMutation.mutateAsync({
            stage: selectedStage,
            ...(nextFollowUpAt && {
                nextFollowUpAt: new Date(nextFollowUpAt).toISOString(),
                followUpStatus,
            }),
            ...(isEditing && {
                name: editForm.name, phone: editForm.phone || null,
                email: editForm.email || null, source: editForm.source,
                city: editForm.city || null, address: editForm.address || null,
                requestedService: editForm.requestedService || null,
            }),
        });
        onClose();
    };

    const handleCloseWon = () => {
        if (isWorking) return;
        if (confirm("לסגור ליד וליצור לקוח חדש?")) closeWonMutation.mutate();
    };

    const handleCloseLost = () => {
        if (isWorking) return;
        setLostModalOpen(true);
    };

    const handleEditLog = (event: TLEvent) => {
        const log = liveLead?.callLogs?.find(l => l.id === event.id);
        if (!log) return;
        setEditingLogId(event.id);
        setEditLogSummary(log.summary === "ללא סיכום" ? "" : log.summary);
        setEditLogTreatment(log.treatment === "ללא טיפול" ? "" : log.treatment);
    };

    const handleDeleteLog = (event: TLEvent) => {
        if (!confirm("למחוק את יומן השיחה הזה?")) return;
        deleteCallLogMutation.mutate(event.id);
    };

    const handleEditLogSave = () => {
        if (!editingLogId) return;
        editCallLogMutation.mutate({
            logId: editingLogId,
            summary: editLogSummary.trim() || "ללא סיכום",
            treatment: editLogTreatment.trim() || "ללא טיפול",
        });
    };

    // Close the drawer on Escape (pure UI). Inner inputs that handle Escape
    // themselves (deal value) stop propagation, and the lost-reason modal owns
    // Escape while it is open.
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape" || e.defaultPrevented || lostModalOpen) return;
            onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, lostModalOpen, onClose]);

    if (!lead || !isOpen) return null;

    const currentStage = stages.find((s) => s.id === lead.stage);
    const isWonLead = !!(wonStage && lead.stage === wonStage.id);
    const headerName = isEditing ? editForm.name : lead.name;
    const subtitleParts = [lead.phone, lead.city, lead.requestedService].filter(Boolean) as string[];
    const sourceLabel = LEAD_SOURCES.find((s) => s.id === lead.source)?.label ?? lead.source;

    // Next follow-up (display only)
    const followUpIso = liveLead?.nextFollowUpAt ?? null;
    let followUpColor = "#0F172A";
    let followUpText: string | null = null;
    if (followUpIso) {
        const d = new Date(followUpIso);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        if (d < todayStart) followUpColor = "#B91C1C";
        else if (d < tomorrowStart) followUpColor = "#C2410C";
        followUpText = d.toLocaleString("he-IL", {
            weekday: "long", day: "numeric", month: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    const focusCallSummary = () => {
        const el = document.getElementById("lead-call-summary-input") as HTMLTextAreaElement | null;
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
    };

    const followUpInvalid = followUpError && !nextFollowUpAt;

    const dealValueCell = (
        <div className="min-w-0">
            <div className="text-xs text-slate-500 mb-1">ערך עסקה</div>
            {editingDeal ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative">
                        <span className="absolute inset-y-0 right-3 flex items-center text-sm text-slate-400 pointer-events-none">₪</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            dir="ltr"
                            autoFocus
                            aria-label="ערך עסקה בשקלים"
                            className={cn(INPUT_CLS, "h-9 w-28 text-left pr-8 tabular-nums", dealError && "border-red-400 focus:border-red-400 focus:ring-red-500/15")}
                            placeholder="350"
                            value={dealInput}
                            onChange={(e) => { setDealInput(e.target.value); setDealError(null); }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); void saveDealValue(); }
                                if (e.key === "Escape") { e.stopPropagation(); setEditingDeal(false); setDealError(null); }
                            }}
                        />
                    </div>
                    <button
                        onClick={() => void saveDealValue()}
                        disabled={dealValueMutation.isPending}
                        title="שמור"
                        className="h-9 px-2.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {dealValueMutation.isPending
                            ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            : <Check className="w-3 h-3" />}
                        שמור
                    </button>
                    <button
                        onClick={() => { setEditingDeal(false); setDealError(null); }}
                        disabled={dealValueMutation.isPending}
                        className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        ביטול
                    </button>
                </div>
            ) : (
                <div className="flex items-baseline gap-2">
                    <span className={cn("font-medium tabular-nums", currentDealValue != null ? "text-[#0F172A]" : "text-slate-400")}>
                        {currentDealValue != null ? formatIls(currentDealValue) : "—"}
                    </span>
                    <button
                        onClick={startDealEdit}
                        className="text-xs font-medium text-[#EA580C] hover:text-[#C2410C] hover:underline underline-offset-2"
                    >
                        {currentDealValue != null ? "ערוך" : "הוסף ערך"}
                    </button>
                </div>
            )}
            {dealError && <p className="text-xs text-red-600 mt-1">{dealError}</p>}
        </div>
    );

    return (
        <>
            {/* ── Overlay ─────────────────────────────────────────────── */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/35 animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* ── Drawer (physical left — RTL end) ─────────────────────── */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`כרטיס ליד: ${lead.name}`}
                className="fixed top-0 bottom-0 left-0 z-50 w-[460px] max-w-full bg-white overflow-y-auto flex flex-col text-[#0F172A] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] animate-in slide-in-from-left duration-300"
            >

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="px-6 py-5 border-b border-[#F1F5F9]">
                    <div className="flex flex-wrap items-center gap-2">
                        {currentStage && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage.color }} />
                                {currentStage.name}
                            </span>
                        )}
                        <span className="text-xs text-slate-400 tabular-nums">
                            נכנס {new Date(lead.createdAt).toLocaleDateString("he-IL")}
                        </span>

                        <div className="ms-auto flex items-center gap-1">
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={cn(
                                    "h-8 px-3 inline-flex items-center gap-1.5 border rounded-lg text-[13px] font-medium transition-colors",
                                    isEditing
                                        ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]"
                                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                עריכה
                            </button>
                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                    title="מחק ליד"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 h-8">
                                    <span className="text-xs text-red-700 font-medium">למחוק?</span>
                                    <button
                                        onClick={() => deleteLeadMutation.mutate()}
                                        disabled={deleteLeadMutation.isPending}
                                        className="text-xs px-2 py-0.5 rounded-md bg-red-600 text-white hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                                    >
                                        {deleteLeadMutation.isPending ? "מוחק..." : "כן, מחק"}
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="text-xs px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                title="סגור"
                                aria-label="סגור"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <h2 className="mt-3 text-[22px] font-bold tracking-tight leading-tight break-words">
                        {headerName}
                    </h2>

                    {subtitleParts.length > 0 && (
                        <div className="mt-1 text-sm text-slate-500 tabular-nums">
                            {subtitleParts.map((part, i) => (
                                <span key={i}>
                                    {i > 0 && " · "}
                                    {part === lead.phone ? <span dir="ltr">{part}</span> : part}
                                </span>
                            ))}
                        </div>
                    )}

                    {lead.email && (
                        <a
                            href={`https://mail.google.com/mail/?view=cm&to=${lead.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-[#EA580C] transition-colors"
                        >
                            <Mail className="w-3.5 h-3.5" />
                            <span dir="ltr">{lead.email}</span>
                        </a>
                    )}

                    {lead.phone && (
                        <div className="mt-4 flex gap-2">
                            <a
                                href={`tel:${lead.phone}`}
                                className="flex-1 h-10 rounded-[10px] inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors"
                            >
                                <Phone className="w-4 h-4" />
                                חיוג ללקוח
                            </a>
                            <a
                                href={`https://wa.me/${toWhatsAppPhone(lead.phone)}`}
                                target="whatsapp_window"
                                rel="noopener noreferrer"
                                title="שלח הודעה בוואטסאפ"
                                className="flex-1 h-10 rounded-[10px] inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] transition-colors"
                            >
                                <MessageCircle className="w-4 h-4" />
                                וואטסאפ
                            </a>
                        </div>
                    )}
                </div>

                {/* ── Quick log + next follow-up ─────────────────────── */}
                <div className="px-6 py-5 border-b border-[#F1F5F9]">
                    <button
                        type="button"
                        onClick={focusCallSummary}
                        className="w-full h-11 rounded-xl border border-[#FDBA74] bg-[#FFEDD5] text-[#9A3412] font-bold text-sm hover:bg-[#FED7AA] hover:border-[#FB923C] active:scale-[0.98] transition"
                    >
                        הוספת תיעוד שיחה
                    </button>
                    <div className="text-xs font-semibold text-slate-500 mt-4">חזרה הבאה</div>
                    {followUpText ? (
                        <div className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ color: followUpColor }}>
                            {followUpText}
                        </div>
                    ) : (
                        <div className="mt-0.5 text-[15px] font-semibold text-slate-400">לא נקבע מועד</div>
                    )}
                </div>

                {/* ── Details ────────────────────────────────────────── */}
                <div className="px-6 py-5 border-b border-[#F1F5F9]">
                    {isEditing ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-slate-500">עריכת פרטים</h4>
                                <button onClick={() => setIsEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">
                                    ביטול עריכה
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                {[
                                    { key: "name", label: "שם ליד" },
                                    { key: "phone", label: "טלפון" },
                                    { key: "email", label: "אימייל" },
                                    { key: "city", label: "עיר מגורים" },
                                    { key: "address", label: "כתובת" },
                                    { key: "requestedService", label: "שירות מבוקש" },
                                ].map(({ key, label }) => (
                                    <div key={key} className="min-w-0">
                                        <label className={FIELD_LABEL_CLS}>{label}</label>
                                        <input
                                            className={INPUT_CLS}
                                            value={(editForm as Record<string, string>)[key]}
                                            onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                                <div className="min-w-0">
                                    <label className={FIELD_LABEL_CLS}>מקור</label>
                                    <select
                                        className={INPUT_CLS}
                                        value={editForm.source}
                                        onChange={e => setEditForm({ ...editForm, source: e.target.value })}
                                    >
                                        {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-1">{dealValueCell}</div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                            <div className="min-w-0">
                                <div className="text-xs text-slate-500 mb-1">שירות מבוקש</div>
                                <div className="font-medium break-words">{lead.requestedService || "—"}</div>
                            </div>
                            {dealValueCell}
                            <div className="min-w-0">
                                <div className="text-xs text-slate-500 mb-1">מקור</div>
                                <div className="font-medium">{sourceLabel}</div>
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs text-slate-500 mb-1">עיר</div>
                                <div className="font-medium break-words">{lead.city || "—"}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 px-6 py-5 space-y-6">

                    {/* ── Stage ──────────────────────────────────────── */}
                    <div>
                        <h3 className={SECTION_TITLE_CLS}>שלב במכירה</h3>
                        {!isClosed && (
                            <div className="flex flex-wrap gap-2">
                                {stages.map((stage) => (
                                    <button
                                        key={stage.id}
                                        onClick={() => setSelectedStage(stage.id)}
                                        className={cn(
                                            "h-8 px-3 rounded-full border text-[13px] font-medium transition-colors inline-flex items-center gap-1.5",
                                            selectedStage === stage.id
                                                ? "border-current"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        )}
                                        style={selectedStage === stage.id ? {
                                            color: stage.color,
                                            backgroundColor: `${stage.color}15`,
                                            borderColor: stage.color,
                                        } : {}}
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                        {stage.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isClosed && (
                            <div className={cn(
                                "rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-semibold border",
                                isWonLead
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                            )}>
                                {isWonLead
                                    ? <><CheckCircle2 className="w-4 h-4" /> ליד נסגר בהצלחה — לקוח נוצר</>
                                    : <><XCircle className="w-4 h-4" /> ליד אבוד</>
                                }
                            </div>
                        )}
                    </div>

                    {/* ── Call log + follow-up ───────────────────────── */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2.5 text-[13px] font-semibold border-b border-slate-200">
                            תיעוד שיחה
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label htmlFor="lead-call-summary-input" className={FIELD_LABEL_CLS}>סיכום</label>
                                <textarea
                                    id="lead-call-summary-input"
                                    className={TEXTAREA_CLS}
                                    rows={3}
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    placeholder="מה נאמר בשיחה? לאיזה סיכום הגעתם?"
                                />
                            </div>
                            <div>
                                <label className={FIELD_LABEL_CLS}>משימת חזרה ללקוח</label>
                                <textarea
                                    className={TEXTAREA_CLS}
                                    rows={2}
                                    value={treatment}
                                    onChange={(e) => setTreatment(e.target.value)}
                                    placeholder="מה הצעדים הבאים להמשך הטיפול בליד?"
                                />
                            </div>

                            {/* Follow-up scheduling — required before confirming a call */}
                            <div id="followup-section">
                                <label htmlFor="followup-date-input" className={FIELD_LABEL_CLS}>
                                    מועד חזרה <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        id="followup-date-input"
                                        type="datetime-local"
                                        className={cn(
                                            INPUT_CLS,
                                            "flex-1 min-w-[180px] tabular-nums",
                                            followUpInvalid && "border-red-400 focus:border-red-400 focus:ring-red-500/15"
                                        )}
                                        value={nextFollowUpAt}
                                        onChange={(e) => { setNextFollowUpAt(e.target.value); setFollowUpError(false); }}
                                    />
                                    <div className="flex h-10 p-1 rounded-[10px] bg-slate-100" role="group" aria-label="סטטוס חזרה">
                                        <button
                                            type="button"
                                            className={cn(
                                                "px-3 text-xs font-medium rounded-lg transition-colors",
                                                followUpStatus === "pending" ? "bg-white text-[#C2410C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                                            )}
                                            onClick={() => setFollowUpStatus("pending")}
                                        >
                                            ממתין
                                        </button>
                                        <button
                                            type="button"
                                            className={cn(
                                                "px-3 text-xs font-medium rounded-lg transition-colors",
                                                followUpStatus === "completed" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                            )}
                                            onClick={() => setFollowUpStatus("completed")}
                                        >
                                            הושלם
                                        </button>
                                    </div>
                                </div>
                                {followUpInvalid && (
                                    <p className="mt-1.5 text-xs text-red-600">יש לקבוע מועד חזרה לפני שמירת שיחה</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── History (newest first) ─────────────────────── */}
                    <div>
                        <h3 className={SECTION_TITLE_CLS}>היסטוריה</h3>
                        {timeline.length > 0 ? (
                            <div className="relative">
                                <div className="absolute top-3 bottom-3 right-[15px] w-px bg-slate-200" aria-hidden="true" />
                                {[...timeline].reverse().map((event) => (
                                    <TimelineItem
                                        key={event.id}
                                        event={event}
                                        editingLogId={editingLogId}
                                        editLogSummary={editLogSummary}
                                        editLogTreatment={editLogTreatment}
                                        onEditChange={(field, value) => {
                                            if (field === "summary") setEditLogSummary(value);
                                            else setEditLogTreatment(value);
                                        }}
                                        onEditSave={handleEditLogSave}
                                        onEditCancel={() => setEditingLogId(null)}
                                        onEdit={handleEditLog}
                                        onDelete={handleDeleteLog}
                                        isSaving={editCallLogMutation.isPending}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 py-4 text-center">אין עדיין היסטוריה</p>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isWorking}
                        className="h-10 px-5 rounded-[10px] bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                        {updateLeadMutation.isPending ? "שומר..." : "שמור וסגור"}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isWorking}
                        className="h-10 px-4 border border-slate-200 rounded-[10px] bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        סגור
                    </button>

                    {!isClosed && (
                        <div className="ms-auto flex gap-2">
                            <button
                                onClick={handleCloseWon}
                                disabled={isWorking}
                                className="h-10 px-4 rounded-[10px] bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                {closeWonMutation.isPending ? "סוגר..." : "נסגר כלקוח"}
                            </button>
                            <button
                                onClick={handleCloseLost}
                                disabled={isWorking}
                                className="h-10 px-4 rounded-[10px] border border-red-200 text-red-700 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                {closeLostMutation.isPending ? "מסמן..." : "אבד"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Lost Reason Modal — rendered after the drawer (and z-60) so it stacks on top */}
            <LostReasonModal
                isOpen={lostModalOpen}
                onClose={() => setLostModalOpen(false)}
                onConfirm={(reasonCode, reasonText) => closeLostMutation.mutate({ reasonCode, reasonText })}
                isPending={closeLostMutation.isPending}
            />
        </>
    );
}
