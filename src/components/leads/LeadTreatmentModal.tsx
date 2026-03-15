"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LOST_REASON_CODES, LEAD_SOURCES } from "@/lib/constants";
import {
    Phone, Mail, Calendar, User, AlignLeft, X, Clock,
    CheckCircle2, History, Check, CalendarCheck,
    Trophy, XCircle, MessageSquare, Star, Zap, MessageCircle,
    Pencil, Trash2,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";
import LostReasonModal from "@/components/leads/LostReasonModal";

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
    nextFollowUpAt?: string | null;
    followUpStatus?: string | null;
    wonAt?: string | null;
    lostAt?: string | null;
    lostReasonCode?: string | null;
    lostReasonText?: string | null;
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

// ─── Timeline ────────────────────────────────────────────────────────────────

type TLType = "created" | "call_log" | "follow_up" | "won" | "lost";

interface TLEvent {
    id: string;
    type: TLType;
    date: string;
    title: string;
    description?: string;
    action?: string;
    isFuture?: boolean;
}

const TL_STYLES: Record<TLType, { icon: React.ReactNode; dot: string; line: string; card: string }> = {
    created: {
        icon: <Star className="w-3.5 h-3.5" />,
        dot: "bg-violet-100 text-violet-600 border-violet-300",
        line: "bg-violet-200",
        card: "bg-violet-50/60 border-violet-100",
    },
    call_log: {
        icon: <MessageSquare className="w-3.5 h-3.5" />,
        dot: "bg-blue-100 text-blue-600 border-blue-300",
        line: "bg-blue-200",
        card: "bg-blue-50/50 border-blue-100",
    },
    follow_up: {
        icon: <CalendarCheck className="w-3.5 h-3.5" />,
        dot: "bg-amber-100 text-amber-600 border-amber-300",
        line: "bg-amber-200",
        card: "bg-amber-50/50 border-amber-100",
    },
    won: {
        icon: <Trophy className="w-3.5 h-3.5" />,
        dot: "bg-green-100 text-green-600 border-green-300",
        line: "bg-green-200",
        card: "bg-green-50/60 border-green-100",
    },
    lost: {
        icon: <XCircle className="w-3.5 h-3.5" />,
        dot: "bg-red-100 text-red-600 border-red-300",
        line: "bg-red-200",
        card: "bg-red-50/50 border-red-100",
    },
};

interface TimelineItemProps {
    event: TLEvent;
    isLast: boolean;
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
    event, isLast, editingLogId, editLogSummary, editLogTreatment,
    onEditChange, onEditSave, onEditCancel, onEdit, onDelete, isSaving,
}: TimelineItemProps) {
    const s = TL_STYLES[event.type];
    const isEditing = event.type === "call_log" && editingLogId === event.id;

    return (
        <div className="flex gap-3 relative">
            {/* connector line */}
            {!isLast && (
                <div className={cn("absolute top-9 bottom-0 w-0.5 z-0", s.line)}
                    style={{ right: "17px" }} />
            )}

            {/* dot */}
            <div className={cn(
                "w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 shadow-sm",
                s.dot,
                event.isFuture && "ring-2 ring-amber-300 ring-offset-1 opacity-80",
            )}>
                {s.icon}
            </div>

            {/* content */}
            <div className="flex-1 pb-4 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-petra-text leading-tight">
                            {event.title}
                        </span>
                        {event.isFuture && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                מתוכנן
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[11px] text-petra-muted whitespace-nowrap bg-white/80 px-1.5 py-0.5 rounded border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                            {new Date(event.date).toLocaleString("he-IL", {
                                day: "2-digit", month: "2-digit", year: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                            })}
                        </span>
                        {event.type === "call_log" && !isEditing && (
                            <>
                                <button
                                    onClick={() => onEdit(event)}
                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                    title="ערוך"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => onDelete(event)}
                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                    title="מחק"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className={cn("rounded-lg border p-3 space-y-2 text-sm", s.card)}>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">סיכום השיחה</label>
                            <textarea
                                className="input text-sm"
                                rows={2}
                                value={editLogSummary}
                                onChange={e => onEditChange("summary", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">המשך טיפול</label>
                            <textarea
                                className="input text-sm"
                                rows={2}
                                value={editLogTreatment}
                                onChange={e => onEditChange("treatment", e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                onClick={onEditCancel}
                                className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={onEditSave}
                                disabled={isSaving}
                                className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                {isSaving
                                    ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    : <Check className="w-3 h-3" />}
                                שמור
                            </button>
                        </div>
                    </div>
                ) : (
                    (event.description || event.action) && (
                        <div className={cn("rounded-lg border p-3 space-y-2 text-sm", s.card)}>
                            {event.description && (
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {event.description}
                                </p>
                            )}
                            {event.action && (
                                <div className="bg-amber-50 border border-amber-100 rounded-md p-2">
                                    <span className="text-[11px] font-bold text-amber-700 block mb-0.5">
                                        Action Items ←
                                    </span>
                                    <p className="text-amber-900 whitespace-pre-wrap">{event.action}</p>
                                </div>
                            )}
                        </div>
                    )
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

    const [selectedStage, setSelectedStage] = useState(lead?.stage || "new");

    const [nextFollowUpAt, setNextFollowUpAt] = useState("");
    const [followUpStatus, setFollowUpStatus] = useState("pending");
    const [followUpError, setFollowUpError] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", source: "" });

    const [lostModalOpen, setLostModalOpen] = useState(false);

    // Call log editing
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editLogSummary, setEditLogSummary] = useState("");
    const [editLogTreatment, setEditLogTreatment] = useState("");

    // Delete lead confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isClosed = lead?.stage === "won" || lead?.stage === "lost";
    const lostStage = stages.find((s) => s.isLost);
    const wonStage = stages.find((s) => s.isWon);
    const isSelectedWon = wonStage && selectedStage === wonStage.id;

    useEffect(() => {
        if (lead) {
            setSelectedStage(lead.stage);
            setEditForm({ name: lead.name, phone: lead.phone || "", email: lead.email || "", source: lead.source });
            setIsEditing(false);
            setSummary("");
            setTreatment("");

            setFollowUpError(false);
            setEditingLogId(null);
            setShowDeleteConfirm(false);
            setNextFollowUpAt(lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : "");
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
                    events.push({
                        id: log.id,
                        type: "call_log",
                        date: log.createdAt,
                        title: "שיחה תועדה",
                        description: log.summary !== "ללא סיכום" ? log.summary : undefined,
                        action: log.treatment !== "ללא טיפול" ? log.treatment : undefined,
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
            const data = await r.json();
            if (!r.ok && r.status !== 202) throw new Error(data.error || "שגיאה");
            return { status: r.status, data };
        },
        onSuccess: ({ status, data }) => {
            if (status === 202) {
                toast.success(data.message || "הבקשה נשלחה לאישור הבעלים");
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

    const isWorking = updateLeadMutation.isPending || closeWonMutation.isPending || closeLostMutation.isPending;

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!lead) return;

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

        await updateLeadMutation.mutateAsync({
            stage: selectedStage,
            ...(nextFollowUpAt && {
                nextFollowUpAt: new Date(nextFollowUpAt).toISOString(),
                followUpStatus,
            }),
            ...(isEditing && {
                name: editForm.name, phone: editForm.phone || null,
                email: editForm.email || null, source: editForm.source,
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

    if (!lead || !isOpen) return null;

    return (
        <>
            <div className="modal-overlay">
                <div className="modal-backdrop" onClick={onClose} />
                <div className="modal-content max-w-2xl mx-4 p-6 flex flex-col max-h-[90vh]">

                    {/* ── Header ──────────────────────────────────────────── */}
                    <div className="flex items-center justify-between mb-5 border-b border-petra-border pb-4">
                        <h2 className="text-xl font-bold text-petra-text">
                            טיפול בליד: {isEditing ? editForm.name : lead.name}
                        </h2>
                        <div className="flex items-center gap-1">
                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                    title="מחק ליד"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
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
                                        className="text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 font-medium transition-colors"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            )}
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-5 pe-1">

                        {/* ── Lead Info ────────────────────────────────────── */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            {!isEditing ? (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    {lead.phone && (
                                        <div className="flex items-center gap-1.5">
                                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:underline transition-colors">
                                                <Phone className="w-4 h-4" /> {lead.phone}
                                            </a>
                                            <a
                                                href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(lead.phone)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="שלח הודעה בוואטסאפ"
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-colors"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                וואטסאפ
                                            </a>
                                        </div>
                                    )}
                                    {lead.email && (
                                        <a
                                            href={`https://mail.google.com/mail/?view=cm&to=${lead.email}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:underline transition-colors"
                                        >
                                            <Mail className="w-4 h-4" /> {lead.email}
                                        </a>
                                    )}
                                    <div className="flex items-center gap-1.5 text-xs text-petra-muted ms-auto">
                                        <Calendar className="w-3.5 h-3.5" />
                                        נוצר: {new Date(lead.createdAt).toLocaleDateString("he-IL")}
                                    </div>
                                    <button onClick={() => setIsEditing(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2">
                                        ערוך פרטים
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-medium text-sm">עריכת פרטים</h4>
                                        <button onClick={() => setIsEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">ביטול עריכה</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { key: "name", label: "שם ליד" },
                                            { key: "phone", label: "טלפון" },
                                            { key: "email", label: "אימייל" },
                                        ].map(({ key, label }) => (
                                            <div key={key}>
                                                <label className="label text-xs">{label}</label>
                                                <input className="input text-sm h-8" value={(editForm as Record<string, string>)[key]}
                                                    onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
                                            </div>
                                        ))}
                                        <div>
                                            <label className="label text-xs">מקור</label>
                                            <select className="input text-sm h-8" value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })}>
                                                {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Stage Selector ──────────────────────────────── */}
                        {!isClosed && (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-petra-text text-sm">סטטוס הליד</h3>
                                <div className="flex flex-wrap gap-2">
                                    {stages.map((stage) => (
                                        <button
                                            key={stage.id}
                                            onClick={() => setSelectedStage(stage.id)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5",
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
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                            {stage.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Closed banner ────────────────────────────────── */}
                        {isClosed && (
                            <div className={cn(
                                "rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-semibold border",
                                lead.stage === "won"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                            )}>
                                {lead.stage === "won"
                                    ? <><CheckCircle2 className="w-4 h-4" /> ליד נסגר בהצלחה — לקוח נוצר</>
                                    : <><XCircle className="w-4 h-4" /> ליד אבוד</>
                                }
                            </div>
                        )}

                        {/* ── Call Log + Follow-up Section ─────────────────── */}
                        <div className="space-y-4 bg-brand-50/40 rounded-xl border border-brand-100 p-4">
                            <h3 className="font-semibold text-petra-text flex items-center gap-2">
                                <AlignLeft className="w-4 h-4 text-brand-500" />
                                סיכום שיחה מול הלקוח
                            </h3>
                            <div>
                                <label className="label text-xs text-slate-500">סיכום השיחה</label>
                                <textarea className="input" rows={3} value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    placeholder="מה נאמר בשיחה? לאיזה סיכום הגעתם?" />
                            </div>
                            <div>
                                <label className="label text-xs text-slate-500 flex items-center gap-1">
                                    <User className="w-3 h-3" /> להמשך טיפול (Action Items)
                                </label>
                                <textarea className="input" rows={2} value={treatment}
                                    onChange={(e) => setTreatment(e.target.value)}
                                    placeholder="מה הצעדים הבאים להמשך הטיפול בליד?" />
                            </div>

                            {/* Follow-up scheduling — required before confirming */}
                            <div id="followup-section" className={cn(
                                "rounded-xl border p-3 space-y-3 transition-colors",
                                followUpError && !nextFollowUpAt
                                    ? "bg-red-50/60 border-red-300"
                                    : "bg-amber-50/40 border-amber-200"
                            )}>
                                <div className="flex items-center gap-2">
                                    <CalendarCheck className={cn("w-4 h-4", followUpError && !nextFollowUpAt ? "text-red-500" : "text-amber-500")} />
                                    <span className="text-sm font-semibold text-petra-text">תזמון פולואפ הבא</span>
                                    <span className={cn(
                                        "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                                        followUpError && !nextFollowUpAt
                                            ? "bg-red-100 text-red-600 border-red-200"
                                            : "bg-amber-100 text-amber-600 border-amber-200"
                                    )}>
                                        חובה לפני אישור שיחה
                                    </span>
                                    {followUpError && !nextFollowUpAt && (
                                        <span className="text-xs text-red-600">— נדרש</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="label text-xs text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> תאריך ושעה *
                                        </label>
                                        <input
                                            id="followup-date-input"
                                            type="datetime-local"
                                            className={cn(
                                                "input h-9 w-full",
                                                followUpError && !nextFollowUpAt && "border-red-400 focus:ring-red-500/20"
                                            )}
                                            value={nextFollowUpAt}
                                            onChange={(e) => { setNextFollowUpAt(e.target.value); setFollowUpError(false); }}
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs text-slate-500 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> סטטוס פולואפ
                                        </label>
                                        <div className="flex bg-slate-100 p-1 rounded-lg h-9">
                                            <button type="button"
                                                className={cn("flex-1 text-xs font-medium rounded-md transition-colors",
                                                    followUpStatus === "pending" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                                onClick={() => setFollowUpStatus("pending")}>
                                                ממתין
                                            </button>
                                            <button type="button"
                                                className={cn("flex-1 text-xs font-medium rounded-md transition-colors",
                                                    followUpStatus === "completed" ? "bg-green-100 text-green-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                                onClick={() => setFollowUpStatus("completed")}>
                                                הושלם
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* ── CRM Timeline ─────────────────────────────────── */}
                        <div className="space-y-3 border-t border-slate-200 pt-5">
                            <h3 className="font-semibold text-petra-text flex items-center gap-2">
                                <History className="w-4 h-4 text-brand-500" />
                                היסטוריית התקשרות
                                <span className="text-xs font-normal text-petra-muted bg-slate-100 px-2 py-0.5 rounded-full">
                                    {timeline.length} {timeline.length === 1 ? "אירוע" : "אירועים"}
                                </span>
                            </h3>

                            {timeline.length > 0 ? (
                                <div className="relative pe-1">
                                    {timeline.map((event, idx) => (
                                        <TimelineItem
                                            key={event.id}
                                            event={event}
                                            isLast={idx === timeline.length - 1}
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
                                <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <Zap className="w-8 h-8 text-slate-300 mb-2" />
                                    <p className="text-sm text-petra-muted">אין עדיין היסטוריה</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Footer ──────────────────────────────────────────── */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-petra-border gap-3">

                        {/* Save / Close — RIGHT side (RTL start) */}
                        <div className="flex gap-2">
                            <button className="btn-secondary" onClick={onClose} disabled={isWorking}>
                                סגור
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSave}
                                disabled={isWorking}
                            >
                                {updateLeadMutation.isPending ? "שומר..." : "שמור וסגור"}
                            </button>
                        </div>

                        {/* Won / Lost — LEFT side (RTL end) */}
                        {!isClosed && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCloseWon}
                                    disabled={isWorking}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {closeWonMutation.isPending ? "סוגר..." : "נסגר"}
                                </button>
                                <button
                                    onClick={handleCloseLost}
                                    disabled={isWorking}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    <XCircle className="w-4 h-4" />
                                    {closeLostMutation.isPending ? "מסמן..." : "אבד"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lost Reason Modal */}
            <LostReasonModal
                isOpen={lostModalOpen}
                onClose={() => setLostModalOpen(false)}
                onConfirm={(reasonCode, reasonText) => closeLostMutation.mutate({ reasonCode, reasonText })}
                isPending={closeLostMutation.isPending}
            />
        </>
    );
}
