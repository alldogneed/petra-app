"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LOST_REASON_CODES, LEAD_SOURCES } from "@/lib/constants";
import {
    Phone, Mail, Calendar, User, AlignLeft, X, Clock,
    CheckCircle2, History, Check, CalendarCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    followUpStatus?: string;
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
}

export function LeadTreatmentModal({ lead, isOpen, onClose, stages }: LeadTreatmentModalProps) {
    const queryClient = useQueryClient();

    // Call log fields
    const [summary, setSummary] = useState("");
    const [treatment, setTreatment] = useState("");
    const [callLogSaved, setCallLogSaved] = useState(false);

    // Stage & status
    const [selectedStage, setSelectedStage] = useState(lead?.stage || "new");
    const [lostReason, setLostReason] = useState("");
    const [lostReasonText, setLostReasonText] = useState("");

    // Follow-up fields
    const [nextFollowUpAt, setNextFollowUpAt] = useState("");
    const [followUpStatus, setFollowUpStatus] = useState("pending");
    const [followUpSaved, setFollowUpSaved] = useState(false);

    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", source: "" });

    const lostStage = stages.find((s) => s.isLost);
    const wonStage = stages.find((s) => s.isWon);

    useEffect(() => {
        if (lead) {
            setSelectedStage(lead.stage);
            setEditForm({
                name: lead.name,
                phone: lead.phone || "",
                email: lead.email || "",
                source: lead.source,
            });
            setIsEditing(false);
            setSummary("");
            setTreatment("");
            setLostReason("");
            setLostReasonText("");
            setCallLogSaved(false);
            setFollowUpSaved(false);
            setNextFollowUpAt(lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : "");
            setFollowUpStatus(lead.followUpStatus || "pending");
        }
    }, [lead]);

    // ── Mutations ──────────────────────────────────────────────────────────

    const updateLeadMutation = useMutation({
        mutationFn: (data: any) =>
            fetch(`/api/leads/${lead!.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            }).then((r) => r.json()),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
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

    const isSelectedLost = lostStage && selectedStage === lostStage.id;
    const isSelectedWon = wonStage && selectedStage === wonStage.id;

    // ── Handlers ───────────────────────────────────────────────────────────

    /** Saves just the call log (summary + treatment) */
    const handleConfirmCallLog = async () => {
        if (!lead || (!summary.trim() && !treatment.trim())) return;
        await addCallLogMutation.mutateAsync({
            summary: summary.trim() || "ללא סיכום",
            treatment: treatment.trim() || "ללא טיפול",
        });
        setSummary("");
        setTreatment("");
        setCallLogSaved(true);
        setTimeout(() => setCallLogSaved(false), 3000);
    };

    /** Saves just the follow-up date & status */
    const handleConfirmFollowUp = async () => {
        if (!lead) return;
        await updateLeadMutation.mutateAsync({
            nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
            followUpStatus,
        });
        setFollowUpSaved(true);
        setTimeout(() => setFollowUpSaved(false), 3000);
    };

    /** Full save: stage + optional lost reason + optional edit details, then close */
    const handleSave = async () => {
        if (!lead) return;
        await updateLeadMutation.mutateAsync({
            stage: selectedStage,
            ...(isSelectedLost && {
                lostReasonCode: lostReason,
                lostReasonText: lostReasonText,
                lostAt: new Date().toISOString(),
            }),
            ...(isSelectedWon && {
                wonAt: new Date().toISOString(),
            }),
            ...(isEditing && {
                name: editForm.name,
                phone: editForm.phone || null,
                email: editForm.email || null,
                source: editForm.source,
            }),
        });
        onClose();
    };

    if (!lead || !isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-content max-w-2xl mx-4 p-6 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-6 border-b border-petra-border pb-4">
                    <h2 className="text-xl font-bold text-petra-text flex items-center gap-2">
                        טיפול בליד: {isEditing ? editForm.name : lead.name}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2">

                    {/* ── Lead Info ─────────────────────────────────────────────── */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {!isEditing ? (
                            <>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    {lead.phone && (
                                        <a
                                            href={`tel:${lead.phone}`}
                                            className="flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:text-brand-800 hover:underline transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone className="w-4 h-4" /> {lead.phone}
                                        </a>
                                    )}
                                    {lead.email && (
                                        <a
                                            href={`mailto:${lead.email}`}
                                            className="flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:text-brand-800 hover:underline transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Mail className="w-4 h-4" /> {lead.email}
                                        </a>
                                    )}
                                    <div className="flex items-center gap-1.5 text-xs text-petra-muted mr-auto">
                                        <Calendar className="w-3.5 h-3.5" />
                                        נוצר: {new Date(lead.createdAt).toLocaleDateString("he-IL")}
                                    </div>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2"
                                    >
                                        ערוך פרטים
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-medium text-sm">עריכת פרטים</h4>
                                    <button onClick={() => setIsEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">ביטול עריכה</button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="label text-xs">שם ליד</label>
                                        <input className="input text-sm h-8" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label text-xs">טלפון</label>
                                        <input className="input text-sm h-8" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label text-xs">אימייל</label>
                                        <input className="input text-sm h-8" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                    </div>
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

                    {/* ── Stage ─────────────────────────────────────────────────── */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-petra-text">סטטוס הליד</h3>
                        <div className="flex flex-wrap gap-2">
                            {stages.map((stage) => (
                                <button
                                    key={stage.id}
                                    onClick={() => setSelectedStage(stage.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2",
                                        selectedStage === stage.id
                                            ? "border-current bg-opacity-10"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    )}
                                    style={{
                                        ...(selectedStage === stage.id && {
                                            color: stage.color,
                                            backgroundColor: `${stage.color}15`,
                                            borderColor: stage.color,
                                        }),
                                    }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                    {stage.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Lost Reason ───────────────────────────────────────────── */}
                    {isSelectedLost && (
                        <div className="space-y-4 bg-red-50 p-4 rounded-xl border border-red-100">
                            <h3 className="font-semibold text-red-800">סיבת אובדן</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {LOST_REASON_CODES.map((reason) => (
                                    <button
                                        key={reason.id}
                                        onClick={() => setLostReason(reason.id)}
                                        className={cn(
                                            "px-3 py-2 rounded-lg text-sm font-medium border text-right transition-colors",
                                            lostReason === reason.id
                                                ? "bg-red-600 text-white border-red-600"
                                                : "bg-white text-slate-700 border-red-200 hover:bg-red-100"
                                        )}
                                    >
                                        {reason.label}
                                    </button>
                                ))}
                            </div>
                            {lostReason === "OTHER" && (
                                <div>
                                    <label className="label text-red-800">פירוט עזיבה</label>
                                    <input
                                        className="input border-red-200 focus:border-red-500 focus:ring-red-500/20"
                                        value={lostReasonText}
                                        onChange={(e) => setLostReasonText(e.target.value)}
                                        placeholder="פרט את סיבת העזיבה..."
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Call Log Section ──────────────────────────────────────── */}
                    <div className="space-y-4 bg-blue-50/40 rounded-xl border border-blue-100 p-4">
                        <h3 className="font-semibold text-petra-text flex items-center gap-2">
                            <AlignLeft className="w-4 h-4 text-blue-500" />
                            סיכום שיחה מול הלקוח
                        </h3>
                        <div>
                            <label className="label text-xs text-slate-500">סיכום השיחה</label>
                            <textarea
                                className="input"
                                rows={3}
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="מה נאמר בשיחה? לאיזה סיכום הגעתם?"
                            />
                        </div>
                        <div>
                            <label className="label text-xs text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3" /> להמשך טיפול (Action Items)
                            </label>
                            <textarea
                                className="input"
                                rows={2}
                                value={treatment}
                                onChange={(e) => setTreatment(e.target.value)}
                                placeholder="מה הצעדים הבאים להמשך הטיפול בליד?"
                            />
                        </div>

                        {/* ✅ Confirm call log button */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            {callLogSaved && (
                                <span className="flex items-center gap-1 text-sm text-green-600 font-medium animate-in fade-in">
                                    <Check className="w-4 h-4" /> נשמר!
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleConfirmCallLog}
                                disabled={addCallLogMutation.isPending || (!summary.trim() && !treatment.trim())}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {addCallLogMutation.isPending ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                אשר וסיים שיחה
                            </button>
                        </div>
                    </div>

                    {/* ── Follow-up Section ─────────────────────────────────────── */}
                    <div className="space-y-4 bg-amber-50/40 rounded-xl border border-amber-100 p-4">
                        <h3 className="font-semibold text-petra-text flex items-center gap-2">
                            <CalendarCheck className="w-4 h-4 text-amber-500" />
                            תזמון פולואפ הבא
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> תאריך ושעת פולואפ
                                </label>
                                <input
                                    type="datetime-local"
                                    className="input h-10 w-full"
                                    value={nextFollowUpAt}
                                    onChange={(e) => setNextFollowUpAt(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label text-xs text-slate-500 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> סטטוס פולואפ
                                </label>
                                <div className="flex bg-slate-100 p-1 rounded-lg h-10">
                                    <button
                                        type="button"
                                        className={cn(
                                            "flex-1 text-sm font-medium rounded-md transition-colors",
                                            followUpStatus === "pending"
                                                ? "bg-white text-brand-600 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                        onClick={() => setFollowUpStatus("pending")}
                                    >
                                        ממתין
                                    </button>
                                    <button
                                        type="button"
                                        className={cn(
                                            "flex-1 text-sm font-medium rounded-md transition-colors",
                                            followUpStatus === "completed"
                                                ? "bg-green-100 text-green-700 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                        onClick={() => setFollowUpStatus("completed")}
                                    >
                                        הושלם
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ✅ Confirm follow-up button */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            {followUpSaved && (
                                <span className="flex items-center gap-1 text-sm text-green-600 font-medium animate-in fade-in">
                                    <Check className="w-4 h-4" /> תזמון נשמר!
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleConfirmFollowUp}
                                disabled={updateLeadMutation.isPending || !nextFollowUpAt}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {updateLeadMutation.isPending ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <CalendarCheck className="w-4 h-4" />
                                )}
                                אשר תזמון פולואפ
                            </button>
                        </div>
                    </div>

                    {/* ── History ───────────────────────────────────────────────── */}
                    <div className="space-y-3 border-t border-slate-200 pt-4">
                        <h3 className="font-semibold text-petra-text flex items-center gap-2">
                            <History className="w-4 h-4 text-brand-500" />
                            היסטוריית שיחות והתכתבויות
                            {lead.callLogs && lead.callLogs.length > 0 && (
                                <span className="text-xs font-normal text-petra-muted bg-slate-100 px-2 py-0.5 rounded-full">
                                    {lead.callLogs.length} רשומות
                                </span>
                            )}
                        </h3>
                        {lead.callLogs && lead.callLogs.length > 0 ? (
                            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                                {lead.callLogs
                                    .slice()
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((log) => (
                                        <div key={log.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm relative">
                                            <div className="absolute top-3 left-3 text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(log.createdAt).toLocaleString("he-IL", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                            <div className="space-y-2 mt-1">
                                                <div>
                                                    <span className="text-xs font-semibold text-petra-muted block mb-0.5">סיכום שיחה:</span>
                                                    <p className="text-sm text-petra-text whitespace-pre-wrap">{log.summary}</p>
                                                </div>
                                                {log.treatment && log.treatment !== "ללא טיפול" && (
                                                    <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                                                        <span className="text-[11px] font-semibold text-amber-700 block mb-0.5">צעדים להמשך (Action Items):</span>
                                                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{log.treatment}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <History className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-sm text-petra-muted">אין עדיין היסטוריית שיחות</p>
                                <p className="text-xs text-slate-400 mt-1">הוסף סיכום שיחה ולחץ ״אשר וסיים שיחה״</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer: stage save ─────────────────────────────────────── */}
                <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-petra-border">
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={updateLeadMutation.isPending}
                    >
                        סגור
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={
                            updateLeadMutation.isPending ||
                            (isSelectedLost && !lostReason)
                        }
                    >
                        {updateLeadMutation.isPending ? "שומר..." : "שמור סטטוס וסגור"}
                    </button>
                </div>
            </div>
        </div>
    );
}
