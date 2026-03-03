"use client";

import { BookingsTabs } from "@/components/bookings/BookingsTabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Phone,
  Copy,
  PawPrint,
  X,
  Mail,
  MessageCircle,
  QrCode,
  Download,
  Share2,
} from "lucide-react";
import QRCode from "qrcode";
import { cn, fetchJSON, formatCurrency, formatRelativeTime, toWhatsAppPhone } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface BookingData {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  source: string;
  createdAt: string;
  service: { id: string; name: string; duration: number; price: number } | null;
  priceListItem: { id: string; name: string; durationMinutes: number | null; basePrice: number } | null;
  customer: { id: string; name: string; phone: string; email: string | null };
  dogs: Array<{ pet: { id: string; name: string } }>;
}

function getServiceInfo(b: BookingData) {
  if (b.service) return { name: b.service.name, price: b.service.price };
  if (b.priceListItem) return { name: b.priceListItem.name, price: b.priceListItem.basePrice };
  return { name: "—", price: 0 };
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

const EMPTY_MESSAGES: Record<string, { title: string; description: string }> = {
  ALL: { title: "אין הזמנות", description: "שתף את קישור ההזמנה עם לקוחות כדי לקבל הזמנות" },
  pending: { title: "אין הזמנות ממתינות", description: "כל ההזמנות טופלו" },
  confirmed: { title: "אין הזמנות מאושרות", description: "הזמנות שתאשר יופיעו כאן" },
  declined: { title: "אין הזמנות שנדחו", description: "הזמנות שתדחה יופיעו כאן" },
  cancelled: { title: "אין הזמנות שבוטלו", description: "הזמנות שבוטלו יופיעו כאן" },
};

export default function BookingsPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [copiedLink, setCopiedLink] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: bookings = [], isLoading } = useQuery<BookingData[]>({
    queryKey: ["bookings", activeStatus, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      return fetchJSON<BookingData[]>(`/api/booking/bookings?${params}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      fetch(`/api/booking/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(notes !== undefined && { notes }) }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("ההזמנה עודכנה בהצלחה");
      setSelectedBooking(null);
      setDeclineNote("");
      setShowDeclineInput(false);
    },
    onError: () => {
      toast.error("שגיאה בעדכון ההזמנה. נסה שוב.");
    },
  });

  const [origin, setOrigin] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const bookingSlug = user?.businessSlug || "demo";
  const bookingLink = `${origin}/book/${bookingSlug}`;

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function openQR() {
    try {
      const url = await QRCode.toDataURL(bookingLink, {
        width: 300,
        margin: 2,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
      setShowQR(true);
    } catch (e) {
      console.error("QR generation failed", e);
    }
  }

  function downloadQR() {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "booking-qr.png";
    a.click();
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const emptyMsg = EMPTY_MESSAGES[activeStatus] || EMPTY_MESSAGES.ALL;

  return (
    <div>
      <BookingsTabs />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">ניהול תורים</h1>
        <p className="text-sm text-petra-muted">
          {bookings.length} הזמנות
          {pendingCount > 0 && ` • ${pendingCount} ממתינות לאישור`}
        </p>
        <button
          onClick={copyLink}
          className="btn-secondary flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copiedLink ? "הועתק!" : "העתק קישור הזמנה"}
        </button>
        <button
          onClick={openQR}
          className="btn-secondary flex items-center gap-2"
          title="הצג QR Code לקישור ההזמנה"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">QR Code</span>
        </button>
      </div>

      {/* Removed link banner — booking URL now lives on each service card in /pricing */}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex gap-1.5">
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
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input text-xs py-1.5 px-2"
            placeholder="מתאריך"
          />
          <span className="text-xs text-petra-muted">עד</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input text-xs py-1.5 px-2"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-petra-muted hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
          <h3 className="text-base font-semibold text-petra-text mb-1">{emptyMsg.title}</h3>
          <p className="text-sm text-petra-muted mb-4">{emptyMsg.description}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const statusInfo = STATUS_INFO[booking.status] || STATUS_INFO.pending;
            const StatusIcon = statusInfo.icon;
            const startDate = new Date(booking.startAt);
            const endDate = new Date(booking.endAt);
            const dogNames = booking.dogs.map((d) => d.pet.name).join(", ");
            const svcInfo = getServiceInfo(booking);

            return (
              <div
                key={booking.id}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedBooking(booking);
                  setDeclineNote("");
                  setShowDeclineInput(false);
                }}
              >
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
                        {svcInfo.name}
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

                    <div className="flex flex-wrap items-center gap-3 text-xs text-petra-muted mb-1">
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
                      {dogNames && (
                        <span className="flex items-center gap-1">
                          <PawPrint className="w-3 h-3" />
                          {dogNames}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-petra-muted">
                      {formatRelativeTime(booking.createdAt)}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-petra-text">
                      {formatCurrency(svcInfo.price)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── QR Code Modal ────────────────────────────────────────────── */}
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-petra-text flex items-center gap-2">
                <QrCode className="w-4 h-4 text-brand-500" />
                קוד QR לקישור הזמנה
              </h3>
              <button onClick={() => setShowQR(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-4">
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 rounded-2xl border border-slate-100 shadow-sm" />
                <p className="text-xs text-petra-muted break-all">{bookingLink}</p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={downloadQR}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    הורד
                  </button>
                  <a
                    href={`https://web.whatsapp.com/send?text=${encodeURIComponent(`הזמן תור אונליין: ${bookingLink}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200"
                  >
                    <Share2 className="w-4 h-4" />
                    שלח WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Booking Detail Modal ────────────────────────────────────────── */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-petra-text flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-brand-500" />
                פרטי הזמנה
              </h3>
              <button onClick={() => setSelectedBooking(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {(() => {
              const booking = selectedBooking;
              const modalSvcInfo = getServiceInfo(booking);
              const modalDuration = booking.service?.duration ?? booking.priceListItem?.durationMinutes ?? 60;
              const statusInfo = STATUS_INFO[booking.status] || STATUS_INFO.pending;
              const startDate = new Date(booking.startAt);
              const endDate = new Date(booking.endAt);
              const dogNames = booking.dogs.map((d) => d.pet.name);

              return (
                <div className="space-y-4">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-petra-muted">
                      {formatRelativeTime(booking.createdAt)}
                    </span>
                  </div>

                  {/* Service */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-petra-muted">שירות</p>
                        <p className="font-semibold text-petra-text">{modalSvcInfo.name}</p>
                        <p className="text-xs text-petra-muted">{modalDuration} דקות</p>
                      </div>
                      <span className="text-lg font-bold text-petra-text">
                        {formatCurrency(modalSvcInfo.price)}
                      </span>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs text-petra-muted">תאריך ושעה</p>
                      <p className="font-medium text-petra-text">
                        {startDate.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p className="text-sm text-petra-muted">
                        {startDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        {" - "}
                        {endDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="space-y-2">
                    <p className="text-xs text-petra-muted font-medium">פרטי לקוח</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1.5 text-petra-text">
                        <User className="w-3.5 h-3.5 text-petra-muted" />
                        {booking.customer.name}
                      </span>
                      <span className="flex items-center gap-1.5 text-petra-text" dir="ltr">
                        <Phone className="w-3.5 h-3.5 text-petra-muted" />
                        {booking.customer.phone}
                      </span>
                      {booking.customer.email && (
                        <span className="flex items-center gap-1.5 text-petra-text" dir="ltr">
                          <Mail className="w-3.5 h-3.5 text-petra-muted" />
                          {booking.customer.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dogs */}
                  {dogNames.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-petra-muted font-medium">כלבים</p>
                      <div className="flex flex-wrap gap-2">
                        {dogNames.map((name, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-sm bg-purple-50 text-purple-700 px-3 py-1 rounded-lg">
                            <PawPrint className="w-3.5 h-3.5" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {booking.notes && (
                    <div className="space-y-1">
                      <p className="text-xs text-petra-muted font-medium">הערות</p>
                      <p className="text-sm text-petra-text bg-slate-50 rounded-lg p-3">
                        {booking.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions for pending bookings */}
                  {booking.status === "pending" && (
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      {showDeclineInput ? (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-petra-muted">סיבת הדחייה (אופציונלי)</label>
                          <textarea
                            value={declineNote}
                            onChange={(e) => setDeclineNote(e.target.value)}
                            placeholder="למשל: אין פנויות בשעה זו..."
                            rows={2}
                            className="input w-full resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMutation.mutate({
                                id: booking.id,
                                status: "declined",
                                notes: declineNote || undefined,
                              })}
                              disabled={updateMutation.isPending}
                              className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                            >
                              אשר דחייה
                            </button>
                            <button
                              onClick={() => setShowDeclineInput(false)}
                              className="px-3 py-2 rounded-lg bg-slate-100 text-sm text-petra-muted hover:bg-slate-200 transition-colors"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMutation.mutate({ id: booking.id, status: "confirmed" })}
                              disabled={updateMutation.isPending}
                              className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              אשר הזמנה
                            </button>
                            <button
                              onClick={() => setShowDeclineInput(true)}
                              disabled={updateMutation.isPending}
                              className="flex-1 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              דחה הזמנה
                            </button>
                          </div>
                          {booking.customer.phone && (() => {
                            const dateStr = new Date(booking.startAt).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
                            const timeStr = new Date(booking.startAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
                            const petNames = booking.dogs.map((d) => d.pet.name).join(", ");
                            const confirmMsg = [
                              `שלום ${booking.customer.name}! 😊`,
                              `ההזמנה שלך אושרה ✅`,
                              "",
                              `📅 תאריך: ${dateStr}`,
                              `🕐 שעה: ${timeStr}`,
                              `🐾 שירות: ${modalSvcInfo.name}`,
                              petNames ? `🐕 חיית מחמד: ${petNames}` : "",
                              "",
                              `מחכים לראותכם! 🐾`,
                            ].filter(Boolean).join("\n");
                            return (
                              <button
                                onClick={() => {
                                  updateMutation.mutate({ id: booking.id, status: "confirmed" }, {
                                    onSuccess: () => {
                                      window.open(`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(booking.customer.phone)}&text=${encodeURIComponent(confirmMsg)}`, "_blank", "noopener,noreferrer");
                                    }
                                  });
                                }}
                                className="w-full px-4 py-2.5 rounded-lg bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-2 border border-green-200"
                              >
                                <MessageCircle className="w-4 h-4" />
                                אשר + שלח אישור WhatsApp
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
