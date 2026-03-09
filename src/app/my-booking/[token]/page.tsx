"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Check, Clock, X, PawPrint, Calendar, User, Phone, MessageCircle, Loader2, AlertCircle } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface BookingData {
  id: string
  status: string
  startAt: string
  endAt: string
  notes: string | null
  customerToken: string | null
  customer: { name: string; phone: string }
  priceListItem: { name: string; category: string | null } | null
  service: { name: string } | null
  dogs: Array<{ pet: { name: string } | null }>
  business: { name: string; phone: string | null }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; Icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "ממתין לאישור", color: "text-amber-700",  bgColor: "bg-amber-100",  Icon: Clock },
  confirmed: { label: "מאושר",         color: "text-emerald-700",bgColor: "bg-emerald-100",Icon: Check },
  declined:  { label: "נדחה",          color: "text-red-700",   bgColor: "bg-red-100",    Icon: X },
  cancelled: { label: "בוטל",          color: "text-slate-600", bgColor: "bg-slate-100",  Icon: X },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function MyBookingPage({ params }: { params: { token: string } }) {
  const [booking, setBooking] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    fetch(`/api/my-booking/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setBooking(data)
      })
      .catch(() => setError("שגיאה בטעינת ההזמנה"))
      .finally(() => setLoading(false))
  }, [params.token])

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await fetch(`/api/my-booking/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "שגיאה בביטול ההזמנה")
      } else {
        setBooking((prev) => prev ? { ...prev, status: "cancelled" } : prev)
        setConfirmCancel(false)
      }
    } catch {
      setError("שגיאה בביטול ההזמנה")
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">הזמנה לא נמצאה</h1>
          <p className="text-slate-500 text-sm">{error || "הקישור אינו תקין או שפג תוקפו."}</p>
        </div>
      </div>
    )
  }

  const serviceName = booking.priceListItem?.name ?? booking.service?.name ?? "שירות"
  const dogs = booking.dogs.filter((d) => d.pet).map((d) => d.pet!.name)
  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG["pending"]
  const StatusIcon = statusCfg.Icon
  const canCancel = ["pending", "confirmed"].includes(booking.status)
  const waLink = booking.business.phone
    ? `https://wa.me/972${booking.business.phone.replace(/^0/, "")}?text=${encodeURIComponent(`שלום, אני ${booking.customer.name}. רציתי לדבר על ההזמנה שלי (#${booking.id.slice(0, 8).toUpperCase()}).`)}`
    : null

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <Image src="/logo.svg" alt="Petra" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-slate-500">ההזמנה שלך אצל</p>
            <h1 className="font-bold text-slate-800 text-sm leading-tight">{booking.business.name}</h1>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Status badge */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${statusCfg.bgColor}`}>
          <div className={`w-10 h-10 rounded-full ${statusCfg.bgColor} flex items-center justify-center border-2 border-white shadow-sm`}>
            <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">סטטוס הזמנה</p>
            <p className={`font-bold text-base ${statusCfg.color}`}>{statusCfg.label}</p>
          </div>
          <div className="mr-auto text-xs font-mono text-slate-400">
            #{booking.id.slice(0, 8).toUpperCase()}
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Service */}
          <div className="flex items-start gap-3 p-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <PawPrint className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">שירות</p>
              <p className="font-semibold text-slate-800">{serviceName}</p>
            </div>
          </div>

          {/* Date/Time */}
          <div className="flex items-start gap-3 p-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">מועד</p>
              <p className="font-semibold text-slate-800">{formatDate(booking.startAt)}</p>
              <p className="text-sm text-slate-500">בשעה {formatTime(booking.startAt)}</p>
            </div>
          </div>

          {/* Customer */}
          <div className="flex items-start gap-3 p-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">שם</p>
              <p className="font-semibold text-slate-800">{booking.customer.name}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />{booking.customer.phone}
              </p>
            </div>
          </div>

          {/* Dogs */}
          {dogs.length > 0 && (
            <div className="flex items-start gap-3 p-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <PawPrint className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">כלבים</p>
                <p className="font-semibold text-slate-800">{dogs.join(", ")}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs text-slate-500 mb-1">הערות</p>
              <p className="text-sm text-slate-600">{booking.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* WhatsApp contact */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              צור קשר עם {booking.business.name}
            </a>
          )}

          {/* Cancel button */}
          {canCancel && !confirmCancel && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="w-full py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
            >
              ביטול הזמנה
            </button>
          )}

          {/* Cancel confirmation */}
          {confirmCancel && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm text-red-700 font-medium text-center">האם לבטל את ההזמנה?</p>
              <p className="text-xs text-red-600 text-center">פעולה זו אינה הפיכה</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                >
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  כן, בטל הזמנה
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  חזור
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 pt-2">
          מופעל על ידי <span className="font-semibold text-brand-600">Petra</span>
        </p>
      </div>
    </div>
  )
}
