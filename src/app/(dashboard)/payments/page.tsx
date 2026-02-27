"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  X,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  FileText,
  Loader2,
  MessageCircle,
  Trash2,
  Search,
  Download,
} from "lucide-react";
import { cn, formatCurrency, formatDate, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  isDeposit: boolean;
  invoiceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  appointment: { service: { name: string } } | null;
  boardingStay: { pet: { name: string }; room: { name: string } } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

const PAYMENT_STATUSES = [
  { id: "ALL", label: "הכל" },
  { id: "pending", label: "ממתין" },
  { id: "paid", label: "שולם" },
  { id: "canceled", label: "בוטל" },
];

const DATE_PERIODS = [
  { id: "ALL", label: "כל הזמן" },
  { id: "today", label: "היום" },
  { id: "week", label: "השבוע" },
  { id: "month", label: "החודש" },
];

function isInPeriod(dateStr: string, period: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return date >= startOfDay;
  if (period === "week") {
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    return date >= startOfWeek;
  }
  if (period === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return date >= startOfMonth;
  }
  return true;
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "ממתין", color: "#F59E0B", icon: Clock },
  paid: { label: "שולם", color: "#22C55E", icon: CheckCircle2 },
  canceled: { label: "בוטל", color: "#EF4444", icon: XCircle },
};

const METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  bit: "ביט",
  paybox: "פייבוקס",
  check: "צ'ק",
};

export default function PaymentsPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [activePeriod, setActivePeriod] = useState("ALL");
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [issuingPaymentId, setIssuingPaymentId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading, isError } = useQuery<Payment[]>({
    queryKey: ["payments", activeStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      return fetchJSON(`/api/payments?${params}`);
    },
  });

  // Fetch ALL payments for summary stats (unfiltered)
  const { data: allPayments = [] } = useQuery<Payment[]>({
    queryKey: ["payments", "ALL"],
    queryFn: () => fetchJSON("/api/payments"),
  });

  // Check if invoicing is configured
  const { data: invoicingSettings } = useQuery<{ status: string } | null>({
    queryKey: ["invoicing-settings"],
    queryFn: () => fetchJSON("/api/invoicing/settings"),
  });
  const invoicingConfigured = invoicingSettings?.status === "active";

  const markPaidMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetchJSON(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setMarkingPaidId(null);
      toast.success("התשלום סומן כשולם");
    },
    onError: () => {
      setMarkingPaidId(null);
      toast.error("שגיאה בעדכון התשלום. נסה שוב.");
    },
  });

  const cancelPaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetchJSON(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("התשלום בוטל");
    },
    onError: () => toast.error("שגיאה בביטול התשלום. נסה שוב."),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetchJSON(`/api/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setConfirmDeleteId(null);
      toast.success("התשלום נמחק");
    },
    onError: () => {
      setConfirmDeleteId(null);
      toast.error("שגיאה במחיקת התשלום. נסה שוב.");
    },
  });

  const issueMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetch("/api/invoicing/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "שגיאה בהפקת מסמך");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setIssuingPaymentId(null);
      toast.success("המסמך הופק בהצלחה");
    },
    onError: (err: Error) => {
      setIssuingPaymentId(null);
      toast.error(err.message || "שגיאה בהפקת המסמך. נסה שוב.");
    },
  });

  // Filter payments by customer name search and date period
  const filteredPayments = payments.filter((p) => {
    if (searchQuery.trim() && !p.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activePeriod !== "ALL" && !isInPeriod(p.createdAt, activePeriod)) return false;
    return true;
  });

  // Summary stats from unfiltered data
  const totalPaid = allPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = allPayments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidCount = allPayments.filter((p) => p.status === "paid").length;
  const pendingCount = allPayments.filter((p) => p.status === "pending").length;

  function exportCSV() {
    const rows = [
      ["תאריך", "לקוח", "סכום", "אמצעי תשלום", "סטטוס", "שירות", "מספר חשבונית"],
      ...filteredPayments.map((p) => [
        formatDate(p.createdAt),
        p.customer.name,
        p.amount.toString(),
        METHOD_LABELS[p.method] || p.method,
        STATUS_INFO[p.status]?.label || p.status,
        p.appointment?.service.name || (p.boardingStay ? `פנסיון — ${p.boardingStay.pet.name}` : ""),
        p.invoiceNumber || "",
      ]),
    ];
    const csvContent = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `תשלומים_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">תשלומים</h1>
        <p className="text-sm text-petra-muted">
          {searchQuery.trim() ? `${filteredPayments.length} מתוך ${payments.length}` : payments.length} תשלומים
        </p>
        <button className="btn-primary" onClick={() => setShowNewPayment(true)}>
          <Plus className="w-4 h-4" />
          תשלום חדש
        </button>
        <button
          className="btn-secondary"
          onClick={exportCSV}
          disabled={filteredPayments.length === 0}
          title="ייצוא לקובץ CSV"
        >
          <Download className="w-4 h-4" />
          ייצוא CSV
        </button>
        <div className="relative mr-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
          <input
            type="text"
            placeholder="חפש לפי לקוח..."
            className="input pr-9 pl-3 text-sm w-44 sm:w-56"
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-xs text-petra-muted">שולם</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(totalPaid)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{paidCount} תשלומים</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-petra-muted">ממתין</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(totalPending)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{pendingCount} תשלומים</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-petra-muted">סה״כ</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(totalPaid + totalPending)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{payments.length} תשלומים</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-brand-500" />
            </div>
            <span className="text-xs text-petra-muted">ממוצע</span>
          </div>
          <span className="text-lg font-bold text-petra-text">
            {payments.length > 0 ? formatCurrency((totalPaid + totalPending) / payments.length) : "₪0"}
          </span>
          <span className="text-[10px] text-petra-muted block mt-0.5">לתשלום</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1.5">
          {PAYMENT_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStatus(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeStatus === s.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {DATE_PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePeriod(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activePeriod === p.id
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : isError ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">שגיאה בטעינת התשלומים</h3>
          <p className="text-sm text-petra-muted">נסה לרענן את הדף</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {searchQuery.trim() ? "לא נמצאו תשלומים" : "אין תשלומים"}
          </h3>
          <p className="text-sm text-petra-muted mb-4">
            {searchQuery.trim() ? "נסה חיפוש אחר" : "צור תשלום חדש כדי להתחיל"}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-petra-border">
            {filteredPayments.map((payment) => {
              const statusInfo = STATUS_INFO[payment.status] || STATUS_INFO.pending;
              const StatusIcon = statusInfo.icon;
              const association = payment.appointment
                ? `תור: ${payment.appointment.service.name}`
                : payment.boardingStay
                ? `פנסיון: ${payment.boardingStay.pet.name}`
                : null;
              return (
                <div key={payment.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/customers/${payment.customer.id}`}
                        className="text-sm font-medium text-petra-text hover:text-brand-600 transition-colors"
                      >
                        {payment.customer.name}
                      </Link>
                      <p className="text-xs text-petra-muted">{payment.customer.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-petra-text">
                        {formatCurrency(payment.amount)}
                        {payment.isDeposit && (
                          <span className="badge-warning text-[9px] mr-1">מקדמה</span>
                        )}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-petra-muted">
                    <span>{METHOD_LABELS[payment.method] || payment.method}</span>
                    <span>{formatDate(payment.createdAt)}</span>
                  </div>
                  {association && (
                    <p className="text-xs text-petra-muted mt-0.5">{association}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {payment.status === "pending" && (
                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors"
                        disabled={markingPaidId === payment.id}
                        onClick={() => {
                          setMarkingPaidId(payment.id);
                          markPaidMutation.mutate(payment.id);
                        }}
                      >
                        {markingPaidId === payment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        סמן כשולם
                      </button>
                    )}
                    {payment.invoiceNumber ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <FileText className="w-3 h-3" />
                        {payment.invoiceNumber}
                      </span>
                    ) : payment.status === "paid" && invoicingConfigured ? (
                      <button
                        className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                        disabled={issuingPaymentId === payment.id}
                        onClick={() => {
                          setIssuingPaymentId(payment.id);
                          issueMutation.mutate(payment.id);
                        }}
                      >
                        {issuingPaymentId === payment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        הפק מסמך
                      </button>
                    ) : null}
                    {payment.status === "paid" && payment.customer.phone && (
                      <a
                        href={`https://wa.me/${toWhatsAppPhone(payment.customer.phone)}?text=${encodeURIComponent(`שלום ${payment.customer.name}!\nקיבלנו את תשלומך בסך ${formatCurrency(payment.amount)} - תודה רבה! 🙏`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                        title="שלח אישור תשלום בוואטסאפ"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        קבלה
                      </a>
                    )}
                    {payment.status === "pending" && (
                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                        onClick={() => cancelPaymentMutation.mutate(payment.id)}
                        disabled={cancelPaymentMutation.isPending}
                      >
                        <XCircle className="w-3 h-3" />
                        בטל
                      </button>
                    )}
                    {confirmDeleteId === payment.id ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <button
                          className="text-red-600 font-medium hover:underline"
                          onClick={() => deletePaymentMutation.mutate(payment.id)}
                          disabled={deletePaymentMutation.isPending}
                        >
                          {deletePaymentMutation.isPending ? "מוחק..." : "מחק"}
                        </button>
                        <button
                          className="text-petra-muted hover:underline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          ביטול
                        </button>
                      </span>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-1 py-1 rounded transition-colors"
                        onClick={() => setConfirmDeleteId(payment.id)}
                        title="מחק תשלום"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-petra-border">
                  <th className="table-header-cell">לקוח</th>
                  <th className="table-header-cell">סכום</th>
                  <th className="table-header-cell">אמצעי תשלום</th>
                  <th className="table-header-cell">שיוך</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell">מסמך</th>
                  <th className="table-header-cell">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const statusInfo = STATUS_INFO[payment.status] || STATUS_INFO.pending;
                  const StatusIcon = statusInfo.icon;
                  const association = payment.appointment
                    ? `תור: ${payment.appointment.service.name}`
                    : payment.boardingStay
                    ? `פנסיון: ${payment.boardingStay.pet.name}`
                    : "—";

                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-petra-border last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="table-cell">
                        <div>
                          <Link
                            href={`/customers/${payment.customer.id}`}
                            className="text-sm font-medium text-petra-text hover:text-brand-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {payment.customer.name}
                          </Link>
                          <p className="text-[10px] text-petra-muted">
                            {payment.customer.phone}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm font-semibold text-petra-text">
                          {formatCurrency(payment.amount)}
                        </span>
                        {payment.isDeposit && (
                          <span className="badge-warning text-[9px] mr-1">מקדמה</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-sm text-petra-text">
                          {METHOD_LABELS[payment.method] || payment.method}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-petra-muted">{association}</span>
                      </td>
                      <td className="table-cell">
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: `${statusInfo.color}15`,
                            color: statusInfo.color,
                          }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2 flex-wrap">
                          {payment.status === "pending" && (
                            <button
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors"
                              disabled={markingPaidId === payment.id}
                              onClick={() => {
                                setMarkingPaidId(payment.id);
                                markPaidMutation.mutate(payment.id);
                              }}
                            >
                              {markingPaidId === payment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              סמן כשולם
                            </button>
                          )}
                          {payment.invoiceNumber ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <FileText className="w-3 h-3" />
                              {payment.invoiceNumber}
                            </span>
                          ) : payment.status === "paid" && invoicingConfigured ? (
                            <button
                              className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                              disabled={issuingPaymentId === payment.id}
                              onClick={() => {
                                setIssuingPaymentId(payment.id);
                                issueMutation.mutate(payment.id);
                              }}
                            >
                              {issuingPaymentId === payment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              הפק מסמך
                            </button>
                          ) : payment.status !== "pending" ? (
                            <span className="text-xs text-petra-muted">—</span>
                          ) : null}
                          {payment.status === "paid" && payment.customer.phone && (
                            <a
                              href={`https://wa.me/${toWhatsAppPhone(payment.customer.phone)}?text=${encodeURIComponent(`שלום ${payment.customer.name}!\nקיבלנו את תשלומך בסך ${formatCurrency(payment.amount)} - תודה רבה! 🙏`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              title="שלח אישור תשלום בוואטסאפ"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {payment.status === "pending" && (
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => cancelPaymentMutation.mutate(payment.id)}
                              disabled={cancelPaymentMutation.isPending}
                              title="בטל תשלום"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {confirmDeleteId === payment.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              <button
                                className="text-red-600 font-medium hover:underline"
                                onClick={() => deletePaymentMutation.mutate(payment.id)}
                                disabled={deletePaymentMutation.isPending}
                              >
                                {deletePaymentMutation.isPending ? "..." : "מחק"}
                              </button>
                              <button
                                className="text-petra-muted hover:underline"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                לא
                              </button>
                            </span>
                          ) : (
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => setConfirmDeleteId(payment.id)}
                              title="מחק תשלום"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-petra-muted">
                          {formatDate(payment.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Payment Modal */}
      {showNewPayment && (
        <NewPaymentModal
          onClose={() => setShowNewPayment(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            setShowNewPayment(false);
          }}
        />
      )}
    </div>
  );
}

// --- New Payment Modal ---
function NewPaymentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    customerId: "",
    amount: "",
    method: "cash",
    status: "paid",
    notes: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-payment"],
    queryFn: () => fetchJSON("/api/customers?full=1"),
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.includes(customerSearch) || c.phone.includes(customerSearch)
  );

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      toast.success("התשלום נרשם בהצלחה");
      onSuccess();
    },
    onError: () => toast.error("שגיאה ברישום התשלום. נסה שוב."),
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">תשלום חדש</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer Selection */}
          <div>
            <label className="label">לקוח *</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-petra-text">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-[10px] text-petra-muted">
                    {selectedCustomer.phone}
                  </p>
                </div>
                <button
                  onClick={() => setForm({ ...form, customerId: "" })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  שנה
                </button>
              </div>
            ) : (
              <div>
                <input
                  className="input mb-2"
                  placeholder="חפש לקוח..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customerSearch && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-petra-border">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-petra-muted p-2">לא נמצאו לקוחות</p>
                    ) : (
                      filteredCustomers.slice(0, 5).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setForm({ ...form, customerId: c.id });
                            setCustomerSearch("");
                          }}
                          className="w-full text-right p-2 hover:bg-slate-50 text-sm"
                        >
                          {c.name} - {c.phone}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label">סכום (₪) *</label>
            <input
              type="number"
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              min="0"
              step="0.01"
            />
          </div>

          {/* Method & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">אמצעי תשלום</label>
              <select
                className="input"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">סטטוס</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="paid">שולם</option>
                <option value="pending">ממתין</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.customerId || !form.amount || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            <Plus className="w-4 h-4" />
            {createMutation.isPending ? "שומר..." : "צור תשלום"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
