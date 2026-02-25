"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LOST_REASON_CODES, LEAD_SOURCES } from "@/lib/constants";
import { Phone, Mail, Calendar, User, AlignLeft, X } from "lucide-react";
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
    const [summary, setSummary] = useState("");
    const [treatment, setTreatment] = useState("");
    const [selectedStage, setSelectedStage] = useState(lead?.stage || "new");
    const [lostReason, setLostReason] = useState("");
    const [lostReasonText, setLostReasonText] = useState("");

    // New states for editing
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
        }
    }, [lead]);

    const updateLeadMutation = useMutation({
        mutationFn: (data: any) =>
            fetch(`/api/leads/${lead!.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            }).then((r) => r.json()),
    });

    const addCallLogMutation = useMutation({
        mutationFn: (data: { summary: string; treatment: string }) =>
            fetch(`/api/leads/${lead!.id}/logs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            }).then((r) => r.json()),
    });

    const isSelectedLost = lostStage && selectedStage === lostStage.id;
    const isSelectedWon = wonStage && selectedStage === wonStage.id;

    const handleSave = async () => {
        if (!lead) return;

        // Save call log if there is any content
        if (summary.trim() || treatment.trim()) {
            await addCallLogMutation.mutateAsync({
                summary: summary || "ללא סיכום",
                treatment: treatment || "ללא טיפול",
            });
        }

        // Update lead details and status
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
            })
        });

        queryClient.invalidateQueries({ queryKey: ["leads"] });
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
                    {/* Lead Information */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="absolute top-4 left-4 text-xs font-medium text-brand-600 hover:text-brand-700"
                                >
                                    ערוך פרטים
                                </button>
                                <div className="flex flex-wrap gap-4 mt-2">
                                    {lead.phone && (
                                        <div className="flex items-center gap-2 text-sm text-petra-text font-medium">
                                            <Phone className="w-4 h-4 text-petra-muted" /> {lead.phone}
                                        </div>
                                    )}
                                    {lead.email && (
                                        <div className="flex items-center gap-2 text-sm text-petra-text font-medium">
                                            <Mail className="w-4 h-4 text-petra-muted" /> {lead.email}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-petra-text font-medium mr-auto">
                                        <Calendar className="w-4 h-4 text-petra-muted" />
                                        נוצר: {new Date(lead.createdAt).toLocaleDateString("he-IL")}
                                    </div>
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

                    {/* Change Stage */}
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

                    {/* Lost Reason (only visible if selected stage is the lost stage) */}
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

                    {/* Follow up Notes */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-petra-text">מעקב פולואפ</h3>
                        <div>
                            <label className="label font-semibold flex items-center gap-2">
                                <AlignLeft className="w-4 h-4 text-petra-muted" /> סיכום שיחה מול הלקוח
                            </label>
                            <textarea
                                className="input"
                                rows={3}
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="מה נאמר בשיחה? לאיזה סיכום הגעתם?"
                            />
                        </div>
                        <div>
                            <label className="label font-semibold flex items-center gap-2">
                                <User className="w-4 h-4 text-petra-muted" /> להמשך טיפול (Action Items)
                            </label>
                            <textarea
                                className="input"
                                rows={3}
                                value={treatment}
                                onChange={(e) => setTreatment(e.target.value)}
                                placeholder="מה הצעדים הבאים להמשך הטיפול בליד?"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-petra-border">
                    <button className="btn-secondary" onClick={onClose} disabled={updateLeadMutation.isPending || addCallLogMutation.isPending}>
                        ביטול
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={
                            updateLeadMutation.isPending ||
                            addCallLogMutation.isPending ||
                            (isSelectedLost && !lostReason)
                        }
                    >
                        {(updateLeadMutation.isPending || addCallLogMutation.isPending) ? "שומר..." : "שמור ועדכן"}
                    </button>
                </div>
            </div>
        </div>
    );
}
