"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  User,
  ChevronDown,
  Filter,
} from "lucide-react";

interface BookingDog {
  pet: { id: string; name: string; breed: string | null };
}

interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  service: {
    id: string;
    name: string;
    duration: number;
    price: number;
    color: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  dogs: BookingDog[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "מאושר",
  declined: "נדחה",
  cancelled: "בוטל",
  completed: "הושלם",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  confirmed: "bg-green-100 text-green-700 border border-green-200",
  declined: "bg-red-100 text-red-700 border border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
  completed: "bg-blue-100 text-blue-700 border border-blue-200",
};

const STATUS_FILTERS = [
  { value: "", label: "כל הסטטוסים" },
  { value: "pending", label: "ממתין לאישור" },
  { value: "confirmed", label: "מאושר" },
  { value: "declined", label: "נדחה" },
  { value: "cancelled", label: "בוטל" },
  { value: "completed", label: "הושלם" },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBookingsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionNote, setActionNote] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["admin", "bookings", statusFilter],
    queryFn: () =>
      fetch(`/api/admin/bookings${statusFilter ? `?status=${statusFilter}` : ""}`)
        .then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
    },
  });

  function handleAction(id: string, action: "approve" | "decline" | "cancel") {
    const note = actionNote[id] || undefined;
    mutation.mutate({ id, action, note });
  }

  const bookings = data?.bookings ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ניהול הזמנות</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            אישור ודחיית הזמנות אונליין
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: "#64748B" }} />
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-xl px-4 py-2 pr-8 text-sm text-white focus:outline-none"
              style={{ background: "#12121A", border: "1px solid #1E1E2E" }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "#64748B" }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#06B6D4" }} />
        </div>
      ) : bookings.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
          style={{ background: "#12121A", border: "1px solid #1E1E2E" }}
        >
          <CalendarCheck className="w-10 h-10 mb-3" style={{ color: "#1E1E2E" }} />
          <p className="text-sm font-medium text-white">אין הזמנות</p>
          <p className="text-xs mt-1" style={{ color: "#64748B" }}>
            {statusFilter === "pending"
              ? "אין הזמנות הממתינות לאישור"
              : "אין הזמנות בסטטוס זה"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: "#12121A", border: "1px solid #1E1E2E" }}
            >
              {/* Top row */}
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Service color bar */}
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ background: booking.service.color || "#06B6D4" }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {booking.service.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[booking.status] || ""}`}
                    >
                      {STATUS_LABELS[booking.status] || booking.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: "#94A3B8" }}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(booking.startAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {booking.customer.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span dir="ltr">{booking.customer.phone}</span>
                    </span>
                  </div>

                  {booking.dogs.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {booking.dogs.map((d) => (
                        <span
                          key={d.pet.id}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(6,182,212,0.1)", color: "#06B6D4" }}
                        >
                          🐕 {d.pet.name}
                          {d.pet.breed ? ` · ${d.pet.breed}` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {booking.notes && (
                    <p className="text-xs italic" style={{ color: "#64748B" }}>
                      {booking.notes}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div className="text-left flex-shrink-0">
                  <div className="text-lg font-bold text-white">
                    ₪{booking.service.price.toLocaleString()}
                  </div>
                  <div className="text-[11px]" style={{ color: "#64748B" }}>
                    {booking.service.duration} דקות
                  </div>
                </div>
              </div>

              {/* Action row — only for pending */}
              {booking.status === "pending" && (
                <div
                  className="px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                  style={{ borderTop: "1px solid #1E1E2E" }}
                >
                  <input
                    type="text"
                    placeholder="הערה (אופציונלי)..."
                    value={actionNote[booking.id] || ""}
                    onChange={(e) =>
                      setActionNote((prev) => ({ ...prev, [booking.id]: e.target.value }))
                    }
                    className="flex-1 min-w-0 text-sm px-3 py-1.5 rounded-lg focus:outline-none"
                    style={{
                      background: "#0A0A0F",
                      border: "1px solid #1E1E2E",
                      color: "#E2E8F0",
                    }}
                    dir="rtl"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(booking.id, "approve")}
                      disabled={mutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      אשר
                    </button>
                    <button
                      onClick={() => handleAction(booking.id, "decline")}
                      disabled={mutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
                    >
                      <XCircle className="w-4 h-4" />
                      דחה
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
