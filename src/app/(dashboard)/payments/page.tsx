"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CreditCard,
  Plus,
  X,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

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
  customer: { name: string; phone: string };
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
  const [showNewPayment, setShowNewPayment] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payments", activeStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      return fetch(`/api/payments?${params}`).then((r) => r.json());
    },
  });

  // Summary stats
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">תשלומים</h1>
          <p className="text-sm text-petra-muted mt-1">{payments.length} תשלומים</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewPayment(true)}>
          <Plus className="w-4 h-4" />
          תשלום חדש
        </button>
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
      <div className="flex gap-1.5 mb-6">
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

      {/* Payments Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תשלומים</h3>
          <p className="text-sm text-petra-muted mb-4">צור תשלום חדש כדי להתחיל</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-petra-border">
                  <th className="table-header-cell">לקוח</th>
                  <th className="table-header-cell">סכום</th>
                  <th className="table-header-cell">אמצעי תשלום</th>
                  <th className="table-header-cell">שיוך</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
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
                          <p className="text-sm font-medium text-petra-text">
                            {payment.customer.name}
                          </p>
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
    queryFn: () => fetch("/api/customers?full=1").then((r) => r.json()),
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
    onSuccess,
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
