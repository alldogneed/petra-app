"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight, ChevronLeft, Check, Clock, Calendar, PawPrint, User, Plus, X } from "lucide-react"

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
  breed: string
  sex: string
  notes: string
  isNew: boolean
}

type Step = "service" | "date" | "time" | "customer" | "dogs" | "confirm" | "done"

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

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "שירות" },
  { key: "date", label: "תאריך" },
  { key: "time", label: "שעה" },
  { key: "customer", label: "פרטים" },
  { key: "dogs", label: "כלבים" },
  { key: "confirm", label: "אישור" },
]

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current)
  if (currentIdx === -1) return null
  return (
    <div className="flex items-center justify-center gap-1 mb-6 overflow-x-auto pb-1">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${i < currentIdx
              ? "bg-green-500 text-white"
              : i === currentIdx
                ? "bg-amber-500 text-white"
                : "bg-gray-200 text-gray-500"
              }`}
          >
            {i < currentIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={`hidden sm:block ml-1 mr-2 text-xs ${i === currentIdx ? "text-amber-700 font-medium" : "text-gray-400"}`}>
            {step.label}
          </span>
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-300 mx-1" />}
        </div>
      ))}
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

  // Customer fields
  const [phone, setPhone] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerNotes] = useState("")
  const [isNewCustomer, setIsNewCustomer] = useState<boolean | null>(null)

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
        const res = await fetch(`/api/book/${slug}/slots?serviceId=${serviceId}&date=${date}`)
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
    if (!selectedService || !selectedSlot) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch(`/api/book/${slug}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          startAt: selectedSlot.startAt,
          phone,
          customerName: isNewCustomer ? customerName : undefined,
          customerEmail: isNewCustomer ? customerEmail : undefined,
          customerNotes: isNewCustomer ? customerNotes : undefined,
          dogs: dogs
            .filter((d) => d.id || d.name.trim())
            .map((d) => d.id ? { id: d.id } : { name: d.name, breed: d.breed, sex: d.sex, notes: d.notes }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "שגיאה ביצירת ההזמנה")
      } else {
        setBookingResult(data)
        setStep("done")
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
        if (data.dogs && data.dogs.length > 0) {
          // If only 1 dog, pre-select it (by setting its name as valid), otherwise require explicit selection.
          const autoSelect = data.dogs.length === 1
          setDogs(data.dogs.map((d: any) => ({
            id: d.id,
            name: autoSelect ? d.name : "", // We use empty name to represent "unselected" for existing dogs
            _originalName: d.name, // Keep original name to display
            breed: d.breed || "",
            sex: d.gender || "",
            notes: "",
            isNew: false
          })))
        }
      } else {
        setIsNewCustomer(true)
        setCustomerName("")
        setDogs([{ name: "", breed: "", sex: "", notes: "", isNew: true }])
      }
    } catch (e) {
      console.error("Phone lookup failed", e)
      setIsNewCustomer(true) // Fallback to manual entry
    } finally {
      setIsLookingUpPhone(false)
    }
  }, [slug])

  // Debounce phone changes for lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phone.length >= 9 && isNewCustomer === null) {
        lookupPhone(phone)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [phone, isNewCustomer, lookupPhone])

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <PawPrint className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-700 mb-2">העסק לא נמצא</h1>
          <p className="text-gray-500">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  const isOpenDay = (date: Date) => {
    const dow = date.getDay()
    const rule = business.availabilityRules.find((r) => r.dayOfWeek === dow)
    return rule?.isOpen ?? false
  }

  const today = toDateStr(new Date())
  const calDates = getDatesForMonth(calMonth.year, calMonth.month)
  const firstDow = new Date(calMonth.year, calMonth.month, 1).getDay()

  // ─── Render card ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {business.logo ? (
            <img src={business.logo} alt={business.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-amber-600" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-gray-900 text-sm leading-tight">{business.name}</h1>
            <p className="text-xs text-gray-500">הזמנה אונליין</p>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {step !== "done" && <StepIndicator current={step} />}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* ── Step: Service ────────────────────────────────────────────── */}
          {step === "service" && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">בחר שירות</h2>
              {business.services.length === 0 ? (
                <p className="text-gray-500 text-center py-8">אין שירותים זמינים כרגע</p>
              ) : (
                <div className="space-y-3">
                  {business.services.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => { setSelectedService(svc); setSelectedDate(""); setSelectedSlot(null); setStep("date") }}
                      className="w-full text-right p-4 rounded-xl border-2 border-gray-100 hover:border-amber-300 hover:bg-amber-50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {svc.color && (
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: svc.color }} />
                            )}
                            <span className="font-semibold text-gray-900 group-hover:text-amber-700">{svc.name}</span>
                          </div>
                          {svc.description && (
                            <p className="text-xs text-gray-500 mb-1">{svc.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{svc.duration} דקות</span>
                            {svc.depositRequired && svc.depositAmount && (
                              <span className="text-amber-600">מקדמה: {formatPrice(svc.depositAmount)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{formatPrice(svc.price)}</span>
                          <ChevronLeft className="w-4 h-4 text-gray-400 group-hover:text-amber-500" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Date ───────────────────────────────────────────────── */}
          {step === "date" && selectedService && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("service")} className="text-amber-600 text-sm flex items-center gap-1 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-gray-800">בחר תאריך</h2>
              </div>

              {/* Service summary */}
              <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                {selectedService.color && (
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedService.color }} />
                )}
                <span className="text-sm font-medium text-amber-800">{selectedService.name}</span>
                <span className="text-xs text-amber-600 mr-auto">{selectedService.duration} דקות</span>
              </div>

              {/* Calendar navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  className="p-1 rounded hover:bg-gray-100"
                  disabled={calMonth.year === new Date().getFullYear() && calMonth.month <= new Date().getMonth()}
                >
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-700">
                  {new Date(calMonth.year, calMonth.month).toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCalMonth((p) => {
                    const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HE.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-400 py-1">{d.slice(0, 1)}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
                {calDates.map((date) => {
                  const ds = toDateStr(date)
                  const isPast = ds < today
                  const open = isOpenDay(date)
                  const isSelected = ds === selectedDate
                  return (
                    <button
                      key={ds}
                      disabled={isPast || !open}
                      onClick={() => { setSelectedDate(ds); setSelectedSlot(null); setStep("time") }}
                      className={`
                        aspect-square rounded-lg text-sm font-medium transition-colors
                        ${isPast || !open ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"}
                        ${isSelected ? "bg-amber-500 text-white" :
                          !isPast && open ? "hover:bg-amber-100 text-gray-700" : ""}
                      `}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step: Time ───────────────────────────────────────────────── */}
          {step === "time" && selectedService && selectedDate && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("date")} className="text-amber-600 text-sm flex items-center gap-1 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-gray-800">בחר שעה</h2>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mb-4 text-sm text-amber-800 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
              </div>

              {slotsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>אין זמינות ביום זה</p>
                  <button onClick={() => setStep("date")} className="mt-3 text-amber-600 text-sm hover:underline">בחר תאריך אחר</button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.startAt}
                      onClick={() => { setSelectedSlot(slot); setStep("customer") }}
                      className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${selectedSlot?.startAt === slot.startAt
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700"
                        }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Customer ───────────────────────────────────────────── */}
          {step === "customer" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("time")} className="text-amber-600 text-sm flex items-center gap-1 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-gray-800">פרטי בעל הכלב</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר טלפון *</label>
                  <div className="flex gap-2 relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setIsNewCustomer(null)
                      }}
                      placeholder="050-0000000"
                      className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    {isLookingUpPhone && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                </div>

                {isNewCustomer === null && phone.length >= 9 && !isLookingUpPhone && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsNewCustomer(false)}
                      className="flex-1 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50"
                    >
                      לקוח קיים
                    </button>
                    <button
                      onClick={() => setIsNewCustomer(true)}
                      className="flex-1 py-2 text-sm bg-amber-50 border border-amber-300 text-amber-700 rounded-xl hover:bg-amber-100"
                    >
                      לקוח חדש
                    </button>
                  </div>
                )}

                {isNewCustomer === true && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="ישראל ישראלי"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </>
                )}

                {isNewCustomer === false && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      שלום {customerName}, מצאנו אותך במערכת!
                    </div>
                    <p className="text-amber-700">הפרטים שלך ושל הכלבים ששמורים אצלנו כבר הוטענו.</p>
                  </div>
                )}

                <button
                  disabled={!phone || phone.length < 9 || isNewCustomer === null || isLookingUpPhone || (isNewCustomer && !customerName)}
                  onClick={() => setStep("dogs")}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors"
                >
                  המשך
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Dogs ───────────────────────────────────────────────── */}
          {step === "dogs" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("customer")} className="text-amber-600 text-sm flex items-center gap-1 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-gray-800">בחירת כלבים להזמנה</h2>
              </div>

              <div className="space-y-4">
                {dogs.map((dog, idx) => {
                  const isSelected = !!dog.name.trim();

                  return (
                    <div key={idx} className={`border rounded-xl p-4 relative transition-colors ${!dog.isNew ? (isSelected ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-400' : 'border-gray-200 bg-white opacity-60 hover:opacity-100') : 'border-gray-200'}`}>
                      {dogs.length > 1 && dog.isNew && (
                        <button
                          onClick={() => setDogs((d) => d.filter((_, i) => i !== idx))}
                          className="absolute top-3 left-3 text-gray-400 hover:text-red-500"
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
                              // Restore original name to mark as selected
                              setDogs(d => d.map((x, i) => i === idx ? { ...x, name: (x as any)._originalName } : x))
                            }
                          }}
                        />
                      )}


                      {!dog.isNew && (
                        <div className="absolute top-3 left-3">
                          <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-1 rounded-md">
                            שמור במערכת
                          </span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">שם הכלב *</label>
                          <input
                            type="text"
                            value={dog.isNew ? dog.name : (dog as any)._originalName}
                            disabled={!dog.isNew}
                            onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                            placeholder="בוקסר, רקסי..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">גזע</label>
                            <input
                              type="text"
                              value={dog.breed}
                              disabled={!dog.isNew}
                              onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, breed: e.target.value } : x))}
                              placeholder="לברדור..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">מין</label>
                            <select
                              value={dog.sex}
                              disabled={!dog.isNew}
                              onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, sex: e.target.value } : x))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 disabled:text-gray-500 bg-white disabled:bg-gray-50"
                            >
                              <option value="">לא ידוע</option>
                              <option value="male">זכר</option>
                              <option value="female">נקבה</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">הערות</label>
                          <input
                            type="text"
                            value={dog.notes}
                            onChange={(e) => setDogs((d) => d.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                            placeholder="אלרגיות, מידע רפואי..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                    </div>
                  )})}

                <button
                  onClick={() => setDogs((d) => [...d, { name: "", breed: "", sex: "", notes: "", isNew: true }])}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-amber-300 hover:text-amber-600 flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> הוסף כלב נוסף
                </button>

                <button
                  disabled={dogs.every((d) => !d.name.trim())}
                  onClick={() => setStep("confirm")}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors"
                >
                  המשך לאישור
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Confirm ────────────────────────────────────────────── */}
          {step === "confirm" && selectedService && selectedSlot && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("dogs")} className="text-amber-600 text-sm flex items-center gap-1 hover:underline">
                  <ChevronRight className="w-4 h-4" /> חזור
                </button>
                <h2 className="text-lg font-bold text-gray-800">אישור הזמנה</h2>
              </div>

              <div className="space-y-4">
                {/* Summary card */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">שירות</p>
                      <p className="font-semibold text-gray-800">{selectedService.name}</p>
                      <p className="text-sm text-gray-600">{selectedService.duration} דקות · {formatPrice(selectedService.price)}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">מועד</p>
                      <p className="font-semibold text-gray-800">
                        {new Date(selectedDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p className="text-sm text-gray-600">שעה {selectedSlot.time}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">בעל הכלב</p>
                      <p className="font-semibold text-gray-800">{customerName || "לקוח קיים"}</p>
                      <p className="text-sm text-gray-600">{phone}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <PawPrint className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">כלבים</p>
                      {dogs.filter((d) => d.name.trim()).map((d, i) => (
                        <p key={i} className="font-semibold text-gray-800">{d.name}{d.breed ? ` (${d.breed})` : ""}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedService.bookingMode === "requires_approval" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                    שירות זה דורש אישור מבעל העסק. תקבל הודעה לאחר האישור.
                  </div>
                )}

                {selectedService.depositRequired && selectedService.depositAmount && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    נדרשת מקדמה של {formatPrice(selectedService.depositAmount)} לאישור ההזמנה.
                  </div>
                )}

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{submitError}</div>
                )}

                <button
                  onClick={submitBooking}
                  disabled={submitting}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2"
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

          {/* ── Step: Done ───────────────────────────────────────────────── */}
          {step === "done" && bookingResult && (
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${bookingResult.status === "confirmed" ? "bg-green-100" : "bg-yellow-100"
                }`}>
                {bookingResult.status === "confirmed" ? (
                  <Check className="w-8 h-8 text-green-600" />
                ) : (
                  <Clock className="w-8 h-8 text-yellow-600" />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {bookingResult.status === "confirmed" ? "ההזמנה אושרה!" : "הבקשה התקבלה"}
              </h2>
              <p className="text-gray-600 mb-6">{bookingResult.message}</p>

              {selectedService && selectedSlot && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-right space-y-1 mb-6">
                  <p><span className="text-gray-500">שירות:</span> <span className="font-medium">{selectedService.name}</span></p>
                  <p><span className="text-gray-500">תאריך:</span> <span className="font-medium">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                  </span></p>
                  <p><span className="text-gray-500">שעה:</span> <span className="font-medium">{selectedSlot.time}</span></p>
                </div>
              )}

              <button
                onClick={() => {
                  setStep("service"); setSelectedService(null); setSelectedDate(""); setSelectedSlot(null)
                  setPhone(""); setCustomerName(""); setIsNewCustomer(null)
                  setDogs([{ name: "", breed: "", sex: "", notes: "", isNew: true }])
                  setBookingResult(null)
                }}
                className="w-full py-3 border-2 border-amber-300 text-amber-700 font-semibold rounded-xl hover:bg-amber-50 transition-colors"
              >
                הזמן שוב
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          מופעל על ידי <span className="font-semibold text-amber-600">Petra</span>
        </p>
      </div>
    </div>
  )
}
