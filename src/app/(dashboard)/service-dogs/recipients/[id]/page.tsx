"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserCheck, ChevronLeft, Phone, Mail, MapPin, CreditCard,
  Dog, Calendar, Plus, X, Pencil, Trash2, Copy, FileText, Clock,
  CheckCircle2, AlertCircle, ExternalLink, ArrowRight,
  Link2, Printer, Search, Upload, Users, Smartphone, Package,
  ClipboardList, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import {
  RECIPIENT_STATUS_MAP, DISABILITY_TYPE_MAP,
  PLACEMENT_STATUS_MAP, SERVICE_DOG_PHASE_MAP, RECIPIENT_FUNDING_SOURCES, FUNDING_SOURCE_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";
import { TierGate } from "@/components/paywall/TierGate";
import { PetraLoader } from "@/components/ui/PetraLoader";

// ─── Types ───

interface Meeting {
  id: string;
  date: string;
  type: string;
  trainerName: string;
  duration: number | null;
  notes: string;
  status: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  docType: string;
  uploadedAt: string;
  isFile?: boolean;
  fileName?: string;
  fileSize?: number;
  contactPersonId?: string;
}

interface ContactPerson {
  id: string;
  name: string;
  role: string;
  phone: string;
}

interface Placement {
  id: string;
  status: string;
  placementDate: string | null;
  certifiedAt: string | null;
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
  mobile: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  disabilityType: string | null;
  disabilityNotes: string | null;
  fundingSource: string | null;
  waitlistDate: string | null;
  intakeDate: string | null;
  approvedAt: string | null;
  handoverDate: string | null;
  notes: string | null;
  photoConsent: boolean;
  crisisInstructions: string | null;
  status: string;
  customerId: string | null;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  attachments: Attachment[];
  meetings: Meeting[];
  contactPersons: ContactPerson[];
  placements: Placement[];
}

type RecipientT = ReturnType<typeof useTranslations<"serviceDogs.recipientsDetailPage">>;

const MEETING_TYPES = [
  { id: "ASSESSMENT" },
  { id: "INITIAL_TRAINING" },
  { id: "RECIPIENT_TRAINING" },
  { id: "COMPATIBILITY_CHECK" },
  { id: "FOLLOW_UP" },
  { id: "ANNUAL_REVIEW" },
  { id: "GROUP_TRAINING" },
  { id: "OTHER" },
];

/** Meeting type id → label (unknown ids are shown as stored). */
function meetingTypeLabel(t: RecipientT, type: string): string {
  return t.has(`meetingTypes.${type}`) ? t(`meetingTypes.${type}`) : type;
}

const MEETING_STATUSES = [
  { id: "SCHEDULED", color: "bg-blue-100 text-blue-700" },
  { id: "COMPLETED", color: "bg-emerald-100 text-emerald-700" },
  { id: "CANCELLED", color: "bg-slate-100 text-slate-500" },
];
const MEETING_STATUS_MAP = Object.fromEntries(MEETING_STATUSES.map((s) => [s.id, s]));

const DOC_TYPES = [
  { id: "INTAKE_DOCS" },
  { id: "HANDOVER_DOCS" },
  { id: "PHOTOS" },
  { id: "CONTACT_NOTE" },
  { id: "OTHER" },
];

// `value` is stored as-is in the recipient's contactPersons JSON (data) — only the label is translated.
const CONTACT_PERSON_ROLES = [
  { value: "קרוב משפחה", key: "relative" }, // i18n-ok
  { value: "גורם מטפל", key: "caregiver" }, // i18n-ok
  { value: 'עו"ס', key: "socialWorker" }, // i18n-ok
  { value: "רופא", key: "doctor" }, // i18n-ok
  { value: "מטפל", key: "therapist" }, // i18n-ok
  { value: "אחר", key: "other" }, // i18n-ok
];

/** Stored contact role → label (free-text / unknown roles are shown as stored). */
function contactRoleLabel(t: RecipientT, role: string): string {
  const r = CONTACT_PERSON_ROLES.find((x) => x.value === role);
  return r ? t(`contactRoles.${r.key}`) : role;
}

type Tab = "details" | "documents" | "meetings" | "guidelines";

// ─── Safe JSON array helper ───
function safeJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p as T[] : []; } catch { return []; }
  }
  return [];
}

// ─── Main Page ───

function RecipientDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const fmtDate = (d: string) => formatDate(d, { locale });
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [addDocDefaultType, setAddDocDefaultType] = useState("OTHER");
  const [editMode, setEditMode] = useState(false);
  const [showLinkCustomer, setShowLinkCustomer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactPerson | null>(null);
  const [uploadingForContact, setUploadingForContact] = useState<string | null>(null);
  const [copyingMeeting, setCopyingMeeting] = useState<Meeting | null>(null);

  const queryClient = useQueryClient();

  const { data: recipient, isLoading, isError } = useQuery<RecipientDetail>({
    queryKey: ["service-recipient", id],
    queryFn: () => fetch(`/api/service-recipients/${id}`).then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
  });

  const { data: stages = [] } = useQuery<Array<{ id: string; key: string; name: string; color: string }>>({
    queryKey: ["recipient-stages"],
    queryFn: () => fetch("/api/service-recipient-stages").then((r) => r.json()),
    staleTime: 60_000,
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-recipients/${id}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_RECIPIENT_${id}` },
      }).then(async (r) => {
        const data = await r.json();
        if (r.status === 202) { toast.success(t("toasts.deleteSentForApproval")); return data; }
        if (!r.ok) throw new Error(data.error || t("toasts.error"));
        return data;
      }),
    onSuccess: (data) => {
      if (!data.pendingApproval) {
        toast.success(t("toasts.deleted"));
        router.push("/service-dogs/recipients");
      }
      setShowDeleteConfirm(false);
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.deleteError")),
  });

  const patchMutation = useMutation({
    mutationFn: (data: Partial<RecipientDetail> & Record<string, unknown>) =>
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
      toast.success(t("toasts.updated"));
      setEditMode(false);
    },
    onError: () => toast.error(t("toasts.updateError")),
  });

  const saveMeeting = (meeting: Meeting) => {
    if (!recipient) return;
    const meetings = [...safeJsonArray<Meeting>(recipient.meetings)];
    const idx = meetings.findIndex((m) => m.id === meeting.id);
    if (idx >= 0) meetings[idx] = meeting;
    else meetings.unshift(meeting);
    patchMutation.mutate({ meetings });
    setShowAddMeeting(false);
    setEditingMeeting(null);
  };

  const deleteMeeting = (meetingId: string) => {
    if (!recipient) return;
    if (!confirm(t("confirms.deleteMeeting"))) return;
    const meetings = safeJsonArray<Meeting>(recipient.meetings).filter((m) => m.id !== meetingId);
    patchMutation.mutate({ meetings });
  };

  const deleteAttachment = (attId: string) => {
    if (!recipient) return;
    if (!confirm(t("confirms.deleteDocument"))) return;
    const attachments = safeJsonArray<Attachment>(recipient.attachments).filter((a) => a.id !== attId);
    patchMutation.mutate({ attachments });
  };

  const renameAttachment = (attId: string, currentName: string) => {
    if (!recipient) return;
    const next = window.prompt(t("confirms.documentNamePrompt"), currentName);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentName) return;
    const attachments = safeJsonArray<Attachment>(recipient.attachments).map((a) =>
      a.id === attId ? { ...a, name: trimmed } : a
    );
    patchMutation.mutate({ attachments });
  };

  const saveContactPerson = (cp: ContactPerson) => {
    if (!recipient) return;
    const contactPersons = [...safeJsonArray<ContactPerson>(recipient.contactPersons)];
    const idx = contactPersons.findIndex((c) => c.id === cp.id);
    if (idx >= 0) contactPersons[idx] = cp;
    else contactPersons.push(cp);
    patchMutation.mutate({ contactPersons });
    setShowAddContact(false);
    setEditingContact(null);
  };

  const deleteContactPerson = (cpId: string) => {
    if (!recipient) return;
    if (!confirm(t("confirms.deleteContactPerson"))) return;
    const contactPersons = safeJsonArray<ContactPerson>(recipient.contactPersons).filter((c) => c.id !== cpId);
    const attachments = safeJsonArray<Attachment>(recipient.attachments).filter((a) => a.contactPersonId !== cpId);
    patchMutation.mutate({ contactPersons, attachments });
  };

  if (isLoading) {
    return <PetraLoader />;
  }

  if (isError || !recipient) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-petra-muted">{t("notFound.message")}</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">{t("notFound.back")}</button>
      </div>
    );
  }

  const statusInfo = RECIPIENT_STATUS_MAP[recipient.status];
  const activePlacement = recipient.placements?.find((p) =>
    p.status === "ACTIVE"
  );
  const attachmentsArray = safeJsonArray<Attachment>(recipient.attachments);
  const meetingsArray = safeJsonArray<Meeting>(recipient.meetings);
  const contactPersonsArray = safeJsonArray<ContactPerson>(recipient.contactPersons);
  const mainDocs = attachmentsArray.filter((a) => !a.contactPersonId);
  const handoverDocs = mainDocs.filter((a) => a.docType === "HANDOVER_DOCS");

  const tabs = [
    { id: "details" as Tab, label: t("tabs.details"), icon: UserCheck },
    { id: "documents" as Tab, label: t("tabs.documents"), icon: FileText, badge: mainDocs.length },
    { id: "meetings" as Tab, label: t("tabs.meetings"), icon: Calendar, badge: meetingsArray.length },
    { id: "guidelines" as Tab, label: t("tabs.guidelines"), icon: ClipboardList },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-petra-muted">
        <Link href="/service-dogs" className="hover:text-foreground">{t("breadcrumb.serviceDogs")}</Link>
        <ChevronLeft className="w-3.5 h-3.5 ltr:-scale-x-100" />
        <Link href="/service-dogs/recipients" className="hover:text-foreground">{t("breadcrumb.recipients")}</Link>
        <ChevronLeft className="w-3.5 h-3.5 ltr:-scale-x-100" />
        <span className="text-petra-text font-medium">{recipient.name}</span>
      </div>

      {/* Profile Header */}
      <div className="card p-5">
        <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
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
                {recipient.mobile && (
                  <a href={`tel:${recipient.mobile}`} className="flex items-center gap-1 hover:text-brand-500">
                    <Smartphone className="w-3.5 h-3.5" />
                    {recipient.mobile}
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
          <div className="flex items-center gap-2 sm:shrink-0 flex-wrap">
            {activePlacement && (
              <Link
                href={`/service-dogs/${activePlacement.serviceDog.id}`}
                className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Dog className="w-4 h-4" />
                <span>{activePlacement.serviceDog.pet.name}</span>
                <ArrowRight className="w-3.5 h-3.5 ltr:-scale-x-100" />
              </Link>
            )}
            {recipient.customer ? (
              <Link
                href={`/customers/${recipient.customer.id}`}
                className="flex items-center gap-2 text-sm bg-brand-50 text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                {recipient.customer.name}
              </Link>
            ) : (
              <button
                onClick={() => setShowLinkCustomer(true)}
                className="btn-ghost flex items-center gap-1.5 text-sm"
              >
                <Link2 className="w-4 h-4" />
                {t("header.linkCustomer")}
              </button>
            )}
            <button
              onClick={() => setShowReport(true)}
              className="btn-ghost flex items-center gap-1.5 text-sm"
            >
              <Printer className="w-4 h-4" />
              {t("header.report")}
            </button>
            <button
              onClick={() => setEditMode(true)}
              className="btn-ghost flex items-center gap-1.5 text-sm"
            >
              <Pencil className="w-4 h-4" />
              {tc("actions.edit")}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-ghost flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              {tc("actions.delete")}
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
                {t("details.contactInfo")}
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: t("fields.fullName"), value: recipient.name },
                  { label: t("fields.fundingSource"), value: recipient.fundingSource ? (FUNDING_SOURCE_MAP[recipient.fundingSource] || recipient.fundingSource) : null },
                  { label: t("fields.phone"), value: recipient.phone, href: recipient.phone ? `tel:${recipient.phone}` : undefined },
                  { label: t("fields.mobile"), value: recipient.mobile, href: recipient.mobile ? `tel:${recipient.mobile}` : undefined },
                  { label: t("fields.email"), value: recipient.email, href: recipient.email ? `mailto:${recipient.email}` : undefined },
                  { label: t("fields.idNumber"), value: recipient.idNumber },
                  { label: t("fields.address"), value: recipient.address },
                  { label: t("fields.photoConsent"), value: recipient.photoConsent ? t("details.photoConsentYes") : t("details.photoConsentNo") },
                  { label: t("fields.waitlistDate"), value: recipient.waitlistDate ? fmtDate(recipient.waitlistDate) : null },
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

            {/* Contact Persons */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-500" />
                  {t("contactPersons.title", { count: contactPersonsArray.length })}
                </h3>
                <button
                  onClick={() => { setEditingContact(null); setShowAddContact(true); }}
                  className="btn-ghost text-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {tc("actions.add")}
                </button>
              </div>
              <div className="space-y-3">
                {contactPersonsArray.length === 0 ? (
                  <p className="text-sm text-petra-muted text-center py-4">{t("contactPersons.empty")}</p>
                ) : (
                  contactPersonsArray.map((cp) => {
                    const cpFiles = attachmentsArray.filter((a) => a.contactPersonId === cp.id);
                    return (
                      <div key={cp.id} className="rounded-xl border p-4 space-y-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{cp.name}</p>
                            <p className="text-xs text-petra-muted">{contactRoleLabel(t, cp.role)}</p>
                            {cp.phone && (
                              <a href={`tel:${cp.phone}`} className="text-xs text-brand-500 hover:underline flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {cp.phone}
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingContact(cp); setShowAddContact(true); }}
                              className="w-7 h-7 rounded flex items-center justify-center hover:bg-brand-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-brand-500" />
                            </button>
                            <button
                              onClick={() => deleteContactPerson(cp.id)}
                              className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>

                        {/* Files for this contact person */}
                        {cpFiles.length > 0 && (
                          <div className="space-y-1.5">
                            {cpFiles.map((f) => (
                              <div key={f.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs group/file">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-3 h-3 text-petra-muted shrink-0" />
                                  <span className="truncate font-medium">{f.name}</span>
                                  <span className="text-petra-muted shrink-0">{f.uploadedAt ? fmtDate(f.uploadedAt) : ""}</span>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {f.url && (
                                    <a href={f.url} target="_blank" rel="noreferrer" className="w-6 h-6 rounded flex items-center justify-center hover:bg-brand-50">
                                      <ExternalLink className="w-3 h-3 text-brand-500" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => renameAttachment(f.id, f.name)}
                                    className="opacity-100 sm:opacity-0 sm:group-hover/file:opacity-100 w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 transition-all"
                                    title={t("contactPersons.renameTitle")}
                                  >
                                    <Pencil className="w-3 h-3 text-slate-500" />
                                  </button>
                                  <button
                                    onClick={() => deleteAttachment(f.id)}
                                    className="opacity-100 sm:opacity-0 sm:group-hover/file:opacity-100 w-6 h-6 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                                    title={tc("actions.delete")}
                                  >
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => setUploadingForContact(cp.id)}
                          className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
                        >
                          <Upload className="w-3 h-3" />
                          {t("contactPersons.uploadNote")}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Disability Info */}
            {(recipient.disabilityType || recipient.disabilityNotes) && (
              <div className="card p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  {t("details.disabilityInfo")}
                </h3>
                {recipient.disabilityType && (
                  <div className="py-2 border-b">
                    <p className="text-xs text-petra-muted mb-0.5">{t("fields.disabilityType")}</p>
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
                <h3 className="font-semibold mb-2 text-sm text-petra-muted">{t("fields.notes")}</h3>
                <p className="text-sm text-petra-text whitespace-pre-wrap">{recipient.notes}</p>
              </div>
            )}
          </div>

          {/* Right: Placements */}
          <div>
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Dog className="w-4 h-4 text-brand-500" />
                {t("placements.title", { count: recipient.placements?.length || 0 })}
              </h3>
              {recipient.placements?.length === 0 ? (
                <p className="text-sm text-petra-muted text-center py-4">{t("placements.empty")}</p>
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
                        </p>
                        {p.placementDate && (
                          <p className="text-xs text-petra-muted">{t("placements.placedOn", { date: fmtDate(p.placementDate) })}</p>
                        )}
                        {p.certifiedAt && (
                          <p className="text-xs text-petra-muted">{t("placements.certifiedOn", { date: fmtDate(p.certifiedAt) })}</p>
                        )}
                        {p.nextCheckInAt && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t("placements.checkInOn", { date: fmtDate(p.nextCheckInAt) })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Certification date below placements */}
            {recipient.handoverDate && (
              <div className="card p-4 mt-3">
                <p className="text-xs text-petra-muted mb-0.5">{t("fields.certificationDate")}</p>
                <p className="text-sm font-semibold">{fmtDate(recipient.handoverDate)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === "documents" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" />
              {t("documents.title", { count: mainDocs.length })}
            </h3>
            <button
              onClick={() => { setAddDocDefaultType("OTHER"); setShowAddDoc(true); }}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Upload className="w-4 h-4" />
              {t("documents.upload")}
            </button>
          </div>

          {/* Group by category */}
          {DOC_TYPES.filter((dt) => dt.id !== "CONTACT_NOTE").map((dt) => {
            const docs = mainDocs.filter((a) => a.docType === dt.id);
            if (docs.length === 0) return null;
            return (
              <div key={dt.id} className="mb-5">
                <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t(`docTypes.${dt.id}`)}</p>
                <div className="space-y-2">
                  {docs.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/50 group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-brand-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{att.name}</p>
                          <p className="text-xs text-petra-muted">
                            {att.fileName && `${att.fileName} · `}
                            {att.uploadedAt && fmtDate(att.uploadedAt)}
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
                            title={t("documents.openTitle")}
                          >
                            <ExternalLink className="w-4 h-4 text-brand-500" />
                          </a>
                        )}
                        <button
                          onClick={() => renameAttachment(att.id, att.name)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 rounded flex items-center justify-center hover:bg-slate-200 transition-all"
                          title={t("contactPersons.renameTitle")}
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={() => deleteAttachment(att.id)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                          title={tc("actions.delete")}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Uncategorized / empty state */}
          {mainDocs.length === 0 && (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-petra-muted">{t("documents.empty")}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Guidelines */}
      {activeTab === "guidelines" && (
        <CrisisInstructionsCard
          value={recipient.crisisInstructions}
          isSaving={patchMutation.isPending}
          onSave={(text) => patchMutation.mutate({ crisisInstructions: text })}
        />
      )}

      {/* Tab: Meetings */}
      {activeTab === "meetings" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-500" />
              {t("meetings.title", { count: meetingsArray.length })}
            </h3>
          </div>
          <div className="space-y-3">
            {meetingsArray.map((meeting) => {
              const ms = MEETING_STATUS_MAP[meeting.status];
              return (
                <div key={meeting.id} className="p-4 rounded-xl border bg-slate-50/50 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">
                          {meetingTypeLabel(t, meeting.type)}
                        </span>
                        {ms && (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", ms.color)}>
                            {t(`meetingStatuses.${ms.id}`)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-petra-muted">
                        {meeting.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDate(meeting.date)}
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
                            {t("meetings.minutes", { count: meeting.duration })}
                          </span>
                        )}
                      </div>
                      {meeting.notes && (
                        <p className="text-sm text-petra-text mt-1">{meeting.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setCopyingMeeting(meeting)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center hover:bg-indigo-50 transition-all"
                        title={t("meetings.copyTitle")}
                      >
                        <Copy className="w-3.5 h-3.5 text-indigo-500" />
                      </button>
                      <button
                        onClick={() => setEditingMeeting(meeting)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center hover:bg-brand-50 transition-all"
                        title={t("meetings.editTitle")}
                      >
                        <Pencil className="w-3.5 h-3.5 text-brand-500" />
                      </button>
                      <button
                        onClick={() => deleteMeeting(meeting.id)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                        title={tc("actions.delete")}
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
              {t("meetings.add")}
            </button>
          </div>
        </div>
      )}

      {/* Edit Recipient Modal */}
      {editMode && (
        <EditRecipientModal
          recipient={recipient}
          stages={stages}
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

      {copyingMeeting && (
        <CopyMeetingToRecipientModal
          meeting={copyingMeeting}
          currentRecipientId={id}
          onClose={() => setCopyingMeeting(null)}
          onDone={() => setCopyingMeeting(null)}
        />
      )}

      {/* Upload Document Modal */}
      {showAddDoc && (
        <UploadDocModal
          recipientId={id}
          defaultDocType={addDocDefaultType}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["service-recipient", id] });
            setShowAddDoc(false);
            toast.success(t("toasts.docUploaded"));
          }}
          onClose={() => setShowAddDoc(false)}
        />
      )}

      {/* Add/Edit Contact Person Modal */}
      {showAddContact && (
        <ContactPersonModal
          person={editingContact}
          onSave={saveContactPerson}
          onClose={() => { setShowAddContact(false); setEditingContact(null); }}
        />
      )}

      {/* Upload file for contact person */}
      {uploadingForContact && (
        <UploadDocModal
          recipientId={id}
          defaultDocType="CONTACT_NOTE"
          contactPersonId={uploadingForContact}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["service-recipient", id] });
            setUploadingForContact(null);
            toast.success(t("toasts.fileUploaded"));
          }}
          onClose={() => setUploadingForContact(null)}
        />
      )}

      {/* Link Customer Modal */}
      {showLinkCustomer && (
        <LinkCustomerModal
          onLink={(customerId) => {
            patchMutation.mutate({ customerId });
            setShowLinkCustomer(false);
          }}
          onClose={() => setShowLinkCustomer(false)}
        />
      )}

      {/* Government Report Modal */}
      {showReport && (
        <GovernmentReportModal
          recipient={recipient}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && recipient && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-petra-text">{t("deleteDialog.title")}</h3>
                <p className="text-sm text-petra-muted mt-1">
                  {t.rich("deleteDialog.confirm", {
                    name: recipient.name,
                    b: (c) => <span className="font-medium text-petra-text">{c}</span>,
                  })}
                  <br />{t("deleteDialog.irreversible")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>{tc("actions.cancel")}</button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                onClick={() => deleteRecipientMutation.mutate()}
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

export default function RecipientDetailPage() {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  return (
    <TierGate
      feature="service_dogs"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
      upgradeTier="service_dog"
    >
      <RecipientDetailPageContent />
    </TierGate>
  );
}

// ─── Edit Recipient Modal ───

// ─── Crisis instructions (הנחיות בזמן התקף) ───

function CrisisInstructionsCard({
  value, isSaving, onSave,
}: {
  value: string | null;
  isSaving: boolean;
  onSave: (text: string | null) => void;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const startEdit = () => { setDraft(value ?? ""); setOpen(true); };
  const save = () => { onSave(draft.trim() || null); setOpen(false); };
  const remove = () => {
    if (!confirm(t("confirms.deleteCrisisInstructions"))) return;
    onSave(null);
    setOpen(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-500" />
          {t("crisis.title")}
        </h3>
      </div>

      {!open && (
        <button
          onClick={startEdit}
          className="w-full text-start p-4 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/40 hover:border-orange-400 transition-colors"
        >
          <p className="font-semibold text-sm flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-4 h-4" />
            {t("crisis.heading")}
          </p>
          {value ? (
            <p className="text-sm text-petra-text mt-2 whitespace-pre-wrap">{value}</p>
          ) : (
            <p className="text-xs text-petra-muted mt-1">{t("crisis.hint")}</p>
          )}
        </button>
      )}

      {open && (
        <div className="space-y-3">
          <label className="label text-xs">{t("crisis.heading")}</label>
          <textarea
            className="input w-full"
            rows={6}
            maxLength={5000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("crisis.placeholder")}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={save} disabled={isSaving}>
              {isSaving ? tc("progress.saving") : tc("actions.save")}
            </button>
            <button className="btn-secondary text-sm" onClick={() => setOpen(false)}>{tc("actions.cancel")}</button>
            {value && (
              <button className="text-sm text-red-600 hover:bg-red-50 px-3 rounded-lg ms-auto flex items-center gap-1" onClick={remove} disabled={isSaving}>
                <Trash2 className="w-3.5 h-3.5" /> {tc("actions.delete")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditRecipientModal({
  recipient, stages, onSave, onClose, isSaving,
}: {
  recipient: RecipientDetail;
  stages: Array<{ id: string; key: string; name: string; color: string }>;
  onSave: (data: Record<string, string | boolean | null>) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [name, setName] = useState(recipient.name);
  const [phone, setPhone] = useState(recipient.phone || "");
  const [mobile, setMobile] = useState(recipient.mobile || "");
  const [email, setEmail] = useState(recipient.email || "");
  const [idNumber, setIdNumber] = useState(recipient.idNumber || "");
  const [address, setAddress] = useState(recipient.address || "");
  const [disabilityType, setDisabilityType] = useState(recipient.disabilityType || "");
  const [disabilityNotes, setDisabilityNotes] = useState(recipient.disabilityNotes || "");
  const [fundingSource, setFundingSource] = useState(recipient.fundingSource || "");
  const [notes, setNotes] = useState(recipient.notes || "");
  const [status, setStatus] = useState(recipient.status);
  const [handoverDate, setHandoverDate] = useState(
    recipient.handoverDate ? recipient.handoverDate.split("T")[0] : ""
  );
  const [photoConsent, setPhotoConsent] = useState(!!recipient.photoConsent);

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
            {t("editModal.title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label text-xs">{t("editModal.fullNameRequired")}</label>
              <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("editModal.fullNamePlaceholder")} />
            </div>
            <div>
              <label className="label text-xs">{t("fields.mobile")}</label>
              <input type="tel" dir="ltr" className="input w-full text-right" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("editModal.email")}</label>
              <input type="email" dir="ltr" className="input w-full text-right" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("fields.phone")}</label>
              <input type="tel" dir="ltr" className="input w-full text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("editModal.idNumber")}</label>
              <input className="input w-full" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("editModal.stageStatus")}</label>
              <select className="input w-full text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t("fields.address")}</label>
              <input className="input w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                className="w-4 h-4 accent-brand-500"
                checked={photoConsent}
                onChange={(e) => setPhotoConsent(e.target.checked)}
              />
              <Camera className="w-4 h-4 text-petra-muted" />
              <span className="text-sm">{t("editModal.photoConsent")}</span>
            </label>
            <div>
              <label className="label text-xs">{t("editModal.disabilityType")}</label>
              <select className="input w-full text-sm" value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)}>
                <option value="">{t("editModal.choose")}</option>
                {DISABILITY_TYPES_LIST.map((d) => <option key={d.id} value={d.id}>{t(`disabilityTypes.${d.id}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">{t("fields.fundingSource")}</label>
              <select className="input w-full text-sm" value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
                <option value="">{t("editModal.choose")}</option>
                {RECIPIENT_FUNDING_SOURCES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t("editModal.disabilityNotes")}</label>
              <input className="input w-full" value={disabilityNotes} onChange={(e) => setDisabilityNotes(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t("fields.notes")}</label>
              <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("fields.certificationDate")}</label>
              <input type="date" lang={cfg.lang} className="input w-full" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="btn-primary flex-1"
            onClick={() => onSave({ name, phone, mobile, email, idNumber, address, disabilityType, disabilityNotes, fundingSource, notes, status, handoverDate: handoverDate || null, photoConsent })}
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? tc("progress.saving") : t("editModal.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Document Modal ───

function UploadDocModal({
  recipientId, defaultDocType, contactPersonId, onSuccess, onClose,
}: {
  recipientId: string;
  defaultDocType?: string;
  contactPersonId?: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState(defaultDocType || "OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", name.trim());
      fd.set("docType", docType);
      if (contactPersonId) fd.set("contactPersonId", contactPersonId);
      const res = await fetch(`/api/service-recipients/${recipientId}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("uploadModal.uploadError"));
      }
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("uploadModal.uploadFileError"));
    } finally {
      setUploading(false);
    }
  };

  const title = contactPersonId ? t("uploadModal.titleNote") : t("uploadModal.titleDoc");
  const visibleTypes = contactPersonId
    ? DOC_TYPES.filter((d) => d.id === "CONTACT_NOTE" || d.id === "OTHER")
    : DOC_TYPES.filter((d) => d.id !== "CONTACT_NOTE");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("uploadModal.nameLabel")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder={t("uploadModal.namePlaceholder")} />
          </div>
          {!contactPersonId && (
            <div>
              <label className="label">{t("uploadModal.typeLabel")}</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-full">
                {visibleTypes.map((d) => (
                  <option key={d.id} value={d.id}>{t(`docTypes.${d.id}`)}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">{t("uploadModal.fileLabel")}</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors",
                file ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/50"
              )}
            >
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div className="space-y-1">
                  <FileText className="w-6 h-6 text-brand-500 mx-auto" />
                  <p className="text-sm font-medium text-brand-600">{file.name}</p>
                  <p className="text-xs text-petra-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-6 h-6 text-petra-muted mx-auto" />
                  <p className="text-sm text-petra-muted">{t("uploadModal.clickToChoose")}</p>
                  <p className="text-xs text-petra-muted">{t("uploadModal.maxSize")}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleUpload}
              disabled={!file || !name.trim() || uploading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("uploadModal.uploading")}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {t("uploadModal.upload")}
                </>
              )}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Person Modal ───

function ContactPersonModal({
  person, onSave, onClose,
}: {
  person: ContactPerson | null;
  onSave: (cp: ContactPerson) => void;
  onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const [name, setName] = useState(person?.name || "");
  const [role, setRole] = useState(person?.role || CONTACT_PERSON_ROLES[0].value);
  const [phone, setPhone] = useState(person?.phone || "");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{person ? t("contactModal.editTitle") : t("contactModal.addTitle")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("contactModal.nameLabel")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder={t("contactModal.namePlaceholder")} />
          </div>
          <div>
            <label className="label">{t("contactModal.roleLabel")}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input w-full">
              {CONTACT_PERSON_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{t(`contactRoles.${r.key}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("fields.phone")}</label>
            <input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full text-right" placeholder="05X-XXXXXXX" />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onSave({ id: person?.id || crypto.randomUUID(), name, role, phone })}
              disabled={!name.trim()}
              className="btn-primary flex-1"
            >
              {person ? tc("actions.save") : tc("actions.add")}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Copy Meeting To Another Recipient ───

function CopyMeetingToRecipientModal({
  meeting, currentRecipientId, onClose, onDone,
}: {
  meeting: Meeting;
  currentRecipientId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: recipients = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
    staleTime: 30_000,
  });
  const others = recipients.filter((r) => r.id !== currentRecipientId);

  const handleCopy = async () => {
    if (!targetId) return;
    setSaving(true);
    try {
      // Read the target recipient's current meetings, then append a copy
      const detail = await fetch(`/api/service-recipients/${targetId}`).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      });
      const existing: Meeting[] = Array.isArray(detail.meetings)
        ? detail.meetings
        : (() => { try { return JSON.parse(detail.meetings ?? "[]"); } catch { return []; } })();
      const copy: Meeting = { ...meeting, id: crypto.randomUUID() };
      const res = await fetch(`/api/service-recipients/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetings: [copy, ...existing] }),
      });
      if (res.ok) {
        toast.success(t("copyModal.success"));
        onDone();
      } else {
        toast.error(t("copyModal.error"));
      }
    } catch {
      toast.error(t("copyModal.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-petra-text">{t("meetings.copyTitle")}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-petra-muted mb-3">
          {t("copyModal.description", {
            meeting: meetingTypeLabel(t, meeting.type),
            date: meeting.date ? ` · ${formatDate(meeting.date, { locale })}` : "",
          })}
        </p>
        <label className="label">{t("copyModal.targetLabel")}</label>
        <select className="input mb-4" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">{t("copyModal.targetPlaceholder")}</option>
          {others.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!targetId || saving} onClick={handleCopy}>
            <Copy className="w-4 h-4" />
            {saving ? t("copyModal.copying") : t("copyModal.copy")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
      <div className="modal-content max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{meeting ? t("meetingModal.editTitle") : t("meetingModal.addTitle")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("meetingModal.type")}</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input w-full">
                {MEETING_TYPES.map((mt) => (
                  <option key={mt.id} value={mt.id}>{t(`meetingTypes.${mt.id}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("fields.status")}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-full">
                {MEETING_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{t(`meetingStatuses.${s.id}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("meetingModal.date")}</label>
              <input type="date" lang={cfg.lang} value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">{t("meetingModal.duration")}</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="input w-full" placeholder="60" />
            </div>
          </div>
          <div>
            <label className="label">{t("meetingModal.trainer")}</label>
            <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="input w-full" placeholder={t("meetingModal.trainerPlaceholder")} />
          </div>
          <div>
            <label className="label">{t("fields.notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={3} placeholder={t("meetingModal.notesPlaceholder")} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="btn-primary flex-1">
              {meeting ? tc("actions.save") : t("meetingModal.addMeeting")}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Link Customer Modal ───

function LinkCustomerModal({
  onLink, onClose,
}: {
  onLink: (customerId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading } = useQuery<{ id: string; name: string; phone: string | null; email: string | null }[]>({
    queryKey: ["customers-search", search],
    queryFn: () => fetch(`/api/customers?search=${encodeURIComponent(search)}&take=20`).then((r) => r.json()),
    enabled: search.length >= 1,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-brand-500" />
            {t("linkModal.title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          {t("linkModal.description")}
        </p>
        <div className="relative mb-4">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input ps-10 w-full"
            placeholder={t("linkModal.searchPlaceholder")}
            autoFocus
          />
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {isLoading && <p className="text-sm text-petra-muted text-center py-4">{t("linkModal.searching")}</p>}
          {!isLoading && search.length >= 1 && customers.length === 0 && (
            <p className="text-sm text-petra-muted text-center py-4">{t("linkModal.noResults")}</p>
          )}
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => onLink(c.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-brand-50 hover:border-brand-200 transition-colors text-start"
            >
              <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{c.name}</p>
                {(c.phone || c.email) && (
                  <p className="text-xs text-petra-muted truncate">{c.phone || c.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="btn-secondary w-full mt-4">{tc("actions.cancel")}</button>
      </div>
    </div>
  );
}

// ─── Government Report Modal ───

function GovernmentReportModal({
  recipient, onClose,
}: {
  recipient: RecipientDetail;
  onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.recipientsDetailPage");
  const { locale } = useBusinessLocale();
  const fmtDate = (d: string) => formatDate(d, { locale });
  const activePlacement = recipient.placements?.find((p) => p.status === "ACTIVE");
  const today = new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 print:hidden">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Printer className="w-5 h-5 text-brand-500" />
            {t("report.title")}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <Printer className="w-4 h-4" />
              {t("report.print")}
            </button>
            <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="space-y-5 text-sm" id="gov-report">
          <div className="text-center border-b pb-4">
            <h3 className="text-xl font-bold">{t("report.heading")}</h3>
            <p className="text-petra-muted mt-1">{t("report.generatedOn", { date: today })}</p>
          </div>

          <div className="border rounded-xl p-4">
            <h4 className="font-bold mb-3 text-base border-b pb-2">{t("report.recipientDetails")}</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                { label: t("fields.fullName"), value: recipient.name },
                { label: t("fields.idNumber"), value: recipient.idNumber },
                { label: t("fields.phone"), value: recipient.phone },
                { label: t("fields.mobile"), value: recipient.mobile },
                { label: t("fields.email"), value: recipient.email },
                { label: t("fields.address"), value: recipient.address },
                { label: t("fields.disabilityType"), value: DISABILITY_TYPE_MAP[recipient.disabilityType || ""] || recipient.disabilityType },
                { label: t("fields.fundingSource"), value: FUNDING_SOURCE_MAP[recipient.fundingSource || ""] || recipient.fundingSource },
                { label: t("fields.status"), value: RECIPIENT_STATUS_MAP[recipient.status]?.label || recipient.status },
                { label: t("fields.certificationDate"), value: recipient.handoverDate ? fmtDate(recipient.handoverDate) : null },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label} className="flex gap-2">
                  <span className="text-petra-muted font-medium min-w-28">{row.label}:</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
            {recipient.disabilityNotes && (
              <div className="mt-3 pt-3 border-t">
                <span className="text-petra-muted font-medium">{t("report.disabilityDetails")}</span>
                <span>{recipient.disabilityNotes}</span>
              </div>
            )}
          </div>

          {/* Contact persons in report */}
          {safeJsonArray<ContactPerson>(recipient.contactPersons).length > 0 && (
            <div className="border rounded-xl p-4">
              <h4 className="font-bold mb-3 text-base border-b pb-2">{t("report.contactPersons")}</h4>
              <div className="space-y-2">
                {safeJsonArray<ContactPerson>(recipient.contactPersons).map((cp) => (
                  <div key={cp.id} className="flex gap-4 text-sm py-1.5 border-b last:border-0">
                    <span className="font-medium min-w-28">{cp.name}</span>
                    <span className="text-petra-muted">{contactRoleLabel(t, cp.role)}</span>
                    {cp.phone && <span>{cp.phone}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePlacement && (
            <div className="border rounded-xl p-4">
              <h4 className="font-bold mb-3 text-base border-b pb-2">{t("report.dogDetails")}</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex gap-2">
                  <span className="text-petra-muted font-medium min-w-28">{t("report.dogName")}</span>
                  <span className="font-medium">{activePlacement.serviceDog.pet.name}</span>
                </div>
                {activePlacement.serviceDog.pet.breed && (
                  <div className="flex gap-2">
                    <span className="text-petra-muted font-medium min-w-28">{t("report.breed")}</span>
                    <span className="font-medium">{activePlacement.serviceDog.pet.breed}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-petra-muted font-medium min-w-28">{t("report.phase")}</span>
                  <span className="font-medium">{SERVICE_DOG_PHASE_MAP[activePlacement.serviceDog.phase]?.label || activePlacement.serviceDog.phase}</span>
                </div>
                {activePlacement.placementDate && (
                  <div className="flex gap-2">
                    <span className="text-petra-muted font-medium min-w-28">{t("report.placementDate")}</span>
                    <span className="font-medium">{fmtDate(activePlacement.placementDate)}</span>
                  </div>
                )}
                {(activePlacement.certifiedAt || recipient.handoverDate) && (
                  <div className="flex gap-2">
                    <span className="text-petra-muted font-medium min-w-28">{t("report.certificationDate")}</span>
                    <span className="font-medium">{fmtDate((activePlacement.certifiedAt ?? recipient.handoverDate)!)}</span>
                  </div>
                )}
                {activePlacement.nextCheckInAt && (
                  <div className="flex gap-2">
                    <span className="text-petra-muted font-medium min-w-28">{t("report.checkIn")}</span>
                    <span className="font-medium">{fmtDate(activePlacement.nextCheckInAt)}</span>
                  </div>
                )}
              </div>
              {activePlacement.notes && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-petra-muted font-medium">{t("report.placementNotes")}</span>
                  <span>{activePlacement.notes}</span>
                </div>
              )}
            </div>
          )}

          {safeJsonArray<Meeting>(recipient.meetings).length > 0 && (
            <div className="border rounded-xl p-4">
              <h4 className="font-bold mb-3 text-base border-b pb-2">
                {t("meetings.title", { count: safeJsonArray<Meeting>(recipient.meetings).length })}
              </h4>
              <div className="space-y-2">
                {[...safeJsonArray<Meeting>(recipient.meetings)]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((m) => (
                    <div key={m.id} className="flex gap-3 text-xs py-1.5 border-b last:border-0">
                      <span className="text-petra-muted min-w-24">{m.date ? fmtDate(m.date) : ""}</span>
                      <span className="font-medium">{meetingTypeLabel(t, m.type)}</span>
                      {m.trainerName && <span className="text-petra-muted">— {m.trainerName}</span>}
                      {m.notes && <span className="text-petra-muted truncate">{m.notes}</span>}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {recipient.notes && (
            <div className="border rounded-xl p-4">
              <h4 className="font-bold mb-2 text-base">{t("report.generalNotes")}</h4>
              <p className="text-sm whitespace-pre-wrap">{recipient.notes}</p>
            </div>
          )}

          <div className="text-center text-xs text-petra-muted border-t pt-4">
            {t("report.footer", { date: today })}
          </div>
        </div>
      </div>
    </div>
  );
}
