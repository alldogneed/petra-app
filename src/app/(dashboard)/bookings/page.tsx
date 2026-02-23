"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Phone,
  Copy,
} from "lucide-react";
import { cn, DEMO_BUSINESS_ID } from "@/lib/utils";

interface BookingData {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  source: string;
  createdAt: string;
  service: { id: string; name: string; duration: number; price: number };
  customer: { id: string; name: string; phone: string; email: string | null };
  dogs: Array<{ pet: { id: string; name: string } }>;
}

const BOOKING_STATUSES = [
  { id: "ALL", label: "הכל" },
  { id: "pending", label: "ממתין" },
  { id: "confirmed", label: "מאושר" },
  { id: "declined", label: "נדחה" },
  { id: "cancelled", label: "בוטל" },
];

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "ממתין", color: "#F59E0B", icon: AlertCircle },
  confirmed: { label: "מאושר", color: "#22C55E", icon: CheckCircle2 },
  declined: { label: "נדחה", color: "#EF4444", icon: XCircle },
  cancelled: { label: "בוטל", color: "#94A3B8", icon: XCircle },
};

export default function BookingsPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [copiedLink, setCopiedLink] = useState(false);
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery<BookingData[]>({
    queryKey: ["bookings", activeStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      return fetch(`/api/booking/bookings?${params}`).then((r) => r.json());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/booking/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });

  const bookingLink = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${DEMO_BUSINESS_ID}`;

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">הזמנות אונליין</h1>
          <p className="text-sm text-petra-muted mt-1">
            {bookings.length} הזמנות
            {pendingCount > 0 && ` • ${pendingCount} ממתינות לאישור`}
          </p>
        </div>
        <button
          onClick={copyLink}
          className="btn-secondary flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copiedLink ? "הועתק!" : "העתק קישור הזמנה"}
        </button>
      </div>

      {/* Booking Link Banner */}
      <div className="card p-4 mb-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
          <CalendarCheck className="w-4 h-4 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-petra-muted">קישור להזמנת תור</p>
          <p className="text-sm text-petra-text font-mono truncate" dir="ltr">
            {bookingLink}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-6">
        {BOOKING_STATUSES.map((s) => (
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

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CalendarCheck className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין הזמנות</h3>
          <p className="text-sm text-petra-muted mb-4">
            שתף את קישור ההזמנה עם לקוחות כדי לקבל הזמנות
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const statusInfo = STATUS_INFO[booking.status] || STATUS_INFO.pending;
            const StatusIcon = statusInfo.icon;
            const startDate = new Date(booking.startAt);
            const endDate = new Date(booking.endAt);

            return (
              <div key={booking.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${statusInfo.color}15` }}
                  >
                    <StatusIcon className="w-5 h-5" style={{ color: statusInfo.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-petra-text">
                        {booking.service.name}
                      </h3>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: `${statusInfo.color}15`,
                          color: statusInfo.color,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                      {booking.source === "online" && (
                        <span className="badge-neutral text-[10px]">אונליין</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-petra-muted mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {startDate.toLocaleDateString("he-IL")} {" "}
                        {startDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        {" - "}
                        {endDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {booking.customer.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {booking.customer.phone}
                      </span>
                    </div>

                    {booking.notes && (
                      <p className="text-xs text-petra-muted bg-slate-50 rounded-lg p-2 mb-2">
                        {booking.notes}
                      </p>
                    )}

                    {/* Actions for pending bookings */}
                    {booking.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateMutation.mutate({ id: booking.id, status: "confirmed" })
                          }
                          disabled={updateMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3 inline ml-1" />
                          אשר
                        </button>
                        <button
                          onClick={() =>
                            updateMutation.mutate({ id: booking.id, status: "declined" })
                          }
                          disabled={updateMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-3 h-3 inline ml-1" />
                          דחה
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-left flex-shrink-0">
                    <span className="text-sm font-bold text-petra-text">
                      ₪{booking.service.price}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
