"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight, ChevronLeft, Check, Clock, Calendar, PawPrint, User, Plus, X, MapPin, Mail, CreditCard, ExternalLink, Scissors, GraduationCap, Hotel, Sparkles, MessageCircle, CalendarPlus } from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface BusinessService {
  id: string
  name: string
  type: string
  duration: number
  price: number
  description: string | null
  color: string | null
  depositRequired: boolean
  depositAmount: number | null
  bookingMode: string
  paymentUrl: string | null
}

interface AvailabilityRule {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface BusinessInfo {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  logo: string | null
  timezone: string
  boardingCheckInTime: string
  boardingCheckOutTime: string
  services: BusinessService[]
  availabilityRules: AvailabilityRule[]
}

interface TimeSlot {
  time: string
  startAt: string
  endAt: string
}

interface DogForm {
  id?: string       // existing pet
  name: string
  originalName?: string  // display name for existing dogs
  breed: string
  sex: string
  notes: string
  isNew: boolean
}

type Step = "service" | "date" | "time" | "boarding-dates" | "customer" | "dogs" | "confirm" | "deposit" | "done"

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

function formatPrice(price: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(price)
}

function getDatesForMonth(year: number, month: number): Date[] {
  const dates: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    dates.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Build a Google Calendar link for the booking */
function buildGoogleCalLink(service: BusinessService, dateStr: string, slotTime: string, businessName: string, address: string | null): string {
  const [h, m] = slotTime.split(":").map(Number)
  const startDate = new Date(dateStr + "T12:00:00")
  startDate.setHours(h, m, 0, 0)
  const endDate = new Date(startDate.getTime() + service.duration * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${service.name} — ${businessName}`,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details: `הזמנה: ${service.name} · ${formatPrice(service.price)}`,
    location: address || businessName,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Build a WhatsApp self-reminder text */
function buildWhatsAppReminder(service: BusinessService, dateStr: string, slotTime: string, customerName: string, dogNames: string[]): string {
  const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })
  const lines = [
    `📅 תזכורת לתור`,
    `שירות: ${service.name}`,
    `תאריך: ${dateLabel}`,
    `שעה: ${slotTime}`,
    dogNames.length > 0 ? `כלב/ים: ${dogNames.join(", ")}` : "",
    `מחיר: ${formatPrice(service.price)}`,
  ].filter(Boolean)
  return encodeURIComponent(lines.join("\n"))
}

// Service type → icon mapping
function ServiceIcon({ type, className }: { type: string; className?: string }) {
  switch (type?.toLowerCase()) {
    case "grooming": return <Scissors className={className} />
    case "training": return <GraduationCap className={className} />
    case "boarding": return <Hotel className={className} />
    case "daycare": return <Sparkles className={className} />
    default: return <PawPrint className={className} />
  }
}

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEPS_DEFAULT: { key: Step; label: string }[] = [
  { key: "service", label: "שירות" },
  { key: "date", label: "תאריך" },
  { key: "time", label: "שעה" },
  { key: "customer", label: "פרטים" },
  { key: "dogs", label: "כלבים" },
  { key: "confirm", label: "אישור" },
]

const STEPS_BOARDING: { key: Step; label: string }[] = [
  { key: "service", label: "שירות" },
  { key: "boarding-dates", label: "תאריכים" },
  { key: "customer", label: "פרטים" },
  { key: "dogs", label: "כלבים" },
  { key: "confirm", label: "אישור" },
]

function StepIndicator({ current, isBoarding }: { current: Step; isBoarding: boolean }) {
  const STEPS = isBoarding ? STEPS_BOARDING : STEPS_DEFAULT
  const currentIdx = STEPS.findIndex((s) => s.key === current)
  if (currentIdx === -1) return null
  const progress = Math.round(((currentIdx) / (STEPS.length - 1)) * 100)
  return (
    <div className="mb-6">
      {/* Mobile: show current step text */}
      <p className="sm:hidden text-center text-xs text-petra-muted mb-3">
        שלב {currentIdx + 1} מתוך {STEPS.length}: <span className="font-medium text-brand-700">{STEPS[currentIdx].label}</span>
      </p>
      {/* Mobile: progress bar */}
      <div className="sm:hidden h-1.5 bg-slate-200 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Desktop: step circles */}
      <div className="hidden sm:flex items-center justify-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${i < currentIdx
                ? "bg-emerald-500 text-white"
                : i === currentIdx
                  ? "bg-brand-500 text-white"
                  : "bg-slate-200 text-slate-500"
                }`}
            >
              {i < currentIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`ml-1 mr-2 text-xs ${i === currentIdx ? "text-brand-700 font-medium" : "text-slate-400"}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-300 mx-1" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BookingPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  // Business data
  const [business, setBusiness] = useState<BusinessInfo | null>(null)
  const [loadError, setLoadError] = useState("")

  // Booking state
  const [step, setStep] = useState<Step>("service")
  const [selectedService, setSelectedService] = useState<BusinessService | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("")        // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }
  })

  // Boarding-specific state
  const [boardingCheckInDate, setBoardingCheckInDate] = useState("")   // YYYY-MM-DD
  const [boardingCheckInTime, setBoardingCheckInTime] = useState("")   // HH:mm
  const [boardingCheckOutDate, setBoardingCheckOutDate] = useState("") // YYYY-MM-DD
  const [boardingCheckOutTime, setBoardingCheckOutTime] = useState("") // HH:mm

  // Customer fields
  const [phone, setPhone] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerNotes, setCustomerNotes] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [isNewCustomer, setIsNewCustomer] = useState<boolean | null>(null)
  const [existingDogNames, setExistingDogNames] = useState<string[]>([])

  // Dogs
  const [dogs, setDogs] = useState<DogForm[]>([{ name: "", breed: "", sex: "", notes: "", isNew: true }])

  // Phone Lookup
  const [isLookingUpPhone, setIsLookingUpPhone] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<{ bookingId: string; status: string; message: string } | null>(null)
  const [submitError, setSubmitError] = useState("")

  // ── Load business ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/book/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error)
        else setBusiness(data.business)
      })
      .catch(() => setLoadError("שגיאה בטעינת העמוד"))
  }, [slug])

  // ── Load slots when date+service changes ──────────────────────────────────
  const loadSlots = useCallback(
    async (date: string, serviceId: string) => {
      setSlotsLoading(true)
      setSlots([])
      try {
        const res = await fetch(`/api/book/${slug}/slots?priceListItemId=${serviceId}&date=${date}`)
        const data = await res.json()
        setSlots(data.slots ?? [])
      } finally {
        setSlotsLoading(false)
      }
    },
    [slug]
  )

  useEffect(() => {
    if (selectedDate && selectedService) {
      loadSlots(selectedDate, selectedService.id)
    }
  }, [selectedDate, selectedService, loadSlots])

  // ── Submit booking ─────────────────────────────────────────────────────────
  const submitBooking = async () => {
    const isBoarding = selectedService?.type === "boarding"
    if (!selectedService) return
    if (!isBoarding && !selectedSlot) return
    if (isBoarding && (!boardingCheckInDate || !boardingCheckOutDate)) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const startAt = isBoarding
        ? `${boardingCheckInDate}T${boardingCheckInTime}:00`
        : selectedSlot!.startAt
      const checkoutAt = isBoarding
        ? `${boardingCheckOutDate}T${boardingCheckOutTime}:00`
        : undefined

      const res = await fetch(`/api/book/${slug}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceListItemId: selectedService.id,
          startAt,
          checkoutAt,
          phone,
          customerName: isNewCustomer ? customerName : undefined,
          customerEmail: isNewCustomer ? customerEmail : undefined,
          customerNotes: isNewCustomer ? customerNotes : undefined,
          customerAddress: isNewCustomer ? customerAddress : undefined,
          dogs: dogs
            .filter((d) => d.name.trim())
            .map((d) => d.id
              ? { id: d.id, name: d.name }
              : { name: d.name, breed: d.breed, sex: d.sex, notes: d.notes }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "שגיאה ביצירת ההזמנה")
      } else {
        setBookingResult(data)
        // If deposit required, show deposit payment step before done
        if (selectedService.depositRequired && selectedService.depositAmount) {
          setStep("deposit")
        } else {
          setStep("done")
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Phone Lookup ──────────────────────────────────────────────────────────
  const lookupPhone = useCallback(async (phoneNumber: string) => {
    if (phoneNumber.length < 9) {
      setIsNewCustomer(null)
      return
    }

    setIsLookingUpPhone(true)
    try {
      const res = await fetch(`/api/book/${slug}/customer?phone=${encodeURIComponent(phoneNumber)}`)
      const data = await res.json()

      if (data.exists) {
        setIsNewCustomer(false)
        setCustomerName(data.name || "")
        const dogList: string[] = []
        if (data.dogs && data.dogs.length > 0) {
          const autoSelect = data.dogs.length === 1
          setDogs(data.dogs.map((d: { id: string; name: string; breed?: string; gender?: string }) => ({
            id: d.id,
            name: autoSelect ? d.name : "",
            originalName: d.name,
            breed: d.breed || "",
            sex: d.gender || "",
            notes: "",
            isNew: false
          })))
          data.dogs.forEach((d: { name: string }) => dogList.push(d.name))
        }
        setExistingDogNames(dogList)
      } else {
        setIsNewCustomer(true)
        setCustomerName("")
        setExistingDogNames([])
        setDogs([{ name: "", breed: "", sex: "", notes: "", isNew: true }])
      }
    } catch (e) {
      console.error("Phone lookup failed", e)
      setIsNewCustomer(true)
    } finally {
      setIsLookingUpPhone(false)
    }
  }, [slug])

  // Debounce phone changes for lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phone.length >= 9) {
        lookupPhone(phone)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [phone, lookupPhone])

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-petra-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <PawPrint className="w-7 h-7 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-petra-text mb-2">העסק לא נמצא</h1>
          <p className="text-petra-muted">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-petra-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  const isOpenDay = (date: Date) => {
    const dow = date.getDay()
    const rule = business.availabilityRules.find((r) => r.dayOfWeek === dow)
    if (rule) return rule.isOpen
    // Default when no availability rules are configured:
    // Open Sunday–Thursday (Israeli work week), closed Friday & Saturday
    return dow <= 4
  }

  const today = toDateStr(new Date())
  const calDates = getDatesForMonth(calMonth.year, calMonth.month)
  const firstDow = new Date(calMonth.year, calMonth.month, 1).getDay()
  const isCurrentMonth = calMonth.year === new Date().getFullYear() && calMonth.month === new Date().getMonth()

  // ─── Render card ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-petra-bg" dir="rtl">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-petra-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {business.logo ? (
            <img src={business.logo} alt={business.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <img src="/logo.svg" alt="Petra" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-petra-text text-sm leading-tight truncate">{business.name}</h1>
            <p className="text-xs text-petra-muted">קביעת תור אונליין</p>
          </div>
          {business.address && (
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(business.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 text-xs text-petra-muted hover:text-brand-600 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{business.address}</span>
            </a>
          )}
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {step !== "done" && step !== "deposit" && <StepIndicator current={step} isBoarding={selectedService?.type === "boarding"} />}

        <div className="bg-white rounded-2xl shadow-card border border-petra-border overflow-hidden">

          {/* ── Step: Service ────────────────────────────────────────────── */}
          {step === "service" && (
            <div className="p-6 animate-fade-in">
              <h2 className="text-lg font-bold text-petra-text mb-1">בחר שירות</h2>
              <p className="text-sm text-petra-muted mb-4">מה תרצה לקבוע?</p>
              {business.services.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Calendar className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-petra-muted">אין שירותים זמינים כרגע</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {business.services.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => {
                        setSelectedService(svc); setSelectedDate(""); setSelectedSlot(null)
                        if (svc.type === "boarding") {
                          setBoardingCheckInDate(""); setBoardingCheckOutDate("")
                          setBoardingCheckInTime(business.boardingCheckInTime || "14:00")
                          setBoardingCheckOutTime(business.boardingCheckOutTime || "11:00")
                          setStep("boarding-dates")
                        } else {
                          setStep("date")
                        }
                      }}
                      className="w-full text-right p-4 rounded-xl border-2 border-petra-border hover:border-brand-300 hover:bg-brand-50/40 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Service color + icon */}
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: svc.color ? `${svc.color}22` : "#FFF7ED" }}
                        >
                          <ServiceIcon
                            type={svc.type}
                            className="w-5 h-5"
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            {...({ style: { color: svc.color || "#F97316" } } as any)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-petra-text group-hover:text-brand-700 truncate">{svc.name}</span>
                            {svc.depositRequired && svc.depositAmount && (
                              <span className="text-[10px] bg-brand-50 text-brand-600 border border-brand-100 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">מקדמה</span>
                            )}
                          </div>
                          {svc.description && (
                            <p className="text-xs text-petra-muted mb-1 line-clamp-1">{svc.description}</p>
                          )}
                          {svc.type !== "boarding" && svc.duration ? (
                            <div className="flex items-center gap-2 text-xs text-petra-muted">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />{svc.duration} דקות
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-petra-text text-base">{formatPrice(svc.price)}</span>
                          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-brand-500 mx-auto mt-0.5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Business info footer */}
              {(business.address || business.phone) && (
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-petra-muted">
                  {business.phone && (
                    <a href={`tel:${business.phone}`} className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" />{business.phone}
                    </a>
                  )}
                  {business.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" />{business.address}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Date ───────────────────────────────────────────────── */}
          {step === "date" && selectedService && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("service")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-petra-text">בחר תאריך</h2>
              </div>

              {/* Service summary */}
              <div className="bg-brand-50 rounded-xl p-3 mb-4 flex items-center gap-2 border border-brand-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedService.color ? `${selectedService.color}33` : "#FFF0E0" }}>
                  <ServiceIcon type={selectedService.type} className="w-3.5 h-3.5" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                </div>
                <span className="text-sm font-medium text-brand-800 flex-1 truncate">{selectedService.name}</span>
                <span className="text-xs text-brand-600 font-medium">{selectedService.duration} דקות</span>
              </div>

              {/* Calendar navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30"
                  disabled={isCurrentMonth}
                >
                  <ChevronRight className="w-5 h-5 text-petra-muted" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-petra-text">
                    {new Date(calMonth.year, calMonth.month).toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
                  </span>
                  {!isCurrentMonth && (
                    <button
                      onClick={() => { const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() }) }}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      היום
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setCalMonth((p) => {
                    const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-petra-muted" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HE.map((d) => (
                  <div key={d} className="text-center text-xs text-petra-muted py-1 font-medium">{d.slice(0, 1)}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
                {calDates.map((date) => {
                  const ds = toDateStr(date)
                  const isPast = ds < today
                  const isToday = ds === today
                  const open = isOpenDay(date)
                  const isSelected = ds === selectedDate
                  return (
                    <button
                      key={ds}
                      disabled={isPast || !open}
                      onClick={() => { setSelectedDate(ds); setSelectedSlot(null); setStep("time") }}
                      className={`
                        aspect-square rounded-lg text-sm font-medium transition-colors relative
                        ${isPast ? "text-slate-200 cursor-not-allowed" :
                          !open ? "text-slate-300 cursor-not-allowed line-through" : "cursor-pointer"}
                        ${isSelected ? "bg-brand-500 text-white shadow-sm" :
                          isToday && !isPast && open ? "bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-300" :
                          !isPast && open ? "hover:bg-brand-100 text-petra-text" : ""}
                      `}
                    >
                      {date.getDate()}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-petra-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-50 ring-1 ring-brand-300 inline-block" /> היום</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 inline-block line-through" /> סגור</span>
              </div>
            </div>
          )}

          {/* ── Step: Time ───────────────────────────────────────────────── */}
          {step === "time" && selectedService && selectedDate && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("date")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-petra-text">בחר שעה</h2>
              </div>

              <div className="bg-brand-50 rounded-xl p-3 mb-4 text-sm text-brand-800 flex items-center gap-2 border border-brand-100">
                <Calendar className="w-4 h-4" />
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                <button onClick={() => setStep("date")} className="ms-auto text-xs text-brand-500 hover:underline">שנה</button>
              </div>

              {slotsLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="animate-spin w-6 h-6 border-4 border-brand-400 border-t-transparent rounded-full" />
                  <p className="text-xs text-petra-muted">טוען זמינות...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-petra-muted font-medium mb-1">אין זמינות ביום זה</p>
                  <p className="text-xs text-petra-muted mb-3">נסה לבחור תאריך אחר</p>
                  <button onClick={() => setStep("date")} className="btn-secondary text-sm">בחר תאריך אחר</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-petra-muted mb-3">{slots.length} שעות זמינות</p>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startAt}
                        onClick={() => { setSelectedSlot(slot); setStep("customer") }}
                        className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${selectedSlot?.startAt === slot.startAt
                          ? "bg-brand-500 border-brand-500 text-white shadow-sm"
                          : "border-petra-border hover:border-brand-300 hover:bg-brand-50 text-petra-text"
                          }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step: Boarding Dates ─────────────────────────────────────── */}
          {step === "boarding-dates" && selectedService && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("service")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-petra-text">תאריכי פנסיון</h2>
              </div>

              {/* Service summary */}
              <div className="bg-brand-50 rounded-xl p-3 mb-5 flex items-center gap-2 border border-brand-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedService.color ? `${selectedService.color}33` : "#FFF0E0" }}>
                  <ServiceIcon type={selectedService.type} className="w-3.5 h-3.5" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                </div>
                <span className="text-sm font-medium text-brand-800 flex-1 truncate">{selectedService.name}</span>
                <span className="text-xs text-brand-600 font-medium">{formatPrice(selectedService.price)} / לילה</span>
              </div>

              <div className="space-y-5">
                {/* Check-in */}
                <div className="border border-petra-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-petra-text">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    צ׳ק-אין
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">תאריך *</label>
                      <input
                        type="date"
                        className="input"
                        value={boardingCheckInDate}
                        min={toDateStr(new Date())}
                        onChange={(e) => {
                          setBoardingCheckInDate(e.target.value)
                          // Reset checkout if it's before or equal to new check-in
                          if (boardingCheckOutDate && boardingCheckOutDate <= e.target.value) {
                            setBoardingCheckOutDate("")
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">שעה</label>
                      <input
                        type="time"
                        className="input"
                        value={boardingCheckInTime}
                        onChange={(e) => setBoardingCheckInTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Check-out */}
                <div className="border border-petra-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-petra-text">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    צ׳ק-אאוט
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">תאריך *</label>
                      <input
                        type="date"
                        className="input"
                        value={boardingCheckOutDate}
                        min={boardingCheckInDate || toDateStr(new Date())}
                        disabled={!boardingCheckInDate}
                        onChange={(e) => setBoardingCheckOutDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">שעה</label>
                      <input
                        type="time"
                        className="input"
                        value={boardingCheckOutTime}
                        onChange={(e) => setBoardingCheckOutTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Night count summary */}
                {boardingCheckInDate && boardingCheckOutDate && (
                  <div className="bg-slate-50 rounded-xl p-3 text-sm text-center text-petra-muted border border-slate-200">
                    {(() => {
                      const nights = Math.ceil((new Date(boardingCheckOutDate).getTime() - new Date(boardingCheckInDate).getTime()) / 86400000)
                      return nights > 0 ? (
                        <span>
                          <span className="font-bold text-petra-text">{nights}</span> לילות ·{" "}
                          {new Date(boardingCheckInDate + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                          {" — "}
                          {new Date(boardingCheckOutDate + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                        </span>
                      ) : (
                        <span className="text-red-500">תאריך יציאה חייב להיות לאחר תאריך הכניסה</span>
                      )
                    })()}
                  </div>
                )}

                <button
                  disabled={!boardingCheckInDate || !boardingCheckOutDate || boardingCheckOutDate <= boardingCheckInDate}
                  onClick={() => setStep("customer")}
                  className="btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  המשך
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Customer ───────────────────────────────────────────── */}
          {step === "customer" && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep(selectedService?.type === "boarding" ? "boarding-dates" : "time")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-petra-text">פרטי בעל הכלב</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">מספר טלפון *</label>
                  <div className="flex gap-2 relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="050-0000000"
                      className="input flex-1"
                      autoComplete="tel"
                    />
                    {isLookingUpPhone && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                </div>

                {isNewCustomer === null && phone.length >= 9 && !isLookingUpPhone && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsNewCustomer(false)}
                      className="flex-1 py-2.5 text-sm border border-petra-border rounded-xl hover:bg-slate-50 text-petra-text transition-colors"
                    >
                      לקוח קיים
                    </button>
                    <button
                      onClick={() => setIsNewCustomer(true)}
                      className="flex-1 py-2.5 text-sm bg-brand-50 border border-brand-200 text-brand-700 rounded-xl hover:bg-brand-100 transition-colors"
                    >
                      לקוח חדש
                    </button>
                  </div>
                )}

                {isNewCustomer === true && (
                  <>
                    <div>
                      <label className="label">שם מלא *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="ישראל ישראלי"
                        className="input"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className="label">אימייל</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="input"
                        dir="ltr"
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <label className="label">כתובת</label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="עיר, רחוב..."
                        className="input"
                        autoComplete="street-address"
                      />
                    </div>
                    <div>
                      <label className="label">הערות</label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="מידע נוסף שחשוב לנו לדעת..."
                        rows={2}
                        className="input resize-none"
                      />
                    </div>
                  </>
                )}

                {isNewCustomer === false && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      שלום {customerName}! מצאנו אותך 👋
                    </div>
                    {existingDogNames.length > 0 && (
                      <p className="text-emerald-700 text-xs">
                        הכלבים שלך: <span className="font-medium">{existingDogNames.join(", ")}</span>
                      </p>
                    )}
                  </div>
                )}

                <button
                  disabled={!phone || phone.length < 9 || isNewCustomer === null || isLookingUpPhone || (isNewCustomer === true && !customerName)}
                  onClick={() => setStep("dogs")}
                  className="btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  המשך
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Dogs ───────────────────────────────────────────────── */}
          {step === "dogs" && selectedService && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("customer")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-petra-text">בחירת כלב לשירות</h2>
              </div>

              {/* Service context banner */}
              <div className="bg-brand-50 rounded-xl p-3 mb-4 flex items-center gap-2 border border-brand-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedService.color ? `${selectedService.color}33` : "#FFF0E0" }}>
                  <ServiceIcon type={selectedService.type} className="w-3.5 h-3.5" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                </div>
                <span className="text-sm font-medium text-brand-800">בחר כלב עבור: {selectedService.name}</span>
              </div>

              <div className="space-y-4">
                {dogs.map((dog, idx) => {
                  const isSelected = !!dog.name.trim();

                  return (
                    <div key={idx} className={`border rounded-xl p-4 relative transition-all ${!dog.isNew ? (isSelected ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-400' : 'border-petra-border bg-white opacity-60 hover:opacity-100') : 'border-petra-border'}`}>
                      {dogs.length > 1 && dog.isNew && (
                        <button
                          onClick={() => setDogs((d) => d.filter((_, i) => i !== idx))}
                          className="absolute top-3 left-3 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}

                      {!dog.isNew && (
                        <div className="absolute top-0 right-0 w-full h-full cursor-pointer z-10"
                          onClick={() => {
                            if (isSelected) {
                              setDogs(d => d.map((x, i) => i === idx ? { ...x, name: "" } : x))
                            } else {
                              setDogs(d => d.map((x, i) => i === idx ? { ...x, name: x.originalName || "" } : x))
                            }
                          }}
                        />
                      )}

                      {!dog.isNew && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                          <span className="text-xs bg-brand-100 text-brand-700 font-medium px-2 py-0.5 rounded-md">
                            שמור במערכת
                          </span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-petra-muted mb-1">שם הכלב *</label>
                          <input
                            type="text"
                            value={dog.isNew ? dog.name : (dog.originalName || dog.name)}
                            disabled={!dog.isNew}
                            onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                            placeholder="בוקסר, רקסי..."
                            className="input text-sm disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>
                        {dog.isNew && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-petra-muted mb-1">גזע</label>
                                <input
                                  type="text"
                                  value={dog.breed}
                                  onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, breed: e.target.value } : x))}
                                  placeholder="לברדור..."
                                  className="input text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-petra-muted mb-1">מין</label>
                                <select
                                  value={dog.sex}
                                  onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, sex: e.target.value } : x))}
                                  className="input text-sm bg-white"
                                >
                                  <option value="">לא ידוע</option>
                                  <option value="male">זכר</option>
                                  <option value="female">נקבה</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-petra-muted mb-1">הערות רפואיות / אחר</label>
                              <input
                                type="text"
                                value={dog.notes}
                                onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                                placeholder="אלרגיות, מידע רפואי..."
                                className="input text-sm"
                              />
                            </div>
                          </>
                        )}
                        {!dog.isNew && dog.breed && (
                          <p className="text-xs text-petra-muted">גזע: {dog.breed}</p>
                        )}
                      </div>
                    </div>
                  )})}

                <button
                  onClick={() => setDogs((d) => [...d, { name: "", breed: "", sex: "", notes: "", isNew: true }])}
                  className="w-full py-2.5 border-2 border-dashed border-petra-border rounded-xl text-sm text-petra-muted hover:border-brand-300 hover:text-brand-600 flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-4 h-4" /> הוסף כלב נוסף
                </button>

                <button
                  disabled={dogs.every((d) => !d.name.trim())}
                  onClick={() => setStep("confirm")}
                  className="btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  המשך לאישור
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Confirm ────────────────────────────────────────────── */}
          {step === "confirm" && selectedService && (selectedSlot || selectedService.type === "boarding") && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("dogs")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-petra-text">אישור הזמנה</h2>
              </div>

              <div className="space-y-4">
                {/* Summary card */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: selectedService.color ? `${selectedService.color}22` : "#FFF7ED" }}>
                      <ServiceIcon type={selectedService.type} className="w-4 h-4" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                    </div>
                    <div>
                      <p className="text-xs text-petra-muted">שירות</p>
                      <p className="font-semibold text-petra-text">{selectedService.name}</p>
                      <p className="text-sm text-petra-muted">{selectedService.duration} דקות · {formatPrice(selectedService.price)}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      {selectedService.type === "boarding" ? (
                        <>
                          <p className="text-xs text-petra-muted">תאריכי פנסיון</p>
                          <p className="font-semibold text-petra-text">
                            כניסה: {new Date(boardingCheckInDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "long" })} בשעה {boardingCheckInTime}
                          </p>
                          <p className="font-semibold text-petra-text">
                            יציאה: {new Date(boardingCheckOutDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "long" })} בשעה {boardingCheckOutTime}
                          </p>
                          <p className="text-sm text-petra-muted">
                            {Math.ceil((new Date(boardingCheckOutDate).getTime() - new Date(boardingCheckInDate).getTime()) / 86400000)} לילות
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-petra-muted">מועד</p>
                          <p className="font-semibold text-petra-text">
                            {new Date(selectedDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          <p className="text-sm text-petra-muted">שעה {selectedSlot!.time}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-petra-muted">בעל הכלב</p>
                      <p className="font-semibold text-petra-text">{customerName || "לקוח קיים"}</p>
                      <p className="text-sm text-petra-muted">{phone}</p>
                      {customerEmail && (
                        <p className="text-sm text-petra-muted flex items-center gap-1"><Mail className="w-3 h-3" />{customerEmail}</p>
                      )}
                      {customerAddress && (
                        <p className="text-sm text-petra-muted flex items-center gap-1"><MapPin className="w-3 h-3" />{customerAddress}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <PawPrint className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-petra-muted">כלבים</p>
                      {dogs.filter((d) => d.name.trim()).map((d, i) => (
                        <p key={i} className="font-semibold text-petra-text">{d.name}{d.breed ? ` (${d.breed})` : ""}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedService.bookingMode === "requires_approval" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    ⏳ שירות זה דורש אישור מבעל העסק. תקבל הודעה לאחר האישור.
                  </div>
                )}

                {selectedService.depositRequired && selectedService.depositAmount && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    💳 נדרשת מקדמה של {formatPrice(selectedService.depositAmount)} לאישור ההזמנה.
                  </div>
                )}

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{submitError}</div>
                )}

                <button
                  onClick={submitBooking}
                  disabled={submitting}
                  className="btn-primary w-full py-4 justify-center text-lg disabled:opacity-60"
                >
                  {submitting ? (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      אשר הזמנה
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Deposit ─────────────────────────────────────────── */}
          {step === "deposit" && selectedService && bookingResult && (
            <div className="p-6 animate-fade-in">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-7 h-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-petra-text mb-1">נדרש תשלום מקדמה</h2>
                <p className="text-sm text-petra-muted">
                  כדי לשריין את התור, יש לשלם מקדמה
                </p>
              </div>

              {/* Deposit details */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-800">סכום מקדמה</span>
                  <span className="text-lg font-bold text-amber-900">
                    {formatPrice(selectedService.depositAmount || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-700">
                  <span>שירות: {selectedService.name}</span>
                  <span>מחיר מלא: {formatPrice(selectedService.price)}</span>
                </div>
              </div>

              {/* Booking ID */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-petra-muted text-center mb-4">
                <p>מספר הזמנה: <span className="font-mono font-bold text-petra-text text-sm">{bookingResult.bookingId.slice(0, 8).toUpperCase()}</span></p>
              </div>

              {/* Payment link */}
              {selectedService.paymentUrl ? (
                <a
                  href={selectedService.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-4 justify-center text-lg mb-3"
                >
                  <ExternalLink className="w-5 h-5" />
                  לתשלום מקדמה
                </a>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3 text-sm text-blue-800 text-center">
                  <p className="font-semibold mb-1">ליצירת קשר לתשלום:</p>
                  {business?.phone && (
                    <a href={`https://wa.me/972${business.phone.replace(/^0/, "")}?text=${encodeURIComponent(`שלום, קבעתי תור ל${selectedService.name} (מס' ${bookingResult.bookingId.slice(0, 8).toUpperCase()}). אשמח לשלם מקדמה.`)}`} className="text-green-600 hover:underline block flex items-center justify-center gap-1">
                      <MessageCircle className="w-4 h-4" /> שלח WhatsApp לתשלום
                    </a>
                  )}
                  {business?.email && (
                    <a href={`mailto:${business.email}`} className="text-blue-600 hover:underline block mt-1">
                      {business.email}
                    </a>
                  )}
                </div>
              )}

              <button
                onClick={() => setStep("done")}
                className="btn-secondary w-full py-3 justify-center"
              >
                סיימתי לשלם ✓
              </button>
            </div>
          )}

          {/* ── Step: Done ───────────────────────────────────────────────── */}
          {step === "done" && bookingResult && selectedService && (selectedSlot || selectedService.type === "boarding") && (
            <div className="p-8 text-center animate-fade-in">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${bookingResult.status === "confirmed" ? "bg-emerald-100" : "bg-amber-100"}`}>
                {bookingResult.status === "confirmed" ? (
                  <Check className="w-8 h-8 text-emerald-600" />
                ) : (
                  <Clock className="w-8 h-8 text-amber-600" />
                )}
              </div>

              <h2 className="text-xl font-bold text-petra-text mb-1">
                {bookingResult.status === "confirmed" ? "ההזמנה אושרה! 🎉" : "הבקשה התקבלה"}
              </h2>
              <p className="text-petra-muted text-sm mb-2">{bookingResult.message}</p>

              {/* Booking ID badge */}
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2 mb-5">
                <span className="text-xs text-petra-muted">מספר הזמנה:</span>
                <span className="font-mono font-bold text-petra-text tracking-wider">{bookingResult.bookingId.slice(0, 8).toUpperCase()}</span>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-right space-y-2 mb-5">
                <div className="flex items-center gap-2">
                  <ServiceIcon type={selectedService.type} className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  <span className="text-petra-muted">שירות:</span>
                  <span className="font-medium text-petra-text">{selectedService.name}</span>
                </div>
                {selectedService.type === "boarding" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-petra-muted">כניסה:</span>
                      <span className="font-medium text-petra-text">
                        {new Date(boardingCheckInDate + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" })} {boardingCheckInTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-petra-muted">יציאה:</span>
                      <span className="font-medium text-petra-text">
                        {new Date(boardingCheckOutDate + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long" })} {boardingCheckOutTime}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-petra-muted">תאריך:</span>
                      <span className="font-medium text-petra-text">
                        {new Date(selectedDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-petra-muted">שעה:</span>
                      <span className="font-medium text-petra-text">{selectedSlot!.time}</span>
                    </div>
                  </>
                )}
                {dogs.filter(d => d.name.trim()).length > 0 && (
                  <div className="flex items-center gap-2">
                    <PawPrint className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-petra-muted">כלב:</span>
                    <span className="font-medium text-petra-text">{dogs.filter(d => d.name.trim()).map(d => d.name).join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 mb-5">
                {/* Add to Google Calendar */}
                {selectedService.type !== "boarding" && selectedSlot && (
                  <a
                    href={buildGoogleCalLink(selectedService, selectedDate, selectedSlot.time, business.name, business.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    הוסף ליומן Google
                  </a>
                )}

                {/* Send self WA reminder */}
                {selectedService.type !== "boarding" && selectedSlot && (
                  <a
                    href={`https://wa.me/?text=${buildWhatsAppReminder(selectedService, selectedDate, selectedSlot.time, customerName, dogs.filter(d => d.name.trim()).map(d => d.name))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors text-sm font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    שלח לעצמי תזכורת ב-WhatsApp
                  </a>
                )}
              </div>

              <button
                onClick={() => {
                  setStep("service"); setSelectedService(null); setSelectedDate(""); setSelectedSlot(null)
                  setBoardingCheckInDate(""); setBoardingCheckInTime(""); setBoardingCheckOutDate(""); setBoardingCheckOutTime("")
                  setPhone(""); setCustomerName(""); setCustomerEmail(""); setCustomerNotes(""); setCustomerAddress(""); setIsNewCustomer(null)
                  setExistingDogNames([])
                  setDogs([{ name: "", breed: "", sex: "", notes: "", isNew: true }])
                  setBookingResult(null)
                }}
                className="btn-secondary w-full py-3 justify-center text-sm"
              >
                הזמן תור נוסף
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-petra-muted mt-6">
          מופעל על ידי <span className="font-semibold text-brand-600">Petra</span>
        </p>
      </div>
    </div>
  )
}
