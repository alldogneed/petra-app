"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  CheckCircle2,
  User,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}

interface Slot {
  time: string;
  available: boolean;
}

const STEPS = ["שירות", "תאריך", "שעה", "פרטים", "אישור"];

export default function BookingPage() {
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load services
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]));
  }, []);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setSlotsLoading(true);
    fetch(`/api/booking/slots?date=${selectedDate}&serviceId=${selectedService.id}`)
      .then((r) => r.json())
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedService]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/booking/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService!.id,
          date: selectedDate,
          time: selectedTime,
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה ביצירת הזמנה");
        return;
      }
      setSuccess(true);
    } catch {
      setError("שגיאה בשליחת ההזמנה. נסה שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  // Generate dates for next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.1)" }}
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">ההזמנה נשלחה!</h1>
          <p className="text-sm text-slate-500 mb-1">
            {selectedService?.name} - {selectedDate} בשעה {selectedTime}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            ההזמנה ממתינה לאישור. נעדכן אותך בקרוב.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <div
            className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)" }}
          >
            <span className="text-white text-lg font-bold">P</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">הזמנת תור</h1>
          <p className="text-xs text-slate-500 mt-1">בחר שירות, תאריך ושעה</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex items-center gap-1",
                i > 0 && "mr-1"
              )}
            >
              {i > 0 && (
                <div
                  className={cn(
                    "w-4 h-px",
                    i <= step ? "bg-orange-400" : "bg-slate-200"
                  )}
                />
              )}
              <div
                className={cn(
                  "w-6 h-6 rounded-full text-[10px] font-medium flex items-center justify-center",
                  i < step
                    ? "bg-orange-500 text-white"
                    : i === step
                    ? "bg-orange-100 text-orange-600 ring-2 ring-orange-500"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {i < step ? "✓" : i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          {/* Step 0: Service */}
          {step === 0 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">בחר שירות</h2>
              <div className="space-y-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => {
                      setSelectedService(svc);
                      setStep(1);
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl text-right transition-all flex items-center justify-between",
                      selectedService?.id === svc.id
                        ? "bg-orange-50 border-2 border-orange-400"
                        : "bg-slate-50 border border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{svc.name}</p>
                      <p className="text-xs text-slate-500">
                        {svc.duration} דקות
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      ₪{svc.price}
                    </span>
                  </button>
                ))}
                {services.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    אין שירותים זמינים
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Date */}
          {step === 1 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">בחר תאריך</h2>
              <div className="grid grid-cols-7 gap-1.5">
                {dates.map((d) => {
                  const dateStr = d.toISOString().split("T")[0];
                  const isSelected = selectedDate === dateStr;
                  const dayName = d.toLocaleDateString("he-IL", { weekday: "short" });
                  const dayNum = d.getDate();
                  const isSaturday = d.getDay() === 6;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedTime("");
                        setStep(2);
                      }}
                      disabled={isSaturday}
                      className={cn(
                        "flex flex-col items-center p-2 rounded-xl text-center transition-all",
                        isSelected
                          ? "bg-orange-500 text-white"
                          : isSaturday
                          ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                          : "bg-slate-50 hover:bg-orange-50 text-slate-700"
                      )}
                    >
                      <span className="text-[9px]">{dayName}</span>
                      <span className="text-sm font-bold">{dayNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Time */}
          {step === 2 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">בחר שעה</h2>
              <p className="text-xs text-slate-500 mb-4">
                {new Date(selectedDate).toLocaleDateString("he-IL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              {slotsLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : slots.filter((s) => s.available).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500">אין משבצות פנויות ביום זה</p>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs text-orange-500 mt-2"
                  >
                    בחר תאריך אחר
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => {
                        if (slot.available) {
                          setSelectedTime(slot.time);
                          setStep(3);
                        }
                      }}
                      disabled={!slot.available}
                      className={cn(
                        "py-2.5 rounded-xl text-sm font-medium transition-all",
                        selectedTime === slot.time
                          ? "bg-orange-500 text-white"
                          : slot.available
                          ? "bg-slate-50 text-slate-700 hover:bg-orange-50"
                          : "bg-slate-50 text-slate-300 cursor-not-allowed line-through"
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">פרטים אישיים</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    שם מלא *
                  </label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="הכנס שם מלא"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    טלפון *
                  </label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="050-1234567"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    אימייל
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="email@example.com"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    הערות
                  </label>
                  <div className="relative">
                    <FileText className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-orange-400 transition-colors resize-none"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="מידע נוסף..."
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(4)}
                disabled={!form.name || !form.phone}
                className="w-full mt-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
              >
                המשך לאישור
              </button>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">אישור הזמנה</h2>

              <div className="space-y-3 bg-slate-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">שירות</span>
                  <span className="font-medium text-slate-900">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">תאריך</span>
                  <span className="font-medium text-slate-900">
                    {new Date(selectedDate).toLocaleDateString("he-IL")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">שעה</span>
                  <span className="font-medium text-slate-900">{selectedTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">שם</span>
                  <span className="font-medium text-slate-900">{form.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">טלפון</span>
                  <span className="font-medium text-slate-900" dir="ltr">{form.phone}</span>
                </div>
                {selectedService && (
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                    <span className="text-slate-500">מחיר</span>
                    <span className="font-bold text-slate-900">₪{selectedService.price}</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium disabled:opacity-50 hover:bg-orange-600 transition-colors"
              >
                {submitting ? "שולח..." : "אישור הזמנה"}
              </button>
            </div>
          )}

          {/* Navigation */}
          {step > 0 && step < 4 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 mt-4 text-xs text-slate-500 hover:text-slate-700"
            >
              <ChevronRight className="w-3 h-3" />
              חזור
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6">
          Powered by Petra
        </p>
      </div>
    </div>
  );
}
