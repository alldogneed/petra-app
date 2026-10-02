"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { triggerLimitModal } from "@/lib/limit-reached";
import { fetchJSON } from "@/lib/utils";
import type { CustomerDetail } from "./types";

export interface ServiceBasic {
  id: string;
  name: string;
  durationMinutes: number | null;
  category: string | null;
}

export function NewAppointmentModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: CustomerDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    priceListItemId: "",
    petId: "",
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });
  const [fieldError, setFieldError] = useState("");

  const { data: services = [] } = useQuery<ServiceBasic[]>({
    queryKey: ["price-list-items-all-active"],
    queryFn: () => fetch("/api/price-list-items").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJSON("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          priceListItemId: data.priceListItemId,
          petId: data.petId || null,
          date: data.date + "T00:00:00",
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes || null,
        }),
      }),
    onSuccess: () => {
      toast.success(`תור נקבע עבור ${customer.name}`);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error("שגיאה בקביעת התור. נסה שוב.");
      }
    },
  });

  // Auto-update endTime when service changes
  const handleServiceChange = (priceListItemId: string) => {
    const svc = services.find((s) => s.id === priceListItemId);
    if (svc) {
      const [h, m] = form.startTime.split(":").map(Number);
      const endMinutes = h * 60 + m + (svc.durationMinutes ?? 60);
      const endH = Math.floor(endMinutes / 60) % 24;
      const endM = endMinutes % 60;
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      setForm((f) => ({ ...f, priceListItemId, endTime }));
    } else {
      setForm((f) => ({ ...f, priceListItemId }));
    }
    setFieldError("");
  };

  // Keep end time in sync when start changes: use the selected service's
  // duration, otherwise preserve the current start→end gap.
  const handleStartTimeChange = (startTime: string) => {
    setForm((f) => {
      const [h, m] = startTime.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return { ...f, startTime };
      const svc = services.find((s) => s.id === f.priceListItemId);
      let dur = svc?.durationMinutes ?? null;
      if (dur == null) {
        const [oh, om] = f.startTime.split(":").map(Number);
        const [eh, em] = f.endTime.split(":").map(Number);
        const gap = (eh * 60 + em) - (oh * 60 + om);
        dur = gap > 0 ? gap : 60;
      }
      const endMinutes = h * 60 + m + dur;
      const endH = Math.floor(endMinutes / 60) % 24;
      const endM = endMinutes % 60;
      return { ...f, startTime, endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}` };
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-petra-text">תור חדש — {customer.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שירות *</label>
            <select
              className="input w-full"
              value={form.priceListItemId}
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="">בחר שירות...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {customer.pets.length > 0 && (
            <div>
              <label className="label">חיית מחמד</label>
              <select
                className="input w-full"
                value={form.petId}
                onChange={(e) => setForm((f) => ({ ...f, petId: e.target.value }))}
              >
                <option value="">ללא שיוך לחיה</option>
                {customer.pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">תאריך *</label>
            <input
              type="date" lang="he"
              className="input w-full"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שעת התחלה *</label>
              <input
                type="time"
                className="input w-full"
                value={form.startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </div>
            <div>
              <label className="label">שעת סיום *</label>
              <input
                type="time"
                className="input w-full"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input w-full"
              rows={2}
              placeholder="הערות נוספות..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              className="btn-primary flex-1"
              disabled={!form.priceListItemId || !form.date || !form.startTime || !form.endTime || mutation.isPending}
              onClick={() => {
                if (!form.priceListItemId) { setFieldError("יש לבחור שירות"); return; }
                mutation.mutate(form);
              }}
            >
              {mutation.isPending ? "שומר..." : "קבע תור"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
          {mutation.isError && (
            <p className="text-xs text-red-600 text-center">שגיאה ביצירת התור. נסה שוב.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Feeding Modal ───────────────────────────────────────────────────────
