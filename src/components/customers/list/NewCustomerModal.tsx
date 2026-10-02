"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { triggerLimitModal } from "@/lib/limit-reached";
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName, normalizeIsraeliPhone } from "@/lib/validation";
import { samePhone } from "@/lib/customer-filters";
import { REFERRAL_SOURCES } from "./types";

// ─── New Customer Modal ─────────────────────────────────────────

export function NewCustomerModal({
  isOpen,
  onClose,
  presetTags,
}: {
  isOpen: boolean;
  onClose: () => void;
  presetTags: string[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    idNumber: "",
    secondContactName: "",
    secondContactPhone: "",
    notes: "",
    selectedTags: [] as string[],
    source: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  const toggleNewTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          idNumber: data.idNumber || null,
          secondContactName: data.secondContactName || null,
          secondContactPhone: data.secondContactPhone || null,
          notes: data.notes || null,
          tags: JSON.stringify(data.selectedTags),
          source: data.source || null,
        }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: "שגיאה" }));
          const err = new Error(body.error || "שגיאה");
          if (body.code) (err as unknown as Record<string, unknown>).code = body.code;
          if (body.existingId) (err as unknown as Record<string, unknown>).existingId = body.existingId;
          throw err;
        }
        return r.json();
      }),
    onSuccess: (newCustomer: { id: string; name: string; phone: string | null }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      setForm({ name: "", phone: "", email: "", address: "", idNumber: "", secondContactName: "", secondContactPhone: "", notes: "", selectedTags: [], source: "" });
      setFieldErrors({});
      setDuplicate(null);
      const waPhone = newCustomer.phone ? toWhatsAppPhone(newCustomer.phone) : null;
      if (waPhone) {
        const welcomeMsg = `שלום ${newCustomer.name} 😊\n\nברוכים הבאים! שמחים שהצטרפתם אלינו 🐾\nאנחנו כאן לכל שאלה ובקשה.\n\nנשמח לראותכם בקרוב!`;
        toast.success("הלקוח נוצר בהצלחה", {
          action: {
            label: "שלח ברוכים הבאים",
            onClick: () => window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(welcomeMsg)}`, "_blank"),
          },
        });
      } else {
        toast.success("הלקוח נוצר בהצלחה");
      }
      router.push(`/customers/${newCustomer.id}`);
    },
    onError: (err: Error) => {
      const e = err as unknown as Record<string, unknown>;
      if (e.code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else if (e.code === "DUPLICATE_PHONE" && typeof e.existingId === "string") {
        const existingId = e.existingId;
        toast.error(err.message, {
          action: { label: "פתח את הלקוח", onClick: () => router.push(`/customers/${existingId}`) },
        });
      } else {
        // Surface the real server message instead of a generic error.
        toast.error(err.message || "שגיאה ביצירת הלקוח. נסה שוב.");
      }
    },
  });

  const modalRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Same normalized-phone match as the server list search (050-1234567 ≡ +972501234567).
  function checkPhoneDuplicate(phone: string) {
    if (phone.replace(/\D/g, "").length < 9) return;
    fetch(`/api/customers?search=${encodeURIComponent(phone)}&take=10`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list: Array<{ id: string; name: string; phone: string }> =
          data?.customers ?? (Array.isArray(data) ? data : []);
        const exact = list.find((c) => samePhone(c.phone, phone));
        setDuplicate(exact ? { id: exact.id, name: exact.name } : null);
      })
      .catch(() => {});
  }

  function validateAndSubmit() {
    const errors: typeof fieldErrors = {};
    const nameErr = validateName(form.name);
    if (nameErr) errors.name = nameErr;
    const phoneErr = validateIsraeliPhone(form.phone);
    if (phoneErr) errors.phone = phoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) errors.email = emailErr;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate({ ...form, name: sanitizeName(form.name), phone: normalizeIsraeliPhone(form.phone) });
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="new-customer-modal-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" ref={modalRef}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id="new-customer-modal-title" className="text-xl font-bold text-petra-text">לקוח חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף לקוח למערכת</p>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="nc-name" className="label">שם מלא *</label>
            <input
              id="nc-name"
              className={cn("input", fieldErrors.name && "border-red-300 focus:ring-red-200")}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: undefined }); }}
              placeholder="שם הלקוח"
              required
              aria-required="true"
              aria-describedby={fieldErrors.name ? "nc-name-error" : undefined}
            />
            {fieldErrors.name && <p id="nc-name-error" role="alert" className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="nc-phone" className="label">טלפון *</label>
              <input
                id="nc-phone"
                className={cn("input", fieldErrors.phone && "border-red-300 focus:ring-red-200")}
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined }); setDuplicate(null); }}
                onBlur={(e) => checkPhoneDuplicate(e.target.value)}
                placeholder="050-0000000"
                inputMode="tel"
                required
                aria-required="true"
                aria-describedby={fieldErrors.phone ? "nc-phone-error" : undefined}
              />
              {fieldErrors.phone && <p id="nc-phone-error" role="alert" className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
              {!fieldErrors.phone && duplicate && (
                <p className="text-xs text-amber-700 mt-1" role="alert">
                  מספר טלפון זה כבר שייך ללקוח {duplicate.name} — לא ניתן ליצור לקוח נוסף עם אותו מספר.{" "}
                  <Link href={`/customers/${duplicate.id}`} prefetch={false} className="font-semibold underline" onClick={onClose}>
                    פתח את הלקוח הקיים
                  </Link>
                </p>
              )}
            </div>
            <div className="flex-1">
              <label htmlFor="nc-email" className="label">אימייל</label>
              <input
                id="nc-email"
                className={cn("input", fieldErrors.email && "border-red-300 focus:ring-red-200")}
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined }); }}
                aria-describedby={fieldErrors.email ? "nc-email-error" : undefined}
              />
              {fieldErrors.email && <p id="nc-email-error" role="alert" className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="nc-address" className="label">כתובת</label>
            <input
              id="nc-address"
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="עיר, רחוב"
            />
          </div>
          <div>
            <label htmlFor="nc-idNumber" className="label">
              תעודת זהות
              <span className="text-[11px] text-brand-500 font-normal mr-1.5">חשוב לשליחת חוזים דיגיטליים</span>
            </label>
            <input
              id="nc-idNumber"
              className="input"
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              placeholder="000000000"
              inputMode="numeric"
              maxLength={9}
            />
          </div>
          <div>
            <label className="label">איש קשר נוסף <span className="text-[11px] text-petra-muted font-normal">(אופציונלי)</span></label>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={form.secondContactName}
                onChange={(e) => setForm({ ...form, secondContactName: e.target.value })}
                placeholder="שם איש הקשר"
              />
              <input
                className="input flex-1"
                value={form.secondContactPhone}
                onChange={(e) => setForm({ ...form, secondContactPhone: e.target.value })}
                placeholder="050-0000000"
                inputMode="tel"
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
                  onClick={() => toggleNewTag(tag)}
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
            <label htmlFor="nc-source" className="label">מקור הגעה</label>
            <select
              id="nc-source"
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
            <label htmlFor="nc-notes" className="label">הערות</label>
            <textarea
              id="nc-notes"
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
            disabled={mutation.isPending || !!duplicate}
            onClick={validateAndSubmit}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "הוסף לקוח"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
