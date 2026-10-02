"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Phone, Mail, MapPin, PawPrint, Plus, CreditCard, GraduationCap, Pencil, MessageCircle, ExternalLink, FileText, Trash2, Scissors, BookOpen, ChevronDown, ChevronUp, AlertTriangle, Heart, Pill, UtensilsCrossed, ShoppingCart, Link2, Send, CalendarClock, CheckCircle2, ListTodo, MoreVertical, Printer, Gift } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { cn, formatDate, formatCurrency, getStatusColor, getStatusLabel, getTimelineIcon, toWhatsAppPhone, fetchJSON } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerSalesHistory, CustomerLeadChip } from "@/components/customers/CustomerSalesHistory";
import dynamic from "next/dynamic";
import { BEHAVIOR_FLAG_LABELS, CustomerDocumentsSection, ORDER_STATUS_INFO, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS, PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS, PROGRAM_TYPE_LABELS, SEVERITY_COLORS } from "@/components/customers/detail/CustomerDocumentsSection";
import { EditCustomerModal } from "@/components/customers/detail/EditCustomerModal";
import { NewAppointmentModal } from "@/components/customers/detail/NewAppointmentModal";
import { QuickTaskModal } from "@/components/customers/detail/QuickTaskModal";
import { SendContractSection } from "@/components/customers/detail/SendContractSection";
import { WhatsAppComposeModal } from "@/components/customers/detail/WhatsAppComposeModal";
import { EditBehaviorModal, EditFeedingModal, EditHealthModal } from "@/components/customers/detail/pet-care-modals";
import { AddPetModal, EditPetModal, EditPetNoteModal, MedicationModal, PetDocumentsModal } from "@/components/customers/detail/pet-modals";
import { CustomerDetail, DogMedication, Pet, calcAge } from "@/components/customers/detail/types";
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);

function CustomerPermGate({ children }: { children: React.ReactNode }) {
  const permsGate = usePermissions();
  if (!permsGate.canSeePii) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ArrowRight className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-petra-text mb-2">אין הרשאה</h2>
        <p className="text-sm text-petra-muted">אין לך הרשאה לצפות בפרטי לקוחות. פנה למנהל העסק.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = params.id as string;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [showPetModal, setShowPetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPetDocs, setSelectedPetDocs] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [logNote, setLogNote] = useState("");
  const [showLogNote, setShowLogNote] = useState(false);
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, Record<string, boolean>>>({});
  const toggleSection = (petId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [petId]: { ...prev[petId], [section]: !prev[petId]?.[section] },
    }));
  };
  const isSectionOpen = (petId: string, section: string) => !!expandedSections[petId]?.[section];
  const [showOrderModal, setShowOrderModal] = useState(false);
  const openOrderModal = () => {
    if (!customer?.pets || customer.pets.length === 0) {
      toast.error("חובה להוסיף חיית מחמד ללקוח לפני יצירת הזמנה", { description: "לחץ על 'הוסף חיית מחמד' בקטע חיות המחמד למטה" });
      return;
    }
    setShowOrderModal(true);
  };
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [intakeSending, setIntakeSending] = useState(false);
  const [medModal, setMedModal] = useState<{ petId: string; petName: string; med: DogMedication | null } | null>(null);
  const [deletingMed, setDeletingMed] = useState<{ id: string; petId: string } | null>(null);
  const [healthModal, setHealthModal] = useState<{ pet: Pet } | null>(null);
  const [behaviorModal, setBehaviorModal] = useState<{ pet: Pet } | null>(null);
  const [feedingModal, setFeedingModal] = useState<{ pet: Pet } | null>(null);
  const [noteModal, setNoteModal] = useState<{ petId: string; field: string; label: string; value: string } | null>(null);
  const [editPetModal, setEditPetModal] = useState<{ pet: Pet } | null>(null);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [deletingPetOwner, setDeletingPetOwner] = useState<{ id: string; name: string } | null>(null);
  const [showWaCompose, setShowWaCompose] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const { user } = useAuth();
  const { isGroomer, can } = usePlan();
  const perms = usePermissions();
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  const { data: customer, isLoading, isError, error } = useQuery<CustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}`).then(async (r) => {
        if (r.status === 404) throw new Error("CUSTOMER_NOT_FOUND");
        if (!r.ok) throw new Error("FETCH_ERROR");
        return r.json();
      }),
    refetchInterval: 60000,
    retry: (failureCount, err) => {
      if ((err as Error)?.message === "CUSTOMER_NOT_FOUND") return false;
      return failureCount < 2;
    },
  });

  const logMutation = useMutation({
    mutationFn: (note: string) =>
      fetch(`/api/customers/${customerId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: note, type: "note" }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setLogNote("");
      setShowLogNote(false);
    },
  });

  const deleteMedMutation = useMutation({
    mutationFn: ({ petId, id }: { petId: string; id: string }) =>
      fetch(`/api/pets/${petId}/medications/${id}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setDeletingMed(null);
    },
  });

  const [completingAptId, setCompletingAptId] = useState<string | null>(null);
  const [remindingAptId, setRemindingAptId] = useState<string | null>(null);
  const remindAptMutation = useMutation({
    mutationFn: (aptId: string) =>
      fetch(`/api/appointments/${aptId}/remind`, { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "שגיאה");
        return data;
      }),
    onSuccess: () => { setRemindingAptId(null); toast.success("תזכורת WhatsApp נשלחה"); },
    onError: (err: Error) => { setRemindingAptId(null); toast.error(err.message || "שגיאה בשליחת תזכורת"); },
  });
  const completeAptMutation = useMutation({
    mutationFn: (aptId: string) =>
      fetchJSON(`/api/appointments/${aptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setCompletingAptId(null);
    },
    onError: () => setCompletingAptId(null),
  });

  const deletePetMutation = useMutation<Record<string, unknown>, Error, { petId: string; confirmAction?: string }>({
    mutationFn: ({ petId, confirmAction }) =>
      fetchJSON(`/api/pets/${petId}`, {
        method: "DELETE",
        ...(confirmAction ? { headers: { "x-confirm-action": confirmAction } } : {}),
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data) => {
      if (data.pendingApproval) {
        toast.success("הבקשה נשלחה לאישור הבעלים");
        setDeletingPetId(null);
        setDeletingPetOwner(null);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      // The pets list page (["pets-all", ...]) and customers list cache the pet
      // under the 5-min global staleTime — invalidate them too so the deleted
      // pet doesn't linger in those lists.
      queryClient.invalidateQueries({ queryKey: ["pets-all"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("חיית המחמד נמחקה");
      setDeletingPetId(null);
      setDeletingPetOwner(null);
    },
    onError: (err) => {
      toast.error(err?.message || "שגיאה במחיקת חיית המחמד");
      setDeletingPetId(null);
      setDeletingPetOwner(null);
    },
  });

  const deleteCustomerMutation = useMutation<Record<string, unknown>>({
    mutationFn: () =>
      fetchJSON(`/api/customers/${customerId}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_CUSTOMER_${customerId}` },
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data) => {
      if (data?.pendingApproval) {
        toast.success("הבקשה נשלחה לאישור הבעלים");
        setShowConfirmDeleteModal(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push("/customers");
    },
    onError: (e: Error) => {
      setShowConfirmDeleteModal(false);
      toast.error(e?.message || "שגיאה במחיקת הלקוח. נסה שוב.");
    },
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  if (isError || !customer) {
    const isNotFound = (error as Error)?.message === "CUSTOMER_NOT_FOUND" || (!isLoading && !customer);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center" dir="rtl">
        <div className="text-6xl">{isNotFound ? "🔍" : "⚠️"}</div>
        <h2 className="text-xl font-bold text-petra-text">
          {isNotFound ? "לקוח לא נמצא" : "שגיאה בטעינת הדף"}
        </h2>
        <p className="text-sm text-petra-muted max-w-xs">
          {isNotFound
            ? "הלקוח שחיפשת לא קיים או שהקישור שגוי"
            : "משהו השתבש. אנא נסה לרענן את הדף."}
        </p>
        <Link href="/customers" className="btn-primary mt-2">
          חזרה לרשימת הלקוחות
        </Link>
      </div>
    );
  }

  const customerTags: string[] = (() => {
    try {
      return JSON.parse(customer.tags);
    } catch {
      return [];
    }
  })();

  const paidTotal = (customer.payments || [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const pendingTotal = (customer.payments || [])
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((s, p) => s + p.amount, 0);

  const activePrograms = (customer.trainingPrograms || []).filter(
    (p) => p.status === "ACTIVE"
  );

  const displayedAppointments = showAllAppointments
    ? customer.appointments
    : customer.appointments.slice(0, 6);

  return (
    <CustomerPermGate>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/customers"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-petra-muted transition-colors flex-shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-petra-text truncate">
              {customer.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm text-petra-muted">
                נוסף {formatDate(customer.createdAt)}
              </p>
              <CustomerLeadChip customerId={customerId} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {/* Mobile quick-actions dropdown */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowMobileActions(!showMobileActions)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMobileActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileActions(false)} />
                <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 animate-fade-in">
                  <button onClick={() => { openOrderModal(); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <ShoppingCart className="w-4 h-4 text-slate-400" />הזמנה חדשה
                  </button>
                  <button onClick={() => { setShowNewAppointmentModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <CalendarClock className="w-4 h-4 text-slate-400" />קבע תור
                  </button>
                  <button onClick={() => { setShowQuickTaskModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <ListTodo className="w-4 h-4 text-slate-400" />משימה
                  </button>
                  <Link href={`/payment-request?customerId=${customer.id}&name=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone)}`} onClick={() => setShowMobileActions(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <Send className="w-4 h-4 text-slate-400" />בקשת תשלום
                  </Link>
                  <button
                    disabled={intakeSending}
                    onClick={async () => {
                      setShowMobileActions(false);
                      setIntakeSending(true);
                      try {
                        const res = await fetch("/api/intake/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id }) });
                        const data = await res.json();
                        if (data.url && customer.phone) {
                          const msg = `שלום ${customer.name}! 📋\nאנא מלא טופס קבלה:\n${data.url}`;
                          window.open(`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
                        }
                      } finally { setIntakeSending(false); }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />{intakeSending ? "שולח..." : "טופס קבלה"}
                  </button>
                  <button onClick={() => { setShowMobileActions(false); window.print(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <Printer className="w-4 h-4 text-slate-400" />הדפס
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowNewAppointmentModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="קבע תור ללקוח זה"
          >
            <CalendarClock className="w-4 h-4" />
            קבע תור
          </button>
          <button
            onClick={() => setShowQuickTaskModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="צור משימה עבור לקוח זה"
          >
            <ListTodo className="w-4 h-4" />
            משימה
          </button>
          <Link
            href={`/payment-request?customerId=${customer.id}&name=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone)}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="שלח בקשת תשלום ללקוח זה"
          >
            <Send className="w-4 h-4" />
            בקשת תשלום
          </Link>
          <button
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            title="שלח טופס קבלה בוואטסאפ"
            disabled={intakeSending}
            onClick={async () => {
              setIntakeSending(true);
              try {
                const res = await fetch("/api/intake/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ customerId: customer.id }),
                });
                const data = await res.json();
                if (data.url && customer.phone) {
                  const msg = `שלום ${customer.name}! 📋\nאנא מלא טופס קבלה עבור הכלב שלך:\n${data.url}\nהקישור בתוקף ל-7 ימים. תודה! 🐾`;
                  window.open(`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
                }
              } finally {
                setIntakeSending(false);
              }
            }}
          >
            <FileText className="w-4 h-4" />
            {intakeSending ? "שולח..." : "טופס קבלה"}
          </button>
          {user?.businessSlug && customer.phone && (
            <a
              href={`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(
                `שלום ${customer.name}! 📅\nקבע/י תור אונליין בקישור הבא:\n${window?.location?.origin || ""}/book/${user.businessSlug}\nנשמח לראותך! 🐾`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="שלח קישור הזמנה בוואטסאפ"
            >
              <CalendarClock className="w-4 h-4" />
              קישור הזמנה
            </a>
          )}
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="הדפס דף לקוח"
          >
            <Printer className="w-4 h-4" />
            הדפס
          </button>
          {/* Delete button — hidden for staff, "send for approval" for manager, confirm modal for owner */}
          {!perms.isStaff && !perms.isVolunteer && (
            <button
              onClick={() => {
                if (perms.isManager) {
                  // Manager: trigger direct delete which routes to pending approval
                  deleteCustomerMutation.mutate();
                } else {
                  // Owner: open typed confirmation modal
                  setShowConfirmDeleteModal(true);
                }
              }}
              disabled={deleteCustomerMutation.isPending}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
              title={perms.isManager ? "שלח בקשת מחיקה לאישור" : "מחק לקוח"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => openOrderModal()}
            className="hidden sm:flex btn-primary items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            הזמנה חדשה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* Contact Card */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-petra-text">פרטי קשר</h2>
              <button
                onClick={() => setShowEditModal(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-colors"
                title="ערוך לקוח"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-petra-muted flex-shrink-0" />
                <a href={`tel:${customer.phone}`} className="text-sm hover:underline">{customer.phone}</a>
                <a
                  href={`https://wa.me/${toWhatsAppPhone(customer.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-auto flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                  title="שלח הודעת WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>
              {customer.email && (
                <a
                  href={`https://mail.google.com/mail/?view=cm&to=${customer.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 group"
                >
                  <Mail className="w-4 h-4 text-petra-muted flex-shrink-0 group-hover:text-brand-600 transition-colors" />
                  <span className="text-sm break-all text-brand-600 group-hover:text-brand-700 group-hover:underline transition-colors">
                    {customer.email}
                  </span>
                </a>
              )}
              {/* Address — masked for staff */}
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-petra-muted flex-shrink-0" />
                {perms.canSeePii ? (
                  customer.address
                    ? <span className="text-sm">{customer.address}</span>
                    : <span className="text-sm text-slate-300">—</span>
                ) : (
                  <span className="text-sm text-slate-300 tracking-widest select-none" title="אין הרשאה לצפייה בכתובת">●●●●●</span>
                )}
              </div>
            </div>

            {customerTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {customerTags.map((tag) => (
                  <span key={tag} className="badge-brand">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {customer.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-sm text-petra-muted">{customer.notes}</p>
              </div>
            )}

            {/* Stats grid */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-lg font-bold text-petra-text">
                  {customer.appointments.length}
                </p>
                <p className="text-[10px] text-petra-muted">תורים</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-lg font-bold text-petra-text">
                  {customer.pets.length}
                </p>
                <p className="text-[10px] text-petra-muted">חיות</p>
              </div>
              {perms.canSeeFinance && (
                <div className="text-center p-2 rounded-xl bg-slate-50">
                  <p
                    className={cn(
                      "text-base font-bold leading-tight",
                      pendingTotal > 0 ? "text-red-500" : "text-emerald-600"
                    )}
                  >
                    {pendingTotal > 0
                      ? `−${formatCurrency(pendingTotal)}`
                      : formatCurrency(paidTotal)}
                  </p>
                  <p className="text-[10px] text-petra-muted">
                    {pendingTotal > 0 ? "יתרה" : "שולם"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Package tracking */}
          {activePrograms.some((p) => (p.totalSessions ?? 0) > 0) && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-petra-text mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-500" />
                מעקב חבילות
              </h3>
              <div className="space-y-4">
                {activePrograms.filter((p) => (p.totalSessions ?? 0) > 0).map((program) => {
                  const completed = program.sessions?.length ?? 0;
                  const total = program.totalSessions || 1;
                  const pct = Math.min(
                    100,
                    Math.round((completed / total) * 100)
                  );
                  return (
                    <div key={program.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-petra-text">
                          {program.dog?.name
                            ? `${program.dog.name} · `
                            : ""}
                          {PROGRAM_TYPE_LABELS[program.programType] ||
                            program.name}
                        </span>
                        <span className="text-[10px] text-petra-muted">
                          {completed}/{total} מפגשים
                        </span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 100
                                ? "#10B981"
                                : pct >= 60
                                ? "#F97316"
                                : "#FBBF24",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-petra-muted mt-0.5 text-right">
                        {pct}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pets */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">
                חיות מחמד ({customer.pets.length})
              </h2>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowPetModal(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                הוסף
              </button>
            </div>

            {customer.pets.length === 0 ? (
              <div className="empty-state py-8">
                <PawPrint className="empty-state-icon w-8 h-8" />
                <p className="text-sm text-petra-muted mt-2">
                  אין חיות מחמד רשומות
                </p>
                <button
                  className="btn-primary mt-3 text-xs"
                  onClick={() => setShowPetModal(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף חיית מחמד
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customer.pets.map((pet) => {
                  const petTags: string[] = (() => {
                    try {
                      return JSON.parse(pet.tags || "[]");
                    } catch {
                      return [];
                    }
                  })();
                  const age = calcAge(pet.birthDate);
                  const attachmentsList: { type: string; url: string; mimeType?: string }[] = (() => {
                    try { return JSON.parse(pet.attachments || "[]"); } catch { return []; }
                  })();
                  const profilePhotoUrl = attachmentsList.find((a) => a.type === "profile_photo" || a.mimeType?.startsWith("image/"))?.url ?? null;
                  const docCount = attachmentsList.length;
                  const hasWarning =
                    pet.behavior?.dogAggression ||
                    pet.behavior?.humanAggression ||
                    pet.behavior?.biteHistory;
                  const isExpanded = expandedPetId === pet.id;
                  const hasMeds = pet.medications && pet.medications.length > 0;
                  const hasFood = !!pet.foodNotes;

                  // Gather active behavior flags
                  const activeBehaviorFlags = pet.behavior
                    ? Object.entries(BEHAVIOR_FLAG_LABELS).filter(
                        ([key]) => pet.behavior?.[key as keyof typeof pet.behavior] === true
                      )
                    : [];

                  // Training programs for this pet
                  const petPrograms = (customer.trainingPrograms || []).filter(
                    (p) => p.dogId === pet.id
                  );

                  return (
                    <div
                      key={pet.id}
                      className={cn(
                        "group rounded-2xl bg-amber-50/50 border border-amber-100 p-4 space-y-3 transition-all",
                        isExpanded && "sm:col-span-2 border-amber-200 shadow-sm"
                      )}
                    >
                      {/* Clickable header area */}
                      <div
                        className="cursor-pointer"
                        onClick={() => setExpandedPetId(isExpanded ? null : pet.id)}
                      >
                        {/* Pet header */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {profilePhotoUrl ? (
                              <img src={profilePhotoUrl} className="w-full h-full object-cover" alt={pet.name} />
                            ) : (
                              <PawPrint className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/pets/${pet.id}`}
                                className="text-sm font-bold text-petra-text hover:text-brand-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {pet.name}
                              </Link>
                              {hasWarning && (
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                              )}
                              {pet.health?.neuteredSpayed && (
                                <Scissors className="w-3 h-3 text-stone-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-petra-muted">
                              {pet.species === "dog"
                                ? "כלב"
                                : pet.species === "cat"
                                ? "חתול"
                                : pet.species}
                              {pet.breed ? ` · ${pet.breed}` : ""}
                              {pet.gender
                                ? ` · ${pet.gender === "male" ? "זכר" : "נקבה"}`
                                : ""}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {customer.phone && (() => {
                              const petAge = age ?? "";
                              const agePart = petAge ? ` ${petAge}` : "";
                              const bdMsg = `יום הולדת שמח ל-${pet.name}! 🎂🐾\n\n${pet.name} מלא/ה${agePart} היום – כל הכבוד! 🎉\n\nכמתנה קטנה, נשמח להעניק לכם 10% הנחה על הפגישה הבאה 🎁\n(ציינו שקיבלתם הודעה זו בעת קביעת הפגישה)`;
                              return (
                                <a
                                  href={`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(bdMsg)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-amber-200 transition-all"
                                  title="שלח ברכת יום הולדת WhatsApp"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Gift className="w-3 h-3 text-amber-700" />
                                </a>
                              );
                            })()}
                            <button
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-amber-200 transition-all"
                              onClick={(e) => { e.stopPropagation(); setEditPetModal({ pet }); }}
                              title="ערוך"
                            >
                              <Pencil className="w-3 h-3 text-amber-700" />
                            </button>
                            {!perms.isStaff && !perms.isVolunteer && (
                              <button
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (perms.isOwner) {
                                    setDeletingPetOwner({ id: pet.id, name: pet.name });
                                  } else {
                                    setDeletingPetId(pet.id);
                                  }
                                }}
                                title={perms.isOwner ? "מחק" : "שלח בקשת מחיקה לאישור"}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-stone-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-stone-400" />
                            )}
                          </div>
                        </div>

                        {/* Quick info: age, weight, indicators */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-stone-500">
                          {age && <span>גיל: {age}</span>}
                          {pet.weight && <span>משקל: {pet.weight} ק״ג</span>}
                          {pet.microchip && (
                            <span className="text-stone-400">שבב: {pet.microchip}</span>
                          )}
                          {hasMeds && (
                            <span className="flex items-center gap-0.5 text-red-500">
                              <Pill className="w-3 h-3" />
                              {pet.medications.length} תרופות
                            </span>
                          )}
                          {hasFood && (
                            <span className="flex items-center gap-0.5 text-amber-600">
                              <UtensilsCrossed className="w-3 h-3" />
                              האכלה
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Behavioral tags */}
                      {petTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {petTags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* ── Expanded details ── */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-amber-200/50 space-y-4 animate-fade-in">
                          {/* Feeding info */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "feeding"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-petra-text">האכלה</span>
                                {isSectionOpen(pet.id, "feeding") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-amber-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setFeedingModal({ pet }); }}
                                title="ערוך האכלה"
                              >
                                <Pencil className="w-3 h-3 text-amber-600" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "feeding") && ((pet.foodBrand || pet.foodGramsPerDay || pet.foodFrequency || pet.foodNotes) ? (
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                                {pet.foodBrand && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מותג: </span>
                                    <span className="text-stone-700 font-medium">{pet.foodBrand}</span>
                                  </div>
                                )}
                                <div className="flex gap-4 text-[11px]">
                                  {pet.foodGramsPerDay && (
                                    <div>
                                      <span className="text-stone-500">כמות: </span>
                                      <span className="text-stone-700 font-medium">{pet.foodGramsPerDay} גרם/יום</span>
                                    </div>
                                  )}
                                  {pet.foodFrequency && (
                                    <div>
                                      <span className="text-stone-500">תדירות: </span>
                                      <span className="text-stone-700">{pet.foodFrequency}</span>
                                    </div>
                                  )}
                                </div>
                                {pet.foodNotes && (
                                  <p className="text-[11px] text-stone-500 whitespace-pre-line">{pet.foodNotes}</p>
                                )}
                              </div>
                            ) : (
                              <button
                                className="w-full text-xs text-amber-400 hover:text-amber-600 py-1.5 border border-dashed border-amber-200 hover:border-amber-300 rounded-lg transition-colors"
                                onClick={(e) => { e.stopPropagation(); setFeedingModal({ pet }); }}
                              >
                                + הוסף פרטי האכלה
                              </button>
                            ))}
                          </div>

                          {/* Medications */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "medications"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <Pill className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-xs font-bold text-petra-text">
                                  תרופות ({pet.medications.length})
                                </span>
                                {isSectionOpen(pet.id, "medications") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med: null }); }}
                                title="ערוך תרופות"
                              >
                                <Pencil className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "medications") && <div className="space-y-1.5">
                              {pet.medications.map((med) => (
                                <div key={med.id} className="bg-white/60 rounded-lg p-2.5 group">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-petra-text">
                                      {med.medName}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {med.dosage && (
                                        <span className="text-[10px] text-stone-500 bg-red-50 px-1.5 py-0.5 rounded">
                                          {med.dosage}
                                        </span>
                                      )}
                                      <button
                                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-brand-50 transition-all"
                                        onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med }); }}
                                        title="ערוך"
                                      >
                                        <Pencil className="w-3 h-3 text-brand-500" />
                                      </button>
                                      <button
                                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                                        onClick={(e) => { e.stopPropagation(); setDeletingMed({ id: med.id, petId: pet.id }); }}
                                        title="מחק"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500 mt-1">
                                    {med.frequency && <span>תדירות: {med.frequency}</span>}
                                    {med.times && <span>שעות: {med.times}</span>}
                                    {med.instructions && (
                                      <span className="text-stone-400">{med.instructions}</span>
                                    )}
                                    {med.startDate && (
                                      <span>
                                        מ-{new Date(med.startDate).toLocaleDateString("he-IL")}
                                      </span>
                                    )}
                                    {med.endDate && (
                                      <span>
                                        עד {new Date(med.endDate).toLocaleDateString("he-IL")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {pet.medications.length > 0 ? (
                                <button
                                  className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-dashed border-red-200 hover:border-red-300 rounded-lg transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med: null }); }}
                                >
                                  + הוסף תרופה נוספת
                                </button>
                              ) : (
                                <button
                                  className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-dashed border-red-200 hover:border-red-300 rounded-lg transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med: null }); }}
                                >
                                  + הוסף תרופה ראשונה
                                </button>
                              )}
                            </div>}
                          </div>

                          {/* Health */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "health"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <Heart className="w-3.5 h-3.5 text-rose-500" />
                                <span className="text-xs font-bold text-petra-text">בריאות</span>
                                {isSectionOpen(pet.id, "health") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-rose-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setHealthModal({ pet }); }}
                                title="ערוך בריאות"
                              >
                                <Pencil className="w-3 h-3 text-rose-500" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "health") && pet.health && (
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                                {/* Vaccines */}
                                {(pet.health.rabiesLastDate || pet.health.rabiesValidUntil ||
                                  pet.health.dhppLastDate || pet.health.dhppPuppy1Date || pet.health.dhppPuppy2Date || pet.health.dhppPuppy3Date ||
                                  pet.health.bordatellaDate || pet.health.parkWormDate ||
                                  pet.health.dewormingLastDate || pet.health.fleaTickDate ||
                                  (pet.health.notVaccinatedFlags && Object.values(pet.health.notVaccinatedFlags).some(Boolean))) && (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                    {pet.health.rabiesLastDate && (
                                      <div>
                                        <span className="text-stone-500">כלבת: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.rabiesLastDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.rabiesValidUntil && (
                                      <div>
                                        <span className="text-stone-500">כלבת עד: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.rabiesValidUntil).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppPuppy1Date && (
                                      <div>
                                        <span className="text-stone-500">משושה גורים מ1: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppPuppy1Date).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppPuppy2Date && (
                                      <div>
                                        <span className="text-stone-500">משושה גורים מ2: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppPuppy2Date).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppPuppy3Date && (
                                      <div>
                                        <span className="text-stone-500">משושה גורים מ3: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppPuppy3Date).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppLastDate && (
                                      <div>
                                        <span className="text-stone-500">משושה בוגר: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppLastDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.bordatellaDate && (
                                      <div>
                                        <span className="text-stone-500">שעלת מכלאות: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.bordatellaDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.parkWormDate && (
                                      <div>
                                        <span className="text-stone-500">תולעת פארק: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.parkWormDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dewormingLastDate && (
                                      <div>
                                        <span className="text-stone-500">תילוע: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dewormingLastDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.fleaTickDate && (
                                      <div>
                                        <span className="text-stone-500">קרציות/פרעושים: </span>
                                        <span className="text-stone-700">
                                          {pet.health.fleaTickType ? `${pet.health.fleaTickType} · ` : ""}
                                          {new Date(pet.health.fleaTickDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.notVaccinatedFlags?.rabies && <div><span className="text-orange-600 font-medium">כלבת: לא חוסן</span></div>}
                                    {pet.health.notVaccinatedFlags?.dhpp && <div><span className="text-orange-600 font-medium">משושה: לא חוסן</span></div>}
                                    {pet.health.notVaccinatedFlags?.deworming && <div><span className="text-orange-600 font-medium">תילוע: לא טופל</span></div>}
                                    {pet.health.notVaccinatedFlags?.parkWorm && <div><span className="text-orange-600 font-medium">תולעת הפארק: לא טופל</span></div>}
                                    {pet.health.notVaccinatedFlags?.fleaTick && <div><span className="text-orange-600 font-medium">קרציות/פרעושים: לא טופל</span></div>}
                                    {pet.health.notVaccinatedFlags?.bordetella && <div><span className="text-orange-600 font-medium">שעלת מכלאות: לא חוסן</span></div>}
                                  </div>
                                )}
                                {pet.health.allergies && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">אלרגיות: </span>
                                    <span className="text-stone-700">{pet.health.allergies}</span>
                                  </div>
                                )}
                                {pet.health.medicalConditions && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מצבים רפואיים: </span>
                                    <span className="text-stone-700">{pet.health.medicalConditions}</span>
                                  </div>
                                )}
                                {pet.health.surgeriesHistory && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">ניתוחים: </span>
                                    <span className="text-stone-700">{pet.health.surgeriesHistory}</span>
                                  </div>
                                )}
                                {pet.health.activityLimitations && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מגבלות פעילות: </span>
                                    <span className="text-stone-700">{pet.health.activityLimitations}</span>
                                  </div>
                                )}
                                {(pet.health.vetName || pet.health.vetPhone) && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">וטרינר: </span>
                                    <span className="text-stone-700">
                                      {pet.health.vetName}
                                      {pet.health.vetPhone ? ` · ${pet.health.vetPhone}` : ""}
                                    </span>
                                  </div>
                                )}
                                {pet.health.originInfo && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מקור: </span>
                                    <span className="text-stone-700">{pet.health.originInfo}</span>
                                  </div>
                                )}
                                {pet.health.timeWithOwner && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">זמן עם הבעלים: </span>
                                    <span className="text-stone-700">{pet.health.timeWithOwner}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Behavior details */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "behavior"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-petra-text">התנהגות</span>
                                {isSectionOpen(pet.id, "behavior") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-amber-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setBehaviorModal({ pet }); }}
                                title="ערוך התנהגות"
                              >
                                <Pencil className="w-3 h-3 text-amber-600" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "behavior") && (activeBehaviorFlags.length > 0 || (() => { try { return JSON.parse(pet.behavior?.customIssues || "[]"); } catch { return []; } })().length > 0 || pet.behavior?.triggers || pet.behavior?.biteDetails || pet.behavior?.priorTrainingDetails) && (
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {activeBehaviorFlags.map(([key, info]) => (
                                    <span
                                      key={key}
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                        SEVERITY_COLORS[info.severity]
                                      )}
                                    >
                                      {info.label}
                                    </span>
                                  ))}
                                  {(() => { try { return JSON.parse(pet.behavior?.customIssues || "[]") as string[]; } catch { return [] as string[]; } })().map((issue: string, idx: number) => (
                                    <span
                                      key={`custom-${idx}`}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-purple-50 text-purple-700 border-purple-200"
                                    >
                                      {issue}
                                    </span>
                                  ))}
                                </div>
                                {pet.behavior?.triggers && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">טריגרים: </span>
                                    <span className="text-stone-700">{pet.behavior.triggers}</span>
                                  </div>
                                )}
                                {pet.behavior?.biteDetails && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">פרטי נשיכה: </span>
                                    <span className="text-stone-700">{pet.behavior.biteDetails}</span>
                                  </div>
                                )}
                                {pet.behavior?.priorTrainingDetails && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">אילוף קודם: </span>
                                    <span className="text-stone-700">{pet.behavior.priorTrainingDetails}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Training Programs — hidden for groomer tier */}
                          {!isGroomer && petPrograms.length > 0 && (
                            <div>
                              <div
                                className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                                onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "training"); }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                                  <span className="text-xs font-bold text-petra-text">
                                    אילוף ({petPrograms.length})
                                  </span>
                                  {isSectionOpen(pet.id, "training") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                                </div>
                                <a
                                  href={`/training?pet=${pet.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-indigo-500 hover:underline"
                                >
                                  פתח אילוף ←
                                </a>
                              </div>
                              {isSectionOpen(pet.id, "training") && (
                                <div className="space-y-2">
                                  {petPrograms.map((prog) => {
                                    const completedSessions = prog.sessions.length;
                                    const totalSessions = prog.totalSessions;
                                    const statusColors: Record<string, string> = {
                                      ACTIVE: "bg-green-100 text-green-700 border-green-200",
                                      PAUSED: "bg-yellow-100 text-yellow-700 border-yellow-200",
                                      COMPLETED: "bg-blue-100 text-blue-700 border-blue-200",
                                      CANCELED: "bg-red-100 text-red-700 border-red-200",
                                    };
                                    const statusLabels: Record<string, string> = {
                                      ACTIVE: "פעיל", PAUSED: "מושהה",
                                      COMPLETED: "הושלם", CANCELED: "בוטל",
                                    };
                                    const achievedGoals = prog.goals.filter(g => g.status === "ACHIEVED").length;
                                    return (
                                      <Link
                                        key={prog.id}
                                        href={`/training?program=${prog.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-white/60 rounded-lg p-2.5 space-y-2 block hover:bg-white transition-colors"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-petra-text">{prog.name}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusColors[prog.status] ?? "bg-slate-100 text-slate-600"}`}>
                                            {statusLabels[prog.status] ?? prog.status}
                                          </span>
                                        </div>
                                        {/* Sessions progress */}
                                        {(totalSessions || completedSessions > 0) && (
                                          <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-stone-500">
                                              <span>מפגשים</span>
                                              <span>{completedSessions}{totalSessions ? `/${totalSessions}` : ""}</span>
                                            </div>
                                            {totalSessions && (
                                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                  className="h-full bg-indigo-400 rounded-full transition-all"
                                                  style={{ width: `${Math.min(100, (completedSessions / totalSessions) * 100)}%` }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {/* Goals */}
                                        {prog.goals.length > 0 && (
                                          <div className="space-y-1">
                                            <p className="text-[10px] text-stone-500 font-medium">
                                              יעדים: {achievedGoals}/{prog.goals.length} הושגו
                                            </p>
                                            {prog.goals.slice(0, 4).map(goal => (
                                              <div key={goal.id} className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                  goal.status === "ACHIEVED" ? "bg-green-500" :
                                                  goal.status === "IN_PROGRESS" ? "bg-indigo-400" : "bg-slate-300"
                                                }`} />
                                                <span className={`text-[10px] flex-1 truncate ${goal.status === "ACHIEVED" ? "line-through text-stone-400" : "text-stone-600"}`}>
                                                  {goal.title}
                                                </span>
                                                {goal.progressPercent > 0 && goal.status !== "ACHIEVED" && (
                                                  <span className="text-[10px] text-indigo-500 font-medium">{goal.progressPercent}%</span>
                                                )}
                                              </div>
                                            ))}
                                            {prog.goals.length > 4 && (
                                              <p className="text-[10px] text-stone-400">+{prog.goals.length - 4} יעדים נוספים</p>
                                            )}
                                          </div>
                                        )}
                                        {prog.notes && (
                                          <p className="text-[10px] text-stone-500 leading-snug">{prog.notes}</p>
                                        )}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          <div className="space-y-1.5">
                            <div className="group flex items-start gap-1.5 bg-white/60 rounded-lg p-2.5">
                              <div className="flex-1 text-[11px]">
                                <span className="text-stone-500 font-medium">הערות רפואיות: </span>
                                <span className="text-stone-700">{pet.medicalNotes || <span className="italic text-stone-400">לא הוזן</span>}</span>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-brand-50 transition-all flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setNoteModal({ petId: pet.id, field: "medicalNotes", label: "הערות רפואיות", value: pet.medicalNotes || "" }); }}
                              >
                                <Pencil className="w-3 h-3 text-brand-500" />
                              </button>
                            </div>
                            <div className="group flex items-start gap-1.5 bg-white/60 rounded-lg p-2.5">
                              <div className="flex-1 text-[11px]">
                                <span className="text-stone-500 font-medium">הערות התנהגות: </span>
                                <span className="text-stone-700">{pet.behaviorNotes || <span className="italic text-stone-400">לא הוזן</span>}</span>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-brand-50 transition-all flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setNoteModal({ petId: pet.id, field: "behaviorNotes", label: "הערות התנהגות", value: pet.behaviorNotes || "" }); }}
                              >
                                <Pencil className="w-3 h-3 text-brand-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Documents button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPetDocs({ id: pet.id, name: pet.name });
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium text-stone-500 hover:text-amber-700 hover:bg-amber-100 transition-colors border border-stone-200 hover:border-amber-200"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {docCount > 0
                          ? `${docCount} מסמכים`
                          : "מסמכים ותמונות"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sales history (leads linked to this customer) */}
          <div id="sales-history" className="scroll-mt-20 empty:hidden">
            <CustomerSalesHistory customerId={customerId} />
          </div>

          {/* Appointments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">
                תורים ({customer.appointments.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary text-xs py-1.5 px-3"
                  onClick={() => setShowNewAppointmentModal(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  קבע תור
                </button>
                <Link href="/calendar" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  יומן
                </Link>
              </div>
            </div>
            {customer.appointments.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">
                אין תורים
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {displayedAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <Link
                        href={`/calendar?date=${String(apt.date).slice(0, 10)}&apt=${apt.id}`}
                        className="contents"
                        title="פתח ועריכת תור ביומן"
                      >
                        <div
                          className="w-1.5 h-8 rounded-full flex-shrink-0"
                          style={{ background: apt.service?.color || "#F97316" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-petra-text">
                            {apt.service?.name || (apt as { priceListItem?: { name: string } | null }).priceListItem?.name || "שירות"}
                          </div>
                          <div className="text-xs text-petra-muted">
                            {new Date(apt.date).toLocaleDateString("he-IL")} ·{" "}
                            {apt.startTime}
                            {apt.pet ? ` · ${apt.pet.name}` : ""}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={cn(
                            "badge text-[10px]",
                            getStatusColor(apt.status)
                          )}
                        >
                          {getStatusLabel(apt.status)}
                        </span>
                        {apt.status === "scheduled" && customer.phone && can("whatsapp_reminders") && perms.canSendMessages && (
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors flex-shrink-0"
                            title="שלח תזכורת WhatsApp"
                            disabled={remindingAptId === apt.id}
                            onClick={() => {
                              setRemindingAptId(apt.id);
                              remindAptMutation.mutate(apt.id);
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {apt.status === "completed" && customer.phone && (() => {
                          const serviceName = apt.service?.name || (apt as { priceListItem?: { name: string } | null }).priceListItem?.name || "הטיפול";
                          const petPart = apt.pet ? ` של ${apt.pet.name}` : "";
                          const msg = `שלום ${customer.name} 😊\n\nרציתי לבדוק איך ${petPart ? apt.pet!.name : "הכלב"} מרגיש/ת אחרי ${serviceName}${petPart}.\n\nאם יש שאלות אנחנו כאן תמיד 🐾`;
                          return (
                            <a
                              href={`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(msg)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex-shrink-0"
                              title="שלח מעקב WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Send className="w-3 h-3" />
                            </a>
                          );
                        })()}
                        {apt.status === "scheduled" && (
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors flex-shrink-0"
                            title="סמן כהושלם"
                            disabled={completingAptId === apt.id}
                            onClick={() => {
                              setCompletingAptId(apt.id);
                              completeAptMutation.mutate(apt.id);
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {customer.appointments.length > 6 && (
                  <button
                    onClick={() =>
                      setShowAllAppointments((v) => !v)
                    }
                    className="w-full mt-3 py-2 text-xs text-petra-muted hover:text-petra-text flex items-center justify-center gap-1 transition-colors"
                  >
                    {showAllAppointments ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        הצג פחות
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        הצג הכל ({customer.appointments.length})
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Payments — hidden for staff (user/volunteer) */}
          {perms.canSeeFinance && (customer.payments || []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-petra-muted" />
                  תשלומים ({customer.payments.length})
                </h2>
                <Link href="/payments" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  הכל
                </Link>
              </div>
              <div className="space-y-2">
                {customer.payments.slice(0, 8).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-petra-text">
                        {formatCurrency(payment.amount)}
                        <span className="text-xs text-petra-muted mr-1">
                          ·{" "}
                          {PAYMENT_METHOD_LABELS[payment.method] ||
                            payment.method}
                        </span>
                      </div>
                      <div className="text-xs text-petra-muted">
                        {payment.appointment?.service?.name ||
                          (payment.boardingStay
                            ? `פנסיון – ${payment.boardingStay.pet?.name}`
                            : "")}
                        {" · "}
                        {new Date(
                          payment.paidAt || payment.createdAt
                        ).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "badge text-[10px]",
                        PAYMENT_STATUS_COLORS[payment.status] || "badge-neutral"
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-petra-muted" />
                הזמנות ({(customer.orders || []).length})
              </h2>
              <button
                onClick={() => openOrderModal()}
                className="btn-ghost text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                הזמנה חדשה
              </button>
            </div>

            {(customer.orders || []).length === 0 ? (
              <div className="empty-state py-6">
                <div className="empty-state-icon">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-sm text-petra-muted mb-3">אין הזמנות עדיין</p>
                <button
                  onClick={() => openOrderModal()}
                  className="btn-primary text-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  צור הזמנה ראשונה
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(customer.orders || []).map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const statusInfo = ORDER_STATUS_INFO[order.status] || { label: order.status, color: "badge-neutral" };
                  const showPayLink = order.status === "draft" || order.status === "confirmed";

                  return (
                    <div key={order.id} className="rounded-xl border border-slate-100 overflow-hidden">
                      {/* Order row */}
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-right"
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart className="w-4 h-4 text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-petra-text">
                            {formatCurrency(order.total)}
                            <span className="text-xs text-petra-muted mr-1">
                              · {order.lines.length} פריטים
                            </span>
                          </div>
                          <div className="text-xs text-petra-muted">
                            {ORDER_TYPE_LABELS[order.orderType] || order.orderType}
                            {" · "}
                            {new Date(order.createdAt).toLocaleDateString("he-IL")}
                          </div>
                        </div>
                        <span className={cn("badge text-[10px]", statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-petra-muted flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-petra-muted flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                          {/* Link to order detail page */}
                          <Link
                            href={`/orders/${order.id}`}
                            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 hover:underline w-fit"
                            onClick={(e) => e.stopPropagation()}
                          >
                            פתח הזמנה ←
                          </Link>
                          {/* Boarding: check-in / check-out dates */}
                          {order.orderType === "boarding" && order.startAt && (
                            <div className="flex items-center gap-4 text-xs bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                              <div className="flex items-center gap-1.5 text-amber-800">
                                <span className="font-semibold">צ׳ק אין:</span>
                                <span>{new Date(order.startAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}</span>
                              </div>
                              {order.endAt && (
                                <>
                                  <span className="text-amber-400">→</span>
                                  <div className="flex items-center gap-1.5 text-amber-800">
                                    <span className="font-semibold">צ׳ק אאוט:</span>
                                    <span>{new Date(order.endAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}</span>
                                  </div>
                                  <span className="text-amber-500 font-medium ms-auto">
                                    {Math.round((new Date(order.endAt).getTime() - new Date(order.startAt).getTime()) / (1000 * 60 * 60 * 24))} לילות
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {/* Training/appointment: date + time */}
                          {(order.orderType === "training" || order.orderType === "appointment") && order.startAt && (
                            <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-blue-800">
                              <span className="font-semibold">תאריך ושעה:</span>
                              <span>{new Date(order.startAt).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
                              <span>{new Date(order.startAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          )}
                          {/* Line items */}
                          <div className="space-y-1.5">
                            {order.lines.map((line) => (
                              <div key={line.id} className="flex items-center justify-between text-sm">
                                <span className="text-petra-text">{line.name}</span>
                                <div className="flex items-center gap-3 text-petra-muted">
                                  <span className="text-xs">{line.quantity} × {formatCurrency(line.unitPrice)}</span>
                                  <span className="font-medium text-petra-text w-16 text-right">
                                    {formatCurrency(line.lineSubtotal ?? line.lineTotal)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Totals breakdown */}
                          <div className="border-t border-slate-200 pt-2 space-y-1">
                            {order.discountAmount > 0 && (
                              <div className="flex justify-between text-xs text-emerald-600">
                                <span>הנחה</span>
                                <span dir="ltr">−{formatCurrency(order.discountAmount)}</span>
                              </div>
                            )}
                            {order.taxTotal > 0 && (
                              <div className="flex justify-between text-xs text-petra-muted">
                                <span>מע&quot;מ</span>
                                <span dir="ltr">{formatCurrency(order.taxTotal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-petra-text">
                              <span>סה&quot;כ</span>
                              <span dir="ltr">{formatCurrency(order.total)}</span>
                            </div>
                          </div>

                          {/* Payment request link */}
                          {showPayLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Send from the order page so the request stays linked to THIS order
                                router.push(`/orders/${order.id}`);
                              }}
                              className="flex items-center gap-2 p-2.5 bg-brand-50 border border-brand-100 rounded-xl w-full text-start hover:bg-brand-100 transition-colors"
                            >
                              <Link2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                              <span className="text-xs text-brand-700 flex-1 font-medium">
                                שלח בקשת תשלום
                              </span>
                            </button>
                          )}

                          {/* Notes */}
                          {order.notes && (
                            <div className="text-xs text-petra-muted">
                              <span className="font-medium">הערות:</span> {order.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Training Programs — hidden for groomer tier */}
          {!isGroomer && (customer.trainingPrograms || []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-petra-muted" />
                  תוכניות אימון ({customer.trainingPrograms.length})
                </h2>
                <Link href="/training" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  הכל
                </Link>
              </div>
              <div className="space-y-3">
                {customer.trainingPrograms.map((program) => (
                  <Link
                    key={program.id}
                    href={`/training?program=${program.id}`}
                    className="block p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-petra-text">
                          {program.name}
                        </span>
                        {program.dog && (
                          <span className="text-xs text-petra-muted mr-1">
                            · {program.dog.name}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "badge text-[10px]",
                          PROGRAM_STATUS_COLORS[program.status] ||
                            "badge-neutral"
                        )}
                      >
                        {PROGRAM_STATUS_LABELS[program.status] ||
                          program.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-petra-muted mb-2">
                      <span>
                        {PROGRAM_TYPE_LABELS[program.programType] ||
                          program.programType}
                      </span>
                      <span>·</span>
                      <span>{program.totalSessions} מפגשים</span>
                    </div>
                    {program.goals.length > 0 && (
                      <div className="space-y-1.5">
                        {program.goals.slice(0, 3).map((goal) => (
                          <div key={goal.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs text-petra-text">
                                  {goal.title}
                                </span>
                                <span className="text-[10px] text-petra-muted">
                                  {goal.progressPercent}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${goal.progressPercent}%`,
                                    background:
                                      goal.progressPercent >= 100
                                        ? "#10B981"
                                        : "#F97316",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Contracts */}
          <SendContractSection customerId={customerId} customerName={customer.name} pets={customer.pets.map((p) => ({ id: p.id, name: p.name }))} />

          {/* Customer Documents */}
          <CustomerDocumentsSection
            customerId={customerId}
            documentsJson={customer.documents || "[]"}
          />

          {/* Timeline */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">ציר זמן</h2>
              <button
                onClick={() => setShowLogNote((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all",
                  showLogNote
                    ? "bg-brand-500 text-white"
                    : "btn-ghost text-petra-muted"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                רשום הערה
              </button>
            </div>

            {/* Log progress inline */}
            {showLogNote && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <textarea
                  className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-stone-400 text-petra-text min-h-[72px]"
                  placeholder="הוסף הערת התקדמות, תצפית, או פעילות..."
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                />
                <div className="flex gap-2 justify-end mt-2">
                  <button
                    onClick={() => {
                      setShowLogNote(false);
                      setLogNote("");
                    }}
                    className="text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={() => logMutation.mutate(logNote)}
                    disabled={!logNote.trim() || logMutation.isPending}
                    className="btn-primary text-xs py-1.5 px-4"
                  >
                    {logMutation.isPending ? "שומר..." : "שמור"}
                  </button>
                </div>
              </div>
            )}

            {customer.timelineEvents.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">
                אין אירועים
              </p>
            ) : (
              <div className="space-y-3">
                {customer.timelineEvents.map((event) => {
                  const Icon = getTimelineIcon(event.type);
                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm text-petra-text">
                          {event.description}
                        </p>
                        <p className="text-xs text-petra-muted mt-0.5">
                          {new Date(event.createdAt).toLocaleDateString(
                            "he-IL"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddPetModal
        customerId={customerId}
        isOpen={showPetModal}
        onClose={() => setShowPetModal(false)}
      />
      <EditCustomerModal
        customer={customer}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
      {showWaCompose && (
        <WhatsAppComposeModal
          customerId={customer.id}
          customerName={customer.name}
          customerPhone={customer.phone}
          onClose={() => setShowWaCompose(false)}
          onSent={() => {
            setShowWaCompose(false);
            queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
          }}
        />
      )}
      {selectedPetDocs && (
        <PetDocumentsModal
          petId={selectedPetDocs.id}
          petName={selectedPetDocs.name}
          customerId={customerId}
          isOpen={!!selectedPetDocs}
          onClose={() => setSelectedPetDocs(null)}
        />
      )}
      <CreateOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        prefillCustomerId={customerId}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
        }}
      />
      {showNewAppointmentModal && customer && (
        <NewAppointmentModal
          customer={customer}
          onClose={() => setShowNewAppointmentModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
          }}
        />
      )}
      {showQuickTaskModal && customer && (
        <QuickTaskModal
          customerId={customerId}
          customerName={customer.name}
          onClose={() => setShowQuickTaskModal(false)}
          onSuccess={() => {
            // tasks are on /tasks page, no need to refresh this page
          }}
        />
      )}
      {medModal && (
        <MedicationModal
          petId={medModal.petId}
          petName={medModal.petName}
          med={medModal.med}
          customerId={customerId}
          onClose={() => setMedModal(null)}
        />
      )}
      {healthModal && (
        <EditHealthModal
          petId={healthModal.pet.id}
          petName={healthModal.pet.name}
          health={healthModal.pet.health}
          customerId={customerId}
          onClose={() => setHealthModal(null)}
        />
      )}
      {behaviorModal && (
        <EditBehaviorModal
          petId={behaviorModal.pet.id}
          petName={behaviorModal.pet.name}
          behavior={behaviorModal.pet.behavior}
          customerId={customerId}
          onClose={() => setBehaviorModal(null)}
        />
      )}
      {noteModal && (
        <EditPetNoteModal
          petId={noteModal.petId}
          field={noteModal.field}
          label={noteModal.label}
          value={noteModal.value}
          customerId={customerId}
          onClose={() => setNoteModal(null)}
        />
      )}
      {editPetModal && (
        <EditPetModal
          pet={editPetModal.pet}
          customerId={customerId}
          onClose={() => setEditPetModal(null)}
        />
      )}
      {deletingPetId && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeletingPetId(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-petra-text mb-2">בקשת מחיקת חיית מחמד</h3>
            <p className="text-sm text-petra-muted mb-5">
              הבקשה תישלח לאישור הבעלים לפני ביצוע המחיקה. האם להמשיך?
            </p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700"
                disabled={deletePetMutation.isPending}
                onClick={() => deletePetMutation.mutate({ petId: deletingPetId })}
              >
                {deletePetMutation.isPending ? "שולח..." : "שלח לאישור"}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeletingPetId(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
      {feedingModal && (
        <EditFeedingModal
          petId={feedingModal.pet.id}
          petName={feedingModal.pet.name}
          pet={feedingModal.pet}
          customerId={customerId}
          onClose={() => setFeedingModal(null)}
        />
      )}
      {deletingMed && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeletingMed(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <h2 className="text-base font-bold text-petra-text mb-2">מחיקת תרופה</h2>
            <p className="text-sm text-petra-muted mb-6">האם למחוק את התרופה? פעולה זו אינה הפיכה.</p>
            <div className="flex gap-3">
              <button
                className="btn-danger flex-1"
                disabled={deleteMedMutation.isPending}
                onClick={() => deleteMedMutation.mutate(deletingMed)}
              >
                {deleteMedMutation.isPending ? "מוחק..." : "מחק"}
              </button>
              <button className="btn-secondary" onClick={() => setDeletingMed(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner double-confirm delete modal */}
      <ConfirmDeleteModal
        open={showConfirmDeleteModal}
        onClose={() => setShowConfirmDeleteModal(false)}
        onConfirm={() => deleteCustomerMutation.mutate()}
        title="מחיקת לקוח"
        confirmText={customer?.name ?? ""}
        description="מחיקת הלקוח תסיר את כל הפגישות, התשלומים ותוכניות האימון המשויכות. פעולה זו אינה ניתנת לביטול."
        loading={deleteCustomerMutation.isPending}
      />

      {/* Owner double-confirm pet delete modal */}
      {deletingPetOwner && (
        <ConfirmDeleteModal
          open
          onClose={() => setDeletingPetOwner(null)}
          onConfirm={() =>
            deletePetMutation.mutate({
              petId: deletingPetOwner.id,
              confirmAction: `DELETE_PET_${deletingPetOwner.id}`,
            })
          }
          title="מחיקת חיית מחמד"
          confirmText={deletingPetOwner.name}
          description={`מחיקת ${deletingPetOwner.name} תסיר את כל הנתונים הרפואיים, המשקל וההיסטוריה המשויכים. פעולה זו אינה ניתנת לביטול.`}
          loading={deletePetMutation.isPending}
        />
      )}
    </div>
    </CustomerPermGate>
  );
}
