"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserCheck, ChevronLeft, Phone, Mail, MapPin, CreditCard,
  Dog, Calendar, Plus, X, Pencil, Trash2, FileText, Clock,
  CheckCircle2, AlertCircle, ExternalLink, ArrowRight,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  RECIPIENT_STATUS_MAP, RECIPIENT_STATUSES, DISABILITY_TYPES, DISABILITY_TYPE_MAP,
  PLACEMENT_STATUS_MAP, SERVICE_DOG_PHASE_MAP, RECIPIENT_FUNDING_SOURCES, FUNDING_SOURCE_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";

// ─── Types ───

interface Meeting {
  id: string;
  date: string;
  type: string;
  trainerName: string;
  duration: number | null; // minutes
  notes: string;
  status: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  docType: string;
  uploadedAt: string;
}

interface Placement {
  id: string;
  status: string;
  placementDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  nextCheckInAt: string | null;
  notes: string | null;
  serviceDog: {
    id: string;
    phase: string;
    pet: { name: string; breed: string | null };
  };
}

interface RecipientDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  disabilityType: string | null;
  disabilityNotes: string | null;
  fundingSource: string | null;
  waitlistDate: string | null;
  notes: string | null;
  status: string;
  attachments: Attachment[];
  meetings: Meeting[];
  placements: Placement[];
}

const MEETING_TYPES = [
  { id: "ASSESSMENT", label: "הערכה ראשונית" },
  { id: "INITIAL_TRAINING", label: "הדרכה ראשונית" },
  { id: "RECIPIENT_TRAINING", label: "אימון עם זכאי" },
  { id: "COMPATIBILITY_CHECK", label: "בדיקת התאמה" },
  { id: "FOLLOW_UP", label: "מעקב" },
  { id: "ANNUAL_REVIEW", label: "בדיקה שנתית" },
  { id: "OTHER", label: "אחר" },
];
const MEETING_TYPE_MAP = Object.fromEntries(MEETING_TYPES.map((t) => [t.id, t.label]));

const MEETING_STATUSES = [
  { id: "SCHEDULED", label: "מתוכנן", color: "bg-blue-100 text-blue-700" },
  { id: "COMPLETED", label: "הושלם", color: "bg-emerald-100 text-emerald-700" },
  { id: "CANCELLED", label: "בוטל", color: "bg-slate-100 text-slate-500" },
];
const MEETING_STATUS_MAP = Object.fromEntries(MEETING_STATUSES.map((s) => [s.id, s]));

const DOC_TYPES = [
  { id: "MEDICAL_CERT", label: "אישור רפואי" },
  { id: "ID_COPY", label: "צילום ת.ז." },
  { id: "REFERRAL", label: "הפנייה" },
  { id: "TRAINING_AGREEMENT", label: "הסכם אימון" },
  { id: "INSURANCE", label: "ביטוח" },
  { id: "OTHER", label: "אחר" },
];
const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPES.map((d) => [d.id, d.label]));

type Tab = "details" | "documents" | "meetings";

// ─── Main Page ───

export default function RecipientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const queryClient = useQueryClient();

  const { data: recipient, isLoading, isError } = useQuery<RecipientDetail>({
    queryKey: ["service-recipient", id],
    queryFn: () => fetch(`/api/service-recipients/${id}`).then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
  });

  const patchMutation = useMutation({
    mutationFn: (data: Partial<RecipientDetail>) =>
      fetch(`/api/service-recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-recipient", id] });
      queryClient.invalidateQueries({ queryKey: ["service-recipients"] });
      toast.success("פרטים עודכנו");
      setEditMode(false);
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const saveMeeting = (meeting: Meeting) => {
    if (!recipient) return;
    const meetings = [...(recipient.meetings || [])];
    const idx = meetings.findIndex((m) => m.id === meeting.id);
    if (idx >= 0) meetings[idx] = meeting;
    else meetings.unshift(meeting);
    patchMutation.mutate({ meetings });
    setShowAddMeeting(false);
    setEditingMeeting(null);
  };

  const deleteMeeting = (meetingId: string) => {
    if (!recipient) return;
    if (!confirm("למחוק את המפגש?")) return;
    const meetings = recipient.meetings.filter((m) => m.id !== meetingId);
    patchMutation.mutate({ meetings });
  };

  const saveAttachment = (att: Attachment) => {
    if (!recipient) return;
    const attachments = [att, ...(recipient.attachments || [])];
    patchMutation.mutate({ attachments });
    setShowAddDoc(false);
  };

  const deleteAttachment = (attId: string) => {
    if (!recipient) return;
    if (!confirm("למחוק את המסמך?")) return;
    const attachments = recipient.attachments.filter((a) => a.id !== attId);
    patchMutation.mutate({ attachments });
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="card animate-pulse h-32" />
        <div className="card animate-pulse h-64" />
      </div>
    );
  }

  if (isError || !recipient) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-petra-muted">זכאי לא נמצא</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">חזרה</button>
      </div>
    );
  }

  const statusInfo = RECIPIENT_STATUS_MAP[recipient.status];
  const activePlacement = recipient.placements?.find((p) =>
    ["ACTIVE", "TRIAL"].includes(p.status)
  );

  const tabs = [
    { id: "details" as Tab, label: "פרטים", icon: UserCheck },
    { id: "documents" as Tab, label: "מסמכים", icon: FileText, badge: recipient.attachments?.length || 0 },
    { id: "meetings" as Tab, label: "מפגשים", icon: Calendar, badge: recipient.meetings?.length || 0 },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-petra-muted">
        <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <Link href="/service-dogs/recipients" className="hover:text-foreground">זכאים</Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="text-petra-text font-medium">{recipient.name}</span>
      </div>

      {/* Profile Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
              <UserCheck className="w-7 h-7 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{recipient.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusInfo?.color)}>
                  {statusInfo?.label || recipient.status}
                </span>
                {recipient.disabilityType && (
                  <span className="text-sm text-petra-muted">
                    · {DISABILITY_TYPE_MAP[recipient.disabilityType]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-petra-muted">
                {recipient.phone && (
                  <a href={`tel:${recipient.phone}`} className="flex items-center gap-1 hover:text-brand-500">
                    <Phone className="w-3.5 h-3.5" />
                    {recipient.phone}
                  </a>
                )}
                {recipient.email && (
                  <a href={`mailto:${recipient.email}`} className="flex items-center gap-1 hover:text-brand-500">
                    <Mail className="w-3.5 h-3.5" />
                    {recipient.email}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activePlacement && (
              <Link
                href={`/service-dogs/${activePlacement.serviceDog.id}`}
                className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Dog className="w-4 h-4" />
                <span>{activePlacement.serviceDog.pet.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              onClick={() => setEditMode(true)}
              className="btn-ghost flex items-center gap-1.5 text-sm"
            >
              <Pencil className="w-4 h-4" />
              עריכה
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white shadow-sm text-petra-text"
                  : "text-petra-muted hover:bg-white/60"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Details */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Contact + Info */}
          <div className="space-y-4 lg:col-span-2">
            {/* Contact Info */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-500" />
                פרטי קשר
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "שם מלא", value: recipient.name },
                  { label: "מקור מימון", value: recipient.fundingSource ? (FUNDING_SOURCE_MAP[recipient.fundingSource] || recipient.fundingSource) : null },
                  { label: "טלפון", value: recipient.phone, href: recipient.phone ? `tel:${recipient.phone}` : undefined },
                  { label: "אימייל", value: recipient.email, href: recipient.email ? `mailto:${recipient.email}` : undefined },
                  { label: "תעודת זהות", value: recipient.idNumber },
                  { label: "כתובת", value: recipient.address },
                  { label: "תאריך רשימת המתנה", value: recipient.waitlistDate ? formatDate(recipient.waitlistDate) : null },
                ].filter((r) => r.value).map((row) => (
                  <div key={row.label} className="py-2 border-b last:border-0">
                    <p className="text-xs text-petra-muted mb-0.5">{row.label}</p>
                    {row.href ? (
                      <a href={row.href} className="text-sm font-medium text-brand-500 hover:underline">
                        {row.value}
                      </a>
                    ) : (
                      <p className="text-sm font-medium">{row.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Disability Info */}
            {(recipient.disabilityType || recipient.disabilityNotes) && (
              <div className="card p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  מידע על הלקות
                </h3>
                {recipient.disabilityType && (
                  <div className="py-2 border-b">
                    <p className="text-xs text-petra-muted mb-0.5">סוג לקות</p>
                    <p className="text-sm font-medium">{DISABILITY_TYPE_MAP[recipient.disabilityType]}</p>
                  </div>
                )}
                {recipient.disabilityNotes && (
                  <p className="text-sm text-petra-text mt-2">{recipient.disabilityNotes}</p>
                )}
              </div>
            )}

            {/* Notes */}
            {recipient.notes && (
              <div className="card p-5">
                <h3 className="font-semibold mb-2 text-sm text-petra-muted">הערות</h3>
                <p className="text-sm text-petra-text whitespace-pre-wrap">{recipient.notes}</p>
              </div>
            )}
          </div>

          {/* Right: Placements */}
          <div>
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Dog className="w-4 h-4 text-brand-500" />
                שיבוצים ({recipient.placements?.length || 0})
              </h3>
              {recipient.placements?.length === 0 ? (
                <p className="text-sm text-petra-muted text-center py-4">אין שיבוצים עדיין</p>
              ) : (
                <div className="space-y-3">
                  {recipient.placements?.map((p) => {
                    const ps = PLACEMENT_STATUS_MAP[p.status];
                    return (
                      <div key={p.id} className="rounded-xl border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/service-dogs/${p.serviceDog.id}`}
                            className="font-medium text-sm hover:text-brand-500 flex items-center gap-1.5"
                          >
                            <Dog className="w-3.5 h-3.5 text-petra-muted" />
                            {p.serviceDog.pet.name}
                          </Link>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", ps?.color)}>
                            {ps?.label || p.status}
                          </span>
                        </div>
                        <p className="text-xs text-petra-muted">
                          {SERVICE_DOG_PHASE_MAP[p.serviceDog.phase]?.label}
                          {p.placementDate && ` · ${formatDate(p.placementDate)}`}
                        </p>
                        {p.nextCheckInAt && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            בדיקה: {formatDate(p.nextCheckInAt)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === "documents" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" />
              מסמכים ({recipient.attachments?.length || 0})
            </h3>
          </div>
          <div className="space-y-3">
            {(recipient.attachments || []).map((att) => (
              <div key={att.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/50 group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{att.name}</p>
                    <p className="text-xs text-petra-muted">
                      {DOC_TYPE_MAP[att.docType] || att.docType}
                      {att.uploadedAt && ` · ${formatDate(att.uploadedAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {att.url && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded flex items-center justify-center hover:bg-brand-50 transition-colors"
                      title="פתח מסמך"
                    >
                      <ExternalLink className="w-4 h-4 text-brand-500" />
                    </a>
                  )}
                  <button
                    onClick={() => deleteAttachment(att.id)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                    title="מחק"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowAddDoc(true)}
              className="w-full text-sm text-brand-500 hover:text-brand-600 py-2.5 border border-dashed border-brand-200 hover:border-brand-300 rounded-xl transition-colors"
            >
              + הוסף מסמך
            </button>
          </div>
        </div>
      )}

      {/* Tab: Meetings */}
      {activeTab === "meetings" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-500" />
              מפגשים ותיאומים ({recipient.meetings?.length || 0})
            </h3>
          </div>
          <div className="space-y-3">
            {(recipient.meetings || []).map((meeting) => {
              const ms = MEETING_STATUS_MAP[meeting.status];
              return (
                <div key={meeting.id} className="p-4 rounded-xl border bg-slate-50/50 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">
                          {MEETING_TYPE_MAP[meeting.type] || meeting.type}
                        </span>
                        {ms && (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", ms.color)}>
                            {ms.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-petra-muted">
                        {meeting.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(meeting.date)}
                          </span>
                        )}
                        {meeting.trainerName && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {meeting.trainerName}
                          </span>
                        )}
                        {meeting.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {meeting.duration} דקות
                          </span>
                        )}
                      </div>
                      {meeting.notes && (
                        <p className="text-sm text-petra-text mt-1">{meeting.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingMeeting(meeting)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center hover:bg-brand-50 transition-all"
                        title="ערוך"
                      >
                        <Pencil className="w-3.5 h-3.5 text-brand-500" />
                      </button>
                      <button
                        onClick={() => deleteMeeting(meeting.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                        title="מחק"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setShowAddMeeting(true)}
              className="w-full text-sm text-brand-500 hover:text-brand-600 py-2.5 border border-dashed border-brand-200 hover:border-brand-300 rounded-xl transition-colors"
            >
              + הוסף מפגש
            </button>
          </div>
        </div>
      )}

      {/* Edit Recipient Modal */}
      {editMode && (
        <EditRecipientModal
          recipient={recipient}
          onSave={(data) => patchMutation.mutate(data)}
          onClose={() => setEditMode(false)}
          isSaving={patchMutation.isPending}
        />
      )}

      {/* Add/Edit Meeting Modal */}
      {(showAddMeeting || editingMeeting) && (
        <MeetingModal
          meeting={editingMeeting}
          onSave={saveMeeting}
          onClose={() => { setShowAddMeeting(false); setEditingMeeting(null); }}
        />
      )}

      {/* Add Document Modal */}
      {showAddDoc && (
        <AddDocModal
          onSave={saveAttachment}
          onClose={() => setShowAddDoc(false)}
        />
      )}
    </div>
  );
}

// ─── Edit Recipient Modal ───

function EditRecipientModal({
  recipient, onSave, onClose, isSaving,
}: {
  recipient: RecipientDetail;
  onSave: (data: Record<string, string | null>) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(recipient.name);
  const [phone, setPhone] = useState(recipient.phone || "");
  const [email, setEmail] = useState(recipient.email || "");
  const [idNumber, setIdNumber] = useState(recipient.idNumber || "");
  const [address, setAddress] = useState(recipient.address || "");
  const [disabilityType, setDisabilityType] = useState(recipient.disabilityType || "");
  const [disabilityNotes, setDisabilityNotes] = useState(recipient.disabilityNotes || "");
  const [fundingSource, setFundingSource] = useState(recipient.fundingSource || "");
  const [notes, setNotes] = useState(recipient.notes || "");
  const [status, setStatus] = useState(recipient.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">עריכת פרטי זכאי</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label">שם מלא *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תעודת זהות</label>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">סטטוס</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-full">
                {RECIPIENT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג לקות</label>
              <select value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)} className="input w-full">
                <option value="">לא נבחר</option>
                {DISABILITY_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">מקור מימון</label>
              <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} className="input w-full">
                <option value="">לא נבחר</option>
                {RECIPIENT_FUNDING_SOURCES.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">פרטים על הלקות</label>
            <textarea value={disabilityNotes} onChange={(e) => setDisabilityNotes(e.target.value)} className="input w-full" rows={2} />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={3} />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <button
            onClick={() => onSave({ name, phone, email, idNumber, address, disabilityType, disabilityNotes, fundingSource, notes, status })}
            disabled={!name || isSaving}
            className="btn-primary flex-1"
          >
            {isSaving ? "שומר..." : "שמור שינויים"}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting Modal ───

function MeetingModal({
  meeting, onSave, onClose,
}: {
  meeting: Meeting | null;
  onSave: (m: Meeting) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState(meeting?.type || "FOLLOW_UP");
  const [date, setDate] = useState(meeting?.date ? meeting.date.split("T")[0] : new Date().toISOString().split("T")[0]);
  const [trainerName, setTrainerName] = useState(meeting?.trainerName || "");
  const [duration, setDuration] = useState(meeting?.duration?.toString() || "");
  const [notes, setNotes] = useState(meeting?.notes || "");
  const [status, setStatus] = useState(meeting?.status || "COMPLETED");

  const handleSave = () => {
    onSave({
      id: meeting?.id || crypto.randomUUID(),
      type,
      date,
      trainerName,
      duration: duration ? parseInt(duration) : null,
      notes,
      status,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{meeting ? "עריכת מפגש" : "הוספת מפגש"}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג מפגש</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input w-full">
                {MEETING_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">סטטוס</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-full">
                {MEETING_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">משך (דקות)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="input w-full" placeholder="60" />
            </div>
          </div>
          <div>
            <label className="label">שם המאמן</label>
            <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="input w-full" placeholder="שם מאמן כלבי השירות" />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={3} placeholder="סיכום המפגש, תוצאות, משימות המשך..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="btn-primary flex-1">
              {meeting ? "שמור" : "הוסף מפגש"}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Document Modal ───

function AddDocModal({
  onSave, onClose,
}: {
  onSave: (att: Attachment) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [docType, setDocType] = useState("OTHER");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      url: url.trim(),
      docType,
      uploadedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">הוספת מסמך</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם המסמך *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="לדוג׳ אישור רפואי 2025" />
          </div>
          <div>
            <label className="label">סוג מסמך</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-full">
              {DOC_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={!name.trim()} className="btn-primary flex-1">הוסף מסמך</button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}
