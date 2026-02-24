"use client";

import { useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  duration: number;
}

interface ScheduleServiceFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customerId: string | null;
  customerName: string;
}

export function ScheduleServiceForm({
  open,
  onClose,
  onSaved,
  customerId,
  customerName,
}: ScheduleServiceFormProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    // Set to tomorrow for a more realistic booking
    today.setDate(today.getDate() + 1);
    setDate(today.toISOString().split("T")[0]);
  }, []);

  // Fetch services (only when dialog opens)
  useEffect(() => {
    if (!open) return;
    fetch("/api/services")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch services");
        return r.json();
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        setServices(items);
        if (items.length > 0) {
          setServiceId((prev) => prev || items[0].id);
        }
      })
      .catch(() => setServices([]));
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerId) {
      setError("לא נמצא לקוח. חזרו לשלב הקודם.");
      return;
    }

    if (!serviceId || !date || !startTime) {
      setError("יש למלא את כל השדות");
      return;
    }

    setSaving(true);
    try {
      // Calculate end time from service duration
      const svc = services.find((s) => s.id === serviceId);
      const duration = svc?.duration ?? 60;
      const [h, m] = startTime.split(":").map(Number);
      const endMinutes = h * 60 + m + duration;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
          serviceId,
          customerId,
          status: "scheduled",
        }),
      });

      if (!res.ok) throw new Error("Failed to create appointment");

      onSaved();
    } catch {
      setError("שגיאה בקביעת השירות. נסה שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm p-6 animate-scale-in">
        <h3 className="text-lg font-bold text-petra-text mb-1">
          קביעת שירות ראשון
        </h3>
        <p className="text-sm text-petra-muted mb-5">
          קבע שירות עבור {customerName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service picker */}
          <div>
            <label className="label">שירות</label>
            {services.length === 0 ? (
              <p className="text-sm text-petra-muted">
                אין שירותים במערכת. ייווצר שירות ברירת מחדל.
              </p>
            ) : (
              <select
                className="input"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                disabled={saving}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration} דק׳)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">תאריך</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              dir="ltr"
            />
          </div>

          {/* Time */}
          <div>
            <label className="label">שעה</label>
            <input
              type="time"
              className="input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={saving}
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || (!serviceId && services.length > 0)}
            className="btn-primary w-full justify-center py-3"
          >
            {saving ? "שומר..." : "שמור והמשך"}
          </button>
        </form>
      </div>
    </div>
  );
}
