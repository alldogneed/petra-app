"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/CustomerPicker";



// ─── New Appointment Modal ────────────────────────────────────────────────────

export function NewAppointmentModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("dashboard.newAppointmentModal");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    customerId: "",
    petId: "",
    serviceId: "",
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });

  const [pickedCustomer, setPickedCustomer] = useState<PickerCustomer | null>(null);

  const { data: services } = useQuery<{ id: string; name: string; duration: number | null; type: string }[]>({
    queryKey: ["services-for-appt"],
    queryFn: () => fetch("/api/services").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    enabled: isOpen,
  });

  const selectedCustomer = pickedCustomer && pickedCustomer.id === form.customerId ? pickedCustomer : null;

  // Auto-fill end time when service changes
  const setField = (key: keyof typeof form, value: string) => {
    if (key === "serviceId") {
      const svc = services?.find((s) => s.id === value);
      if (svc?.duration && form.startTime) {
        const [h, m] = form.startTime.split(":").map(Number);
        const endMin = h * 60 + m + svc.duration;
        const endH = Math.floor(endMin / 60) % 24;
        const endM = endMin % 60;
        setForm((prev) => ({
          ...prev,
          serviceId: value,
          endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        }));
        return;
      }
    }
    if (key === "customerId") {
      setForm((prev) => ({ ...prev, customerId: value, petId: "" }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          serviceId: form.serviceId,
          customerId: form.customerId,
          petId: form.petId || null,
          notes: form.notes || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.create")); return d; }),
    onSuccess: () => {
      setForm({ customerId: "", petId: "", serviceId: "", date: today, startTime: "09:00", endTime: "10:00", notes: "" });
      setPickedCustomer(null);
      toast.success(t("toasts.created"));
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.createError")),
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-brand-500" />
            {t("title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="label">{t("fields.customer")}</label>
            <CustomerPicker
              value={form.customerId || null}
              selectedCustomer={selectedCustomer}
              onSelect={(c, matchedPetId) => {
                setPickedCustomer(c);
                setForm((prev) => ({
                  ...prev,
                  customerId: c.id,
                  petId: matchedPetId ?? "",
                }));
              }}
              onClear={() => {
                setPickedCustomer(null);
                setField("customerId", "");
              }}
            />
          </div>

          {/* Pet (optional, shown when customer selected) */}
          {selectedCustomer && (selectedCustomer.pets?.length ?? 0) > 0 && (
            <div>
              <label className="label">{t("fields.pet")}</label>
              <select
                className="input"
                value={form.petId}
                onChange={(e) => setField("petId", e.target.value)}
              >
                <option value="">{t("fields.noPet")}</option>
                {selectedCustomer.pets?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Service */}
          <div>
            <label className="label">{t("fields.service")}</label>
            <select
              className="input"
              value={form.serviceId}
              onChange={(e) => setField("serviceId", e.target.value)}
            >
              <option value="">{t("fields.selectService")}</option>
              {services?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.duration ? t("fields.durationSuffix", { duration: s.duration }) : ""}</option>
              ))}
            </select>
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">{t("fields.date")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("fields.startTime")}</label>
              <input
                type="time"
                className="input"
                value={form.startTime}
                onChange={(e) => setField("startTime", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("fields.endTime")}</label>
              <input
                type="time"
                className="input"
                value={form.endTime}
                onChange={(e) => setField("endTime", e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">{t("fields.notes")}</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder={t("fields.notesPlaceholder")}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.customerId || !form.serviceId || !form.date || mutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            {mutation.isPending ? tc("progress.saving") : t("submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-red-600 text-xs mt-2">{t("errors.save")}</p>
        )}
      </div>
    </div>
  );
}
