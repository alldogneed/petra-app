"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName, normalizeIsraeliPhone } from "@/lib/validation";
import { parseTags, REFERRAL_SOURCES, type EnhancedCustomer } from "./types";

// ─── Edit Customer Modal ────────────────────────────────────────

export function EditCustomerModal({
  isOpen,
  onClose,
  customer,
  presetTags,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: EnhancedCustomer | null;
  presetTags: string[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    idNumber: "",
    notes: "",
    selectedTags: [] as string[],
    source: "",
  });
  const [editFieldErrors, setEditFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  // Sync form when customer changes
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        address: customer.address || "",
        idNumber: customer.idNumber || "",
        notes: customer.notes || "",
        selectedTags: parseTags(customer.tags),
        source: customer.source || "",
      });
      setEditFieldErrors({});
    }
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleEditTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/customers/${customer?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          idNumber: data.idNumber || null,
          notes: data.notes || null,
          tags: JSON.stringify(data.selectedTags),
          source: data.source || null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onClose();
      toast.success("פרטי הלקוח עודכנו");
    },
    onError: () => toast.error("שגיאה בעדכון הלקוח. נסה שוב."),
  });

  function validateAndSubmitEdit() {
    const errors: typeof editFieldErrors = {};
    const nameErr = validateName(form.name);
    if (nameErr) errors.name = nameErr;
    const phoneErr = validateIsraeliPhone(form.phone);
    if (phoneErr) errors.phone = phoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) errors.email = emailErr;
    setEditFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate({ ...form, name: sanitizeName(form.name), phone: normalizeIsraeliPhone(form.phone) });
  }

  if (!isOpen || !customer) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">עריכת לקוח</h2>
            <p className="text-sm text-petra-muted mt-0.5">{customer.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם מלא *</label>
            <input
              className={cn("input", editFieldErrors.name && "border-red-300 focus:ring-red-200")}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (editFieldErrors.name) setEditFieldErrors({ ...editFieldErrors, name: undefined }); }}
            />
            {editFieldErrors.name && <p className="text-xs text-red-500 mt-1">{editFieldErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className={cn("input", editFieldErrors.phone && "border-red-300 focus:ring-red-200")}
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (editFieldErrors.phone) setEditFieldErrors({ ...editFieldErrors, phone: undefined }); }}
                inputMode="tel"
              />
              {editFieldErrors.phone && <p className="text-xs text-red-500 mt-1">{editFieldErrors.phone}</p>}
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className={cn("input", editFieldErrors.email && "border-red-300 focus:ring-red-200")}
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); if (editFieldErrors.email) setEditFieldErrors({ ...editFieldErrors, email: undefined }); }}
              />
              {editFieldErrors.email && <p className="text-xs text-red-500 mt-1">{editFieldErrors.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">כתובת</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label className="label">תעודת זהות</label>
              <input
                className="input"
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                inputMode="numeric"
                placeholder="000000000"
              />
            </div>
          </div>
          <div>
            <label className="label">תגיות לקוח</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {presetTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleEditTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${form.selectedTags.includes(tag)
                    ? tag === "VIP"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-[#3D2E1F] text-white border-[#3D2E1F]"
                    : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">מקור הגעה</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="">— לא ידוע —</option>
              {REFERRAL_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={validateAndSubmitEdit}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
