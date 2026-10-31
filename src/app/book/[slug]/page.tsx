"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ChevronRight, ChevronLeft, Check, Clock, Calendar, PawPrint, User, Plus, X, MapPin, Mail, CreditCard, ExternalLink, Scissors, GraduationCap, Hotel, Sparkles, MessageCircle, CalendarPlus } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { PetraLoader } from "@/components/ui/PetraLoader";
import { toWhatsAppPhone } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

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
  cancellationPolicy: string | null
  bookingWelcomeText: string | null
  depositInstructions: string | null
  /** Not returned by /api/book/[slug] yet — falls back to the locale default currency */
  currency?: string | null
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

type BookT = ReturnType<typeof useTranslations<"booking.bookDetailPage">>

// Calendar column headers: the Hebrew day letters (the first letter of each name would read "ר ש ש ר ח ש ש")
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

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
function buildGoogleCalLink(t: BookT, formatPrice: (n: number) => string, service: BusinessService, dateStr: string, slotTime: string, businessName: string, address: string | null): string {
  const [h, m] = slotTime.split(":").map(Number)
  const startDate = new Date(dateStr + "T12:00:00")
  startDate.setHours(h, m, 0, 0)
  const endDate = new Date(startDate.getTime() + service.duration * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${service.name} — ${businessName}`,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details: t("calendarLink.details", { service: service.name, price: formatPrice(service.price) }),
    location: address || businessName,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Build a WhatsApp self-reminder text */
function buildWhatsAppReminder(t: BookT, locale: string, formatPrice: (n: number) => string, service: BusinessService, dateStr: string, slotTime: string, customerName: string, dogNames: string[]): string {
  const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
  const lines = [
    t("reminder.title"),
    t("reminder.service", { name: service.name }),
    t("reminder.date", { date: dateLabel }),
    t("reminder.time", { time: slotTime }),
    dogNames.length > 0 ? t("reminder.dogs", { names: dogNames.join(", ") }) : "",
    t("reminder.price", { price: formatPrice(service.price) }),
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

type StepLabelKey = "service" | "date" | "time" | "dates" | "details" | "dogs" | "confirm"

const STEPS_DEFAULT: { key: Step; labelKey: StepLabelKey }[] = [
  { key: "service", labelKey: "service" },
  { key: "date", labelKey: "date" },
  { key: "time", labelKey: "time" },
  { key: "customer", labelKey: "details" },
  { key: "dogs", labelKey: "dogs" },
  { key: "confirm", labelKey: "confirm" },
]

const STEPS_BOARDING: { key: Step; labelKey: StepLabelKey }[] = [
  { key: "service", labelKey: "service" },
  { key: "boarding-dates", labelKey: "dates" },
  { key: "customer", labelKey: "details" },
  { key: "dogs", labelKey: "dogs" },
  { key: "confirm", labelKey: "confirm" },
]

function StepIndicator({ current, isBoarding }: { current: Step; isBoarding: boolean }) {
  const t = useTranslations("booking.bookDetailPage")
  const STEPS = isBoarding ? STEPS_BOARDING : STEPS_DEFAULT
  const currentIdx = STEPS.findIndex((s) => s.key === current)
  if (currentIdx === -1) return null
  const progress = Math.round(((currentIdx) / (STEPS.length - 1)) * 100)
  return (
    <div className="mb-6">
      {/* Mobile: show current step text */}
      <p className="sm:hidden text-center text-xs text-petra-muted mb-3">
        {t.rich("steps.mobileProgress", {
          current: currentIdx + 1,
          total: STEPS.length,
          label: t(`steps.${STEPS[currentIdx].labelKey}`),
          hl: (c) => <span className="font-medium text-brand-700">{c}</span>,
        })}
      </p>
      {/* Mobile: progress bar */}
      <div className="sm:hidden h-1.5 bg-slate-200 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Desktop: step circles */}
      <ol className="hidden sm:flex items-center justify-center gap-1 overflow-x-auto pb-1" aria-label={t("steps.ariaLabel")}>
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center">
            <div
              aria-current={i === currentIdx ? "step" : undefined}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${i < currentIdx
                ? "bg-emerald-500 text-white"
                : i === currentIdx
                  ? "bg-brand-500 text-white"
                  : "bg-slate-200 text-slate-600"
                }`}
            >
              {i < currentIdx ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
              {i === currentIdx && <span className="sr-only">{t("steps.currentSr", { label: t(`steps.${step.labelKey}`) })}</span>}
            </div>
            <span className={`me-1 ms-2 text-xs ${i === currentIdx ? "text-brand-700 font-medium" : "text-slate-400"}`}>
              {t(`steps.${step.labelKey}`)}
            </span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-300 mx-1" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BookingPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const t = useTranslations("booking.bookDetailPage")
  const locale = localeFromBusiness({ locale: useLocale() })
  const cfg = LOCALE_CONFIG[locale]

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
  const [capacityReached, setCapacityReached] = useState(false)
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

  // Validation errors
  const [phoneError, setPhoneError] = useState("")
  const [nameError, setNameError] = useState("")
  const [emailError, setEmailError] = useState("")

  const validatePhone = (raw: string) => /^0[2-9]\d{7,8}$/.test(raw.replace(/\D/g, ""))
  const validateEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // ── Dynamic page title ────────────────────────────────────────────────────
  useEffect(() => {
    if (!business) return
    const v = { business: business.name }
    const labels: Partial<Record<Step, string>> = {
      service: t("pageTitle.service", v),
      date: t("pageTitle.date", v),
      time: t("pageTitle.time", v),
      "boarding-dates": t("pageTitle.boardingDates", v),
      customer: t("pageTitle.customer", v),
      dogs: t("pageTitle.dogs", v),
      confirm: t("pageTitle.confirm", v),
      done: t("pageTitle.done", v),
    }
    document.title = labels[step] ?? t("pageTitle.default", v)
  }, [step, business, t])

  // ── Load business ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/book/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error)
        else setBusiness(data.business)
      })
      .catch(() => setLoadError(t("errors.loadPage")))
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load slots when date+service changes ──────────────────────────────────
  const loadSlots = useCallback(
    async (date: string, serviceId: string) => {
      setSlotsLoading(true)
      setSlots([])
      setCapacityReached(false)
      try {
        const res = await fetch(`/api/book/${slug}/slots?priceListItemId=${serviceId}&date=${date}`)
        const data = await res.json()
        setSlots(data.slots ?? [])
        setCapacityReached(data.capacityReached ?? false)
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
        setSubmitError(data.error ?? t("errors.createBooking"))
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
    if (phoneNumber.replace(/\D/g, "").length < 9) {
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
      if (phone.replace(/\D/g, "").length >= 9) {
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
      <div className="min-h-screen bg-petra-bg flex items-center justify-center p-4" dir={cfg.dir}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <PawPrint className="w-7 h-7 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-petra-text mb-2">{t("notFound.title")}</h1>
          <p className="text-petra-muted mb-1">{loadError}</p>
          <p className="text-sm text-petra-muted mb-5">{t("notFound.body")}</p>
          <a
            href="https://petra-app.com"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            {t("notFound.backHome")}
          </a>
        </div>
      </div>
    )
  }

  if (!business) {
    return <PetraLoader variant="splash" />
  }

  const isOpenDay = (date: Date) => {
    const dow = date.getDay()
    const rule = business.availabilityRules.find((r) => r.dayOfWeek === dow)
    if (rule) return rule.isOpen
    // Default when no availability rules are configured:
    // Open Sunday–Thursday (Israeli work week), closed Friday & Saturday
    return dow <= 4
  }

  const currency = business.currency || cfg.currency
  const formatPrice = (price: number) => formatCurrency(price, { locale, currency })

  const today = toDateStr(new Date())
  const calDates = getDatesForMonth(calMonth.year, calMonth.month)
  const firstDow = new Date(calMonth.year, calMonth.month, 1).getDay()
  const isCurrentMonth = calMonth.year === new Date().getFullYear() && calMonth.month === new Date().getMonth()

  // ─── Render card ──────────────────────────────────────────────────────────
  return (
    <main id="main-content" className="min-h-screen bg-petra-bg" dir={cfg.dir}>
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-petra-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {business.logo ? (
            <Image src={business.logo} alt={business.name} width={40} height={40} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <Image src="/logo.svg" alt="Petra" width={40} height={40} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-petra-text text-sm leading-tight truncate">{business.name}</h1>
            <p className="text-xs text-petra-muted">{t("header.subtitle")}</p>
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
      </header>

      {/* Main card */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {step !== "done" && step !== "deposit" && (
          <nav aria-label={t("steps.ariaLabel")}>
            <StepIndicator current={step} isBoarding={selectedService?.type === "boarding"} />
          </nav>
        )}

        <div className="bg-white rounded-2xl shadow-card border border-petra-border overflow-hidden">

          {/* ── Step: Service ────────────────────────────────────────────── */}
          {step === "service" && (
            <div className="p-6 animate-fade-in">
              {business.bookingWelcomeText && (
                <div className="mb-4 p-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-800">
                  {business.bookingWelcomeText}
                </div>
              )}
              <h2 className="text-lg font-bold text-petra-text mb-1">{t("service.title")}</h2>
              <p className="text-sm text-petra-muted mb-4">{t("service.subtitle")}</p>
              {business.services.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Calendar className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-petra-muted">{t("service.empty")}</p>
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
                      className="w-full text-start p-4 rounded-xl border-2 border-petra-border hover:border-brand-300 hover:bg-brand-50/40 transition-all group"
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
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-petra-text group-hover:text-brand-700 leading-tight">{svc.name}</span>
                            {svc.depositRequired && svc.depositAmount && (
                              <span className="text-[10px] bg-brand-50 text-brand-600 border border-brand-100 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">{t("service.deposit")}</span>
                            )}
                          </div>
                          {svc.description && (
                            <p className="text-xs text-petra-muted mb-1 line-clamp-1">{svc.description}</p>
                          )}
                          {svc.type !== "boarding" && svc.duration ? (
                            <div className="flex items-center gap-2 text-xs text-petra-muted">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />{t("service.minutes", { count: svc.duration })}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="text-start flex-shrink-0">
                          <span className="font-bold text-petra-text text-base">{formatPrice(svc.price)}</span>
                          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-brand-500 mx-auto mt-0.5 ltr:-scale-x-100" />
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
                  <ChevronRight className="w-4 h-4 ltr:-scale-x-100" /> {t("back")}
                </button>
                <h2 className="text-lg font-bold text-petra-text">{t("date.title")}</h2>
              </div>

              {/* Service summary */}
              <div className="bg-brand-50 rounded-xl p-3 mb-4 flex items-center gap-2 border border-brand-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedService.color ? `${selectedService.color}33` : "#FFF0E0" }}>
                  <ServiceIcon type={selectedService.type} className="w-3.5 h-3.5" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                </div>
                <span className="text-sm font-medium text-brand-800 flex-1 truncate">{selectedService.name}</span>
                <span className="text-xs text-brand-600 font-medium">{t("service.minutes", { count: selectedService.duration })}</span>
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
                  <ChevronRight className="w-5 h-5 text-petra-muted ltr:-scale-x-100" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-petra-text">
                    {new Date(calMonth.year, calMonth.month).toLocaleDateString(locale, { month: "long", year: "numeric" })}
                  </span>
                  {!isCurrentMonth && (
                    <button
                      onClick={() => { const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() }) }}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {t("date.today")}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setCalMonth((p) => {
                    const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-petra-muted ltr:-scale-x-100" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAY_KEYS.map((d) => (
                  <div key={d} className="text-center text-xs text-petra-muted py-1 font-medium">{t(`weekdaysShort.${d}`)}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
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
                        aspect-square w-full rounded-lg text-xs sm:text-sm font-medium transition-colors relative
                        ${isPast ? "text-slate-200 cursor-not-allowed" :
                          !open ? "text-slate-300 cursor-not-allowed line-through" : "cursor-pointer"}
                        ${isSelected ? "bg-brand-500 text-white shadow-sm" :
                          isToday && !isPast && open ? "bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-300" :
                          !isPast && open ? "hover:bg-brand-100 text-petra-text" : ""}
                      `}
                    >
                      {date.getDate()}
                      {isToday && !isSelected && (
                        // rtl-ok: physically centered dot (left-1/2 + -translate-x-1/2), same in both directions
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-petra-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-50 ring-1 ring-brand-300 inline-block" /> {t("date.today")}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 inline-block line-through" /> {t("date.closed")}</span>
              </div>
            </div>
          )}

          {/* ── Step: Time ───────────────────────────────────────────────── */}
          {step === "time" && selectedService && selectedDate && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("date")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4 ltr:-scale-x-100" /> {t("back")}
                </button>
                <h2 className="text-lg font-bold text-petra-text">{t("time.title")}</h2>
              </div>

              <div className="bg-brand-50 rounded-xl p-3 mb-4 text-sm text-brand-800 flex items-center gap-2 border border-brand-100">
                <Calendar className="w-4 h-4" />
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                <button onClick={() => setStep("date")} className="ms-auto text-xs text-brand-500 hover:underline">{t("time.change")}</button>
              </div>

              {slotsLoading ? (
                <PetraLoader variant="inline" />
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  {capacityReached ? (
                    <>
                      <p className="text-petra-muted font-medium mb-1">{t("time.fullTitle")}</p>
                      <p className="text-xs text-petra-muted mb-3">{t("time.fullBody")}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-petra-muted font-medium mb-1">{t("time.noAvailabilityTitle")}</p>
                      <p className="text-xs text-petra-muted mb-3">{t("time.noAvailabilityBody")}</p>
                    </>
                  )}
                  <button onClick={() => setStep("date")} className="btn-secondary text-sm">{t("time.pickOtherDate")}</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-petra-muted mb-3">{t("time.available", { count: slots.length })}</p>
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
                  <ChevronRight className="w-4 h-4 ltr:-scale-x-100" /> {t("back")}
                </button>
                <h2 className="text-lg font-bold text-petra-text">{t("boarding.title")}</h2>
              </div>

              {/* Service summary */}
              <div className="bg-brand-50 rounded-xl p-3 mb-5 flex items-center gap-2 border border-brand-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedService.color ? `${selectedService.color}33` : "#FFF0E0" }}>
                  <ServiceIcon type={selectedService.type} className="w-3.5 h-3.5" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                </div>
                <span className="text-sm font-medium text-brand-800 flex-1 truncate">{selectedService.name}</span>
                <span className="text-xs text-brand-600 font-medium">{t("boarding.perNight", { price: formatPrice(selectedService.price) })}</span>
              </div>

              <div className="space-y-5">
                {/* Check-in */}
                <div className="border border-petra-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-petra-text">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    {t("boarding.checkIn")}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">{t("boarding.dateLabel")}</label>
                      <input
                        type="date" lang={cfg.lang}
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
                      <label className="block text-xs font-medium text-petra-muted mb-1">{t("boarding.timeLabel")}</label>
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
                    {t("boarding.checkOut")}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">{t("boarding.dateLabel")}</label>
                      <input
                        type="date" lang={cfg.lang}
                        className="input"
                        value={boardingCheckOutDate}
                        min={boardingCheckInDate || toDateStr(new Date())}
                        disabled={!boardingCheckInDate}
                        onChange={(e) => setBoardingCheckOutDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-petra-muted mb-1">{t("boarding.timeLabel")}</label>
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
                          {t.rich("boarding.nightsRange", {
                            count: nights,
                            from: new Date(boardingCheckInDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" }),
                            to: new Date(boardingCheckOutDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" }),
                            b: (c) => <span className="font-bold text-petra-text">{c}</span>,
                          })}
                        </span>
                      ) : (
                        <span className="text-red-500">{t("boarding.invalidRange")}</span>
                      )
                    })()}
                  </div>
                )}

                <button
                  disabled={!boardingCheckInDate || !boardingCheckOutDate || boardingCheckOutDate <= boardingCheckInDate}
                  onClick={() => setStep("customer")}
                  className="btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("continue")}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Customer ───────────────────────────────────────────── */}
          {step === "customer" && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep(selectedService?.type === "boarding" ? "boarding-dates" : "time")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4 ltr:-scale-x-100" /> {t("back")}
                </button>
                <h2 className="text-lg font-bold text-petra-text">{t("customer.title")}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">{t("customer.phoneLabel")}</label>
                  <div className="flex gap-2 relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError("") }}
                      onBlur={() => { if (phone && !validatePhone(phone)) setPhoneError(t("errors.phoneInvalid")) }}
                      placeholder={t("customer.phonePlaceholder")}
                      className={`input flex-1 text-right ${phoneError ? "border-red-400 focus:ring-red-300" : ""}`}
                      dir="ltr"
                      autoComplete="tel"
                    />
                    {isLookingUpPhone && (
                      <div className="absolute end-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
                </div>

                {isNewCustomer === null && phone.replace(/\D/g, "").length >= 9 && !isLookingUpPhone && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsNewCustomer(false)}
                      className="flex-1 py-2.5 text-sm border border-petra-border rounded-xl hover:bg-slate-50 text-petra-text transition-colors"
                    >
                      {t("customer.existing")}
                    </button>
                    <button
                      onClick={() => setIsNewCustomer(true)}
                      className="flex-1 py-2.5 text-sm bg-brand-50 border border-brand-200 text-brand-700 rounded-xl hover:bg-brand-100 transition-colors"
                    >
                      {t("customer.new")}
                    </button>
                  </div>
                )}

                {isNewCustomer === true && (
                  <>
                    <div>
                      <label className="label">{t("customer.nameLabel")}</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => { setCustomerName(e.target.value); if (nameError) setNameError("") }}
                        placeholder={t("customer.namePlaceholder")}
                        className={`input ${nameError ? "border-red-400 focus:ring-red-300" : ""}`}
                        autoComplete="name"
                      />
                      {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
                    </div>
                    <div>
                      <label className="label">{t("customer.emailLabel")}</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => { setCustomerEmail(e.target.value); if (emailError) setEmailError("") }}
                        onBlur={() => { if (customerEmail && !validateEmail(customerEmail)) setEmailError(t("errors.emailInvalid")) }}
                        placeholder="example@email.com"
                        className={`input ${emailError ? "border-red-400 focus:ring-red-300" : ""}`}
                        dir="ltr"
                        autoComplete="email"
                      />
                      {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                    </div>
                    <div>
                      <label className="label">{t("customer.addressLabel")}</label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder={t("customer.addressPlaceholder")}
                        className="input"
                        autoComplete="street-address"
                      />
                    </div>
                    <div>
                      <label className="label">{t("customer.notesLabel")}</label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder={t("customer.notesPlaceholder")}
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
                      {t("customer.found", { name: customerName })}
                    </div>
                    {existingDogNames.length > 0 && (
                      <p className="text-emerald-700 text-xs">
                        {t.rich("customer.yourDogs", { names: existingDogNames.join(", "), b: (c) => <span className="font-medium">{c}</span> })}
                      </p>
                    )}
                  </div>
                )}

                <button
                  disabled={!phone || !validatePhone(phone) || isNewCustomer === null || isLookingUpPhone || (isNewCustomer === true && customerName.trim().length < 2)}
                  onClick={() => {
                    if (!validatePhone(phone)) { setPhoneError(t("errors.phoneInvalid")); return }
                    if (isNewCustomer === true && customerName.trim().length < 2) { setNameError(t("errors.nameMin")); return }
                    if (isNewCustomer === true && !validateEmail(customerEmail)) { setEmailError(t("errors.emailInvalid")); return }
                    setStep("dogs")
                  }}
                  className="btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("continue")}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Dogs ───────────────────────────────────────────────── */}
          {step === "dogs" && selectedService && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("customer")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4 ltr:-scale-x-100" /> {t("back")}
                </button>
                <h2 className="text-lg font-bold text-petra-text">{t("dogs.title")}</h2>
              </div>

              {/* Service context banner */}
              <div className="bg-brand-50 rounded-xl p-3 mb-4 flex items-center gap-2 border border-brand-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedService.color ? `${selectedService.color}33` : "#FFF0E0" }}>
                  <ServiceIcon type={selectedService.type} className="w-3.5 h-3.5" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                </div>
                <span className="text-sm font-medium text-brand-800">{t("dogs.forService", { service: selectedService.name })}</span>
              </div>

              <div className="space-y-4">
                {dogs.map((dog, idx) => {
                  const isSelected = !!dog.name.trim();

                  return (
                    <div key={idx} className={`border rounded-xl p-4 relative transition-all ${!dog.isNew ? (isSelected ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-400' : 'border-petra-border bg-white opacity-60 hover:opacity-100') : 'border-petra-border'}`}>
                      {dogs.length > 1 && dog.isNew && (
                        <button
                          onClick={() => setDogs((d) => d.filter((_, i) => i !== idx))}
                          className="absolute top-1 end-1 p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}

                      {!dog.isNew && (
                        <div className="absolute top-0 start-0 w-full h-full cursor-pointer z-10"
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
                        <div className="absolute top-3 end-3 flex items-center gap-1.5">
                          {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                          <span className="text-xs bg-brand-100 text-brand-700 font-medium px-2 py-0.5 rounded-md">
                            {t("dogs.saved")}
                          </span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-petra-muted mb-1">{t("dogs.nameLabel")}</label>
                          <input
                            type="text"
                            value={dog.isNew ? dog.name : (dog.originalName || dog.name)}
                            disabled={!dog.isNew}
                            onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                            placeholder={t("dogs.namePlaceholder")}
                            className="input text-sm disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>
                        {dog.isNew && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-petra-muted mb-1">{t("dogs.breedLabel")}</label>
                                <input
                                  type="text"
                                  value={dog.breed}
                                  onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, breed: e.target.value } : x))}
                                  placeholder={t("dogs.breedPlaceholder")}
                                  className="input text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-petra-muted mb-1">{t("dogs.sexLabel")}</label>
                                <select
                                  value={dog.sex}
                                  onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, sex: e.target.value } : x))}
                                  className="input text-sm bg-white"
                                >
                                  <option value="">{t("dogs.sexUnknown")}</option>
                                  <option value="male">{t("dogs.male")}</option>
                                  <option value="female">{t("dogs.female")}</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-petra-muted mb-1">{t("dogs.notesLabel")}</label>
                              <input
                                type="text"
                                value={dog.notes}
                                onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                                placeholder={t("dogs.notesPlaceholder")}
                                className="input text-sm"
                              />
                            </div>
                          </>
                        )}
                        {!dog.isNew && dog.breed && (
                          <p className="text-xs text-petra-muted">{t("dogs.breedValue", { breed: dog.breed })}</p>
                        )}
                      </div>
                    </div>
                  )})}

                <button
                  onClick={() => setDogs((d) => [...d, { name: "", breed: "", sex: "", notes: "", isNew: true }])}
                  className="w-full py-2.5 border-2 border-dashed border-petra-border rounded-xl text-sm text-petra-muted hover:border-brand-300 hover:text-brand-600 flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t("dogs.addDog")}
                </button>

                {dogs.every((d) => !d.name.trim()) && (
                  <p className="text-xs text-amber-600 text-center">{t("dogs.needOne")}</p>
                )}
                <button
                  disabled={dogs.every((d) => !d.name.trim())}
                  onClick={() => setStep("confirm")}
                  className="btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("dogs.continue")}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Confirm ────────────────────────────────────────────── */}
          {step === "confirm" && selectedService && (selectedSlot || selectedService.type === "boarding") && (
            <div className="p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("dogs")} className="text-brand-600 text-sm flex items-center gap-1 hover:text-brand-700 hover:underline">
                  <ChevronRight className="w-4 h-4 ltr:-scale-x-100" /> {t("back")}
                </button>
                <h2 className="text-lg font-bold text-petra-text">{t("confirm.title")}</h2>
              </div>

              <div className="space-y-4">
                {/* Summary card */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: selectedService.color ? `${selectedService.color}22` : "#FFF7ED" }}>
                      <ServiceIcon type={selectedService.type} className="w-4 h-4" {...({ style: { color: selectedService.color || "#F97316" } } as any)} />
                    </div>
                    <div>
                      <p className="text-xs text-petra-muted">{t("confirm.service")}</p>
                      <p className="font-semibold text-petra-text">{selectedService.name}</p>
                      <p className="text-sm text-petra-muted">{t("confirm.durationPrice", { count: selectedService.duration, price: formatPrice(selectedService.price) })}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      {selectedService.type === "boarding" ? (
                        <>
                          <p className="text-xs text-petra-muted">{t("confirm.boardingDates")}</p>
                          <p className="font-semibold text-petra-text">
                            {t("confirm.checkInAt", { date: new Date(boardingCheckInDate + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" }), time: boardingCheckInTime })}
                          </p>
                          <p className="font-semibold text-petra-text">
                            {t("confirm.checkOutAt", { date: new Date(boardingCheckOutDate + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" }), time: boardingCheckOutTime })}
                          </p>
                          <p className="text-sm text-petra-muted">
                            {t("confirm.nights", { count: Math.ceil((new Date(boardingCheckOutDate).getTime() - new Date(boardingCheckInDate).getTime()) / 86400000) })}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-petra-muted">{t("confirm.when")}</p>
                          <p className="font-semibold text-petra-text">
                            {new Date(selectedDate + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          <p className="text-sm text-petra-muted">{t("confirm.timeAt", { time: selectedSlot!.time })}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-petra-muted">{t("confirm.owner")}</p>
                      <p className="font-semibold text-petra-text">{customerName || t("customer.existing")}</p>
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
                      <p className="text-xs text-petra-muted">{t("confirm.dogs")}</p>
                      {dogs.filter((d) => d.name.trim()).map((d, i) => (
                        <p key={i} className="font-semibold text-petra-text">{d.name}{d.breed ? ` (${d.breed})` : ""}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedService.bookingMode === "requires_approval" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    {t("confirm.requiresApproval")}
                  </div>
                )}

                {selectedService.depositRequired && selectedService.depositAmount && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    {t("confirm.depositNotice", { amount: formatPrice(selectedService.depositAmount) })}
                  </div>
                )}

                {business.cancellationPolicy && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <p className="font-semibold mb-1">{t("confirm.cancellationPolicy")}</p>
                    <p className="whitespace-pre-wrap">{business.cancellationPolicy}</p>
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
                      {t("confirm.submit")}
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
                <h2 className="text-lg font-bold text-petra-text mb-1">{t("deposit.title")}</h2>
                <p className="text-sm text-petra-muted">
                  {t("deposit.body")}
                </p>
              </div>

              {/* Deposit details */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-800">{t("deposit.amountLabel")}</span>
                  <span className="text-lg font-bold text-amber-900">
                    {formatPrice(selectedService.depositAmount || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-700">
                  <span>{t("deposit.service", { name: selectedService.name })}</span>
                  <span>{t("deposit.fullPrice", { price: formatPrice(selectedService.price) })}</span>
                </div>
              </div>

              {/* Booking ID */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-petra-muted text-center mb-4">
                <p>{t.rich("deposit.bookingNumber", { id: bookingResult.bookingId.slice(0, 8).toUpperCase(), b: (c) => <span className="font-mono font-bold text-petra-text text-sm">{c}</span> })}</p>
              </div>

              {/* Payment link or instructions */}
              {selectedService.paymentUrl ? (
                <>
                  <a
                    href={selectedService.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full py-4 justify-center text-lg mb-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    {t("deposit.payButton")}
                  </a>
                  <p className="text-center text-xs text-petra-muted mb-3">{t("deposit.payHint")}</p>
                </>
              ) : business?.depositInstructions ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3 text-sm text-blue-800">
                  <p className="font-semibold mb-2">{t("deposit.instructionsTitle")}</p>
                  <p className="whitespace-pre-wrap text-xs">{business.depositInstructions}</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3 text-sm text-blue-800 text-center">
                  <p className="font-semibold mb-1">{t("deposit.contactTitle")}</p>
                  {business?.phone && (
                    <a href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(business.phone)}&text=${encodeURIComponent(t("deposit.whatsappText", { service: selectedService.name, id: bookingResult.bookingId.slice(0, 8).toUpperCase() }))}`} className="text-green-600 hover:underline flex items-center justify-center gap-1 mt-1">
                      <MessageCircle className="w-4 h-4" /> {t("deposit.whatsappButton")}
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
                {t("deposit.done")}
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
                {bookingResult.status === "confirmed" ? t("done.confirmedTitle") : t("done.requestTitle")}
              </h2>
              <p className="text-petra-muted text-sm mb-2">{bookingResult.message}</p>

              {/* Booking ID badge */}
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2 mb-5">
                <span className="text-xs text-petra-muted">{t("done.bookingNumber")}</span>
                <span className="font-mono font-bold text-petra-text tracking-wider">{bookingResult.bookingId.slice(0, 8).toUpperCase()}</span>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-start space-y-2 mb-5">
                <div className="flex items-center gap-2">
                  <ServiceIcon type={selectedService.type} className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  <span className="text-petra-muted">{t("done.service")}</span>
                  <span className="font-medium text-petra-text">{selectedService.name}</span>
                </div>
                {selectedService.type === "boarding" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-petra-muted">{t("done.checkIn")}</span>
                      <span className="font-medium text-petra-text">
                        {new Date(boardingCheckInDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long" })} {boardingCheckInTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-petra-muted">{t("done.checkOut")}</span>
                      <span className="font-medium text-petra-text">
                        {new Date(boardingCheckOutDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long" })} {boardingCheckOutTime}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-petra-muted">{t("done.date")}</span>
                      <span className="font-medium text-petra-text">
                        {new Date(selectedDate + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-petra-muted">{t("done.time")}</span>
                      <span className="font-medium text-petra-text">{selectedSlot!.time}</span>
                    </div>
                  </>
                )}
                {dogs.filter(d => d.name.trim()).length > 0 && (
                  <div className="flex items-center gap-2">
                    <PawPrint className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-petra-muted">{t("done.dog")}</span>
                    <span className="font-medium text-petra-text">{dogs.filter(d => d.name.trim()).map(d => d.name).join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 mb-5">
                {/* Add to Google Calendar */}
                {selectedService.type !== "boarding" && selectedSlot && (
                  <a
                    href={buildGoogleCalLink(t, formatPrice, selectedService, selectedDate, selectedSlot.time, business.name, business.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    {t("done.addToGoogle")}
                  </a>
                )}

                {/* Send self WA reminder */}
                {selectedService.type !== "boarding" && selectedSlot && (
                  <a
                    href={`https://api.whatsapp.com/send?text=${buildWhatsAppReminder(t, locale, formatPrice, selectedService, selectedDate, selectedSlot.time, customerName, dogs.filter(d => d.name.trim()).map(d => d.name))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors text-sm font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {t("done.whatsappReminder")}
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
                {t("done.bookAnother")}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-petra-muted mt-6">
          {t.rich("footer.poweredBy", {
            link: (c) => (
              <a href="https://petra-app.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:underline">
                {c}
              </a>
            ),
          })}
        </p>
      </div>
    </main>
  )
}
