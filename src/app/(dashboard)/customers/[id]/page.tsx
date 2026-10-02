"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchJSON } from "@/lib/utils";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerSalesHistory, useCustomerSalesHistory } from "@/components/customers/CustomerSalesHistory";
import { MergeCustomerModal } from "@/components/customers/MergeCustomerModal";
import { AppointmentsSection } from "@/components/customers/detail/AppointmentsSection";
import { ContactCard } from "@/components/customers/detail/ContactCard";
import { CustomerDocumentsSection } from "@/components/customers/detail/CustomerDocumentsSection";
import { CustomerHeader } from "@/components/customers/detail/CustomerHeader";
import { EditCustomerModal } from "@/components/customers/detail/EditCustomerModal";
import { NewAppointmentModal } from "@/components/customers/detail/NewAppointmentModal";
import { OrdersSection } from "@/components/customers/detail/OrdersSection";
import { PaymentsSection } from "@/components/customers/detail/PaymentsSection";
import { PetsSection } from "@/components/customers/detail/PetsSection";
import { QuickTaskModal } from "@/components/customers/detail/QuickTaskModal";
import { RecordPaymentModal } from "@/components/customers/detail/RecordPaymentModal";
import { SectionNav, type SectionNavItem } from "@/components/customers/detail/SectionNav";
import { SendContractSection } from "@/components/customers/detail/SendContractSection";
import { SummaryStrip } from "@/components/customers/detail/SummaryStrip";
import { TimelineSection } from "@/components/customers/detail/TimelineSection";
import { PackageTracking, TrainingProgramsCard } from "@/components/customers/detail/TrainingSections";
import { WhatsAppComposeModal } from "@/components/customers/detail/WhatsAppComposeModal";
import { useIntakeFormSender } from "@/components/customers/detail/customer-actions";
import type { CustomerDetail } from "@/components/customers/detail/types";

const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);

export default function CustomerProfilePage() {
  const perms = usePermissions();
  if (!perms.canSeePii) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldOff className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-petra-text mb-2">אין הרשאה</h2>
        <p className="text-sm text-petra-muted">אין לך הרשאה לצפות בפרטי לקוחות. פנה למנהל העסק.</p>
      </div>
    );
  }
  return <CustomerProfile />;
}

type ModalName = "edit" | "order" | "appointment" | "task" | "compose" | "payment" | "delete" | "merge";

function CustomerProfile() {
  const params = useParams();
  const customerId = params.id as string;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { isGroomer, can } = usePlan();
  const perms = usePermissions();
  const [modal, setModal] = useState<ModalName | null>(null);
  const closeModal = () => setModal(null);

  const { data: customer, isLoading, isError, error } = useQuery<CustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}`).then(async (r) => {
        if (r.status === 404) throw new Error("CUSTOMER_NOT_FOUND");
        if (!r.ok) throw new Error("FETCH_ERROR");
        return r.json();
      }),
    // No polling — mutations invalidate ["customer", id]; refresh when the tab regains focus.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, err) => (err as Error)?.message !== "CUSTOMER_NOT_FOUND" && failureCount < 2,
  });
  const { data: salesHistory } = useCustomerSalesHistory(customerId);
  const intake = useIntakeFormSender({ id: customerId, name: customer?.name ?? "", phone: customer?.phone ?? "" });

  // Typed confirmation first; the server answers 202 pendingApproval for a manager without CRITICAL_DELETE.
  const deleteCustomerMutation = useMutation<Record<string, unknown>>({
    mutationFn: () =>
      fetchJSON(`/api/customers/${customerId}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_CUSTOMER_${customerId}` },
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data) => {
      closeModal();
      if (data?.pendingApproval) {
        toast.success("הבקשה נשלחה לאישור הבעלים");
        return;
      }
      toast.success("הלקוח נמחק");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push("/customers");
    },
    onError: (e: Error) => {
      closeModal();
      toast.error(e?.message || "שגיאה במחיקת הלקוח. נסה שוב.");
    },
  });

  if (isLoading) return <PetraLoader />;

  if (isError || !customer) {
    const isNotFound = (error as Error)?.message === "CUSTOMER_NOT_FOUND" || !customer;
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center" dir="rtl">
        <div className="text-6xl">{isNotFound ? "🔍" : "⚠️"}</div>
        <h2 className="text-xl font-bold text-petra-text">{isNotFound ? "לקוח לא נמצא" : "שגיאה בטעינת הדף"}</h2>
        <p className="text-sm text-petra-muted max-w-xs">
          {isNotFound ? "הלקוח שחיפשת לא קיים או שהקישור שגוי" : "משהו השתבש. אנא נסה לרענן את הדף."}
        </p>
        <Link href="/customers" className="btn-primary mt-2">חזרה לרשימת הלקוחות</Link>
      </div>
    );
  }

  // Capabilities (flags only). Writing customers = CUSTOMERS_PII + CONTENT_WRITE on the server;
  // the client has no CONTENT_WRITE flag yet, and this page is already gated by canSeePii.
  const canWriteCustomer = perms.canSeePii;
  // Manager without CRITICAL_DELETE → the server opens a pending approval (existing flow).
  const canDelete = perms.canCriticalDelete || perms.isManager;
  const deleteIsRequest = !perms.canCriticalDelete;
  const hasPhone = !!customer.phone?.trim();
  const invalidateCustomer = () => queryClient.invalidateQueries({ queryKey: ["customer", customerId] });

  const openOrderModal = () => {
    if (!customer.pets?.length) {
      toast.error("חובה להוסיף חיית מחמד ללקוח לפני יצירת הזמנה", { description: "לחץ על 'הוסף' בקטע חיות המחמד" });
      return;
    }
    setModal("order");
  };
  const openCompose = () => {
    if (!hasPhone) return toast.error("אין מספר טלפון ללקוח");
    setModal("compose");
  };

  const navItems: SectionNavItem[] = [
    { id: "pets", label: "חיות" },
    { id: "appointments", label: "תורים" },
    { id: "finance", label: "כספים" },
    ...(salesHistory?.leads?.length ? [{ id: "sales-history", label: "מכירות" }] : []),
    { id: "documents", label: "מסמכים" },
    { id: "timeline", label: "ציר זמן" },
  ];

  return (
    <div className="space-y-5 min-w-0">
      <CustomerHeader
        customer={customer}
        businessSlug={user?.businessSlug}
        canSendMessages={perms.canSendMessages}
        canWritePayments={perms.canWritePayments}
        canDelete={canDelete}
        deleteIsRequest={deleteIsRequest}
        canMerge={perms.canCriticalDelete}
        intakeSending={intake.sending}
        onNewAppointment={() => setModal("appointment")}
        onNewTask={() => setModal("task")}
        onNewOrder={openOrderModal}
        onCompose={openCompose}
        onSendIntake={intake.send}
        onDelete={() => setModal("delete")}
        onMerge={() => setModal("merge")}
      />

      <SummaryStrip
        summary={customer.summary}
        canSeeFinance={perms.canSeeFinance}
        canWritePayments={perms.canWritePayments}
        onBook={() => setModal("appointment")}
        onRecordPayment={() => setModal("payment")}
      />

      <SectionNav items={navItems} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Side column ── */}
        <div className="space-y-4 min-w-0">
          <ContactCard
            customer={customer}
            canEdit={canWriteCustomer}
            canSendMessages={perms.canSendMessages}
            onEdit={() => setModal("edit")}
            onCompose={openCompose}
          />
          {!isGroomer && <PackageTracking programs={customer.trainingPrograms || []} />}
        </div>

        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <PetsSection
            customer={customer}
            isGroomer={isGroomer}
            canSendMessages={perms.canSendMessages}
            canDelete={canDelete}
            deleteIsRequest={deleteIsRequest}
          />

          <div id="sales-history" className="scroll-mt-32 empty:hidden">
            <CustomerSalesHistory customerId={customerId} />
          </div>

          <AppointmentsSection
            customer={customer}
            canSendMessages={perms.canSendMessages}
            canRemind={perms.canSendMessages && can("whatsapp_reminders")}
            onNewAppointment={() => setModal("appointment")}
          />

          <div id="finance" className="space-y-6 scroll-mt-32">
            {perms.canSeeFinance && (
              <PaymentsSection customer={customer} canWritePayments={perms.canWritePayments} onRecordPayment={() => setModal("payment")} />
            )}
            <OrdersSection
              orders={customer.orders || []}
              total={customer.summary?.counts.orders ?? (customer.orders || []).length}
              canSeeFinance={perms.canSeeFinance}
              canWritePayments={perms.canWritePayments}
              onNewOrder={openOrderModal}
            />
          </div>

          {!isGroomer && <TrainingProgramsCard programs={customer.trainingPrograms || []} />}

          <div id="documents" className="space-y-6 scroll-mt-32">
            <SendContractSection customerId={customerId} customerName={customer.name} pets={customer.pets.map((p) => ({ id: p.id, name: p.name }))} />
            <CustomerDocumentsSection customerId={customerId} documentsJson={customer.documents || "[]"} />
          </div>

          <TimelineSection customerId={customerId} canWrite={canWriteCustomer} />
        </div>
      </div>

      {/* Modals — mounted only while open (several fetch on mount) */}
      {modal === "edit" && <EditCustomerModal customer={customer} isOpen onClose={closeModal} />}
      {modal === "order" && (
        <CreateOrderModal isOpen onClose={closeModal} prefillCustomerId={customerId} onCreated={invalidateCustomer} />
      )}
      {modal === "appointment" && (
        <NewAppointmentModal customer={customer} onClose={closeModal} onSuccess={invalidateCustomer} />
      )}
      {modal === "task" && (
        <QuickTaskModal customerId={customerId} customerName={customer.name} onClose={closeModal} onSuccess={() => undefined} />
      )}
      {modal === "compose" && perms.canSendMessages && (
        <WhatsAppComposeModal
          customerId={customer.id}
          customerName={customer.name}
          customerPhone={customer.phone}
          onClose={closeModal}
          onSent={() => {
            closeModal();
            invalidateCustomer();
          }}
        />
      )}
      {modal === "payment" && perms.canWritePayments && (
        <RecordPaymentModal
          customerId={customerId}
          customerName={customer.name}
          orders={customer.orders || []}
          defaultAmount={customer.summary?.balance?.outstanding}
          onClose={closeModal}
        />
      )}
      {modal === "merge" && perms.canCriticalDelete && (
        <MergeCustomerModal
          targetId={customerId}
          targetName={customer.name}
          onClose={closeModal}
          onMerged={() => {
            closeModal();
            invalidateCustomer();
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            toast.success("הלקוחות מוזגו בהצלחה");
          }}
        />
      )}
      <ConfirmDeleteModal
        open={modal === "delete"}
        onClose={closeModal}
        onConfirm={() => deleteCustomerMutation.mutate()}
        title={deleteIsRequest ? "בקשת מחיקת לקוח" : "מחיקת לקוח"}
        confirmText={customer.name}
        description={
          deleteIsRequest
            ? "הבקשה תישלח לאישור הבעלים. לאחר האישור יימחקו הלקוח, הפגישות, התשלומים ותוכניות האימון המשויכים."
            : "מחיקת הלקוח תסיר את כל הפגישות, התשלומים ותוכניות האימון המשויכות. פעולה זו אינה ניתנת לביטול."
        }
        loading={deleteCustomerMutation.isPending}
      />
    </div>
  );
}
