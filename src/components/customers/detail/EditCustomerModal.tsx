"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { fetchJSON } from "@/lib/utils";
import { validateIsraeliPhone, validateEmail, sanitizeName, normalizeIsraeliPhone, validateName } from "@/lib/validation";
import type { CustomerDetail } from "./types";

export const DEFAULT_CUSTOMER_TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"]; // i18n-ok — stored tag values (Phase 3)

/** Labels: `customers.detailEditCustomerModal.sources.<value>` */
export const REFERRAL_SOURCES = [
  { value: "referral" },
  { value: "google" },
  { value: "instagram" },
  { value: "facebook" },
  { value: "tiktok" },
  { value: "signage" },
  { value: "other" },
];

export function EditCustomerModal({
  customer,
  isOpen,
  onClose,
}: {
  customer: CustomerDetail;
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("customers.detailEditCustomerModal");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();

  const { data: businessSettings } = useQuery<{ customerTags?: string }>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<{ customerTags?: string }>("/api/settings"),
    staleTime: 60_000,
  });

  const presetTags = useMemo(() => {
    if (!businessSettings?.customerTags) return DEFAULT_CUSTOMER_TAGS;
    try {
      const parsed = JSON.parse(businessSettings.customerTags);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CUSTOMER_TAGS;
    } catch {
      return DEFAULT_CUSTOMER_TAGS;
    }
  }, [businessSettings?.customerTags]);

  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    address: customer.address || "",
    idNumber: customer.idNumber || "",
    notes: customer.notes || "",
    source: customer.source || "",
    selectedTags: (() => {
      try {
        const parsed = JSON.parse(customer.tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })() as string[],
  });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((x) => x !== tag)
        : [...prev.selectedTags, tag],
    }));
  };

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const r = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || t("errorUpdate"));
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("errorUpdateRetry")),
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("title")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("fields.name")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("fields.phone")}</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("fields.email")}</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">{t("fields.address")}</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("fields.idNumber")}</label>
            <input
              className="input"
              placeholder={t("fields.idNumberPlaceholder")}
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("fields.tags")}</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {presetTags.map((tag: string) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
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
            <label className="label">{t("fields.source")}</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="">{t("sourceUnknown")}</option>
              {REFERRAL_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{t(`sources.${s.value}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("fields.notes")}</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => {
              const errors: typeof fieldErrors = {};
              const nameErr = validateName(form.name);
              if (nameErr) errors.name = nameErr;
              const phoneErr = validateIsraeliPhone(form.phone);
              if (phoneErr) errors.phone = phoneErr;
              const emailErr = validateEmail(form.email);
              if (emailErr) errors.email = emailErr;
              setFieldErrors(errors);
              if (Object.keys(errors).length > 0) return;
              mutation.mutate({
                name: sanitizeName(form.name),
                phone: normalizeIsraeliPhone(form.phone),
                email: form.email || null,
                address: form.address || null,
                idNumber: form.idNumber || null,
                notes: form.notes || null,
                source: form.source || null,
                tags: JSON.stringify(form.selectedTags),
              });
            }}
          >
            {mutation.isPending ? tc("progress.saving") : t("saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
        {fieldErrors.name && <p className="text-xs text-red-500 mt-2">{fieldErrors.name}</p>}
        {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
        {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
      </div>
    </div>
  );
}
