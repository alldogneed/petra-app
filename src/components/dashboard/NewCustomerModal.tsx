"use client";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { PawPrint, UserPlus, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName, normalizeIsraeliPhone } from "@/lib/validation";



// ─── New Customer Modal ───────────────────────────────────────────────────────

export function NewCustomerModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const PRESET_TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"];
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    source: "",
    requestedService: "",
    selectedTags: [] as string[],
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [showPetForm, setShowPetForm] = useState(false);
  const [petForm, setPetForm] = useState({ name: "", species: "", breed: "", age: "" });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sanitizeName(data.name),
          phone: normalizeIsraeliPhone(data.phone),
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
          source: data.source || null,
          tags: JSON.stringify(data.selectedTags),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      const customer = await res.json();
      // Optionally create pet
      if (petForm.name.trim()) {
        const petRes = await fetch(`/api/customers/${customer.id}/pets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: petForm.name,
            species: petForm.species || "dog",
            breed: petForm.breed || null,
            age: petForm.age ? parseInt(petForm.age) : null,
          }),
        });
        if (!petRes.ok) {
          console.error("Pet creation failed:", await petRes.text().catch(() => ""));
        }
      }
      return customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", phone: "", email: "", address: "", notes: "", source: "", requestedService: "", selectedTags: [] });
      setPetForm({ name: "", species: "", breed: "", age: "" });
      setShowPetForm(false);
      setFieldErrors({});
      onCreated();
      toast.success("הלקוח נוצר בהצלחה");
    },
    onError: (err) => toast.error(err.message || "שגיאה ביצירת הלקוח"),
  });

  function validateAndSubmitNew() {
    const errors: Record<string, string | undefined> = {};
    const nameErr = validateName(form.name);
    if (nameErr) errors.name = nameErr;
    const phoneErr = validateIsraeliPhone(form.phone);
    if (phoneErr) errors.phone = phoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) errors.email = emailErr;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate(form);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">לקוח חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף לקוח למערכת</p>
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
              className={cn("input", fieldErrors.name && "border-red-300 focus:ring-red-200")}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: undefined }); }}
              placeholder="שם הלקוח"
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className={cn("input text-right", fieldErrors.phone && "border-red-300 focus:ring-red-200")}
                type="tel"
                dir="ltr"
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined }); }}
                placeholder="050-0000000"
                inputMode="tel"
              />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className={cn("input text-right", fieldErrors.email && "border-red-300 focus:ring-red-200")}
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined }); }}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="עיר, רחוב"
            />
          </div>
          {/* Tags */}
          <div>
            <label className="label">תגיות לקוח</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setForm((f) => ({
                    ...f,
                    selectedTags: f.selectedTags.includes(tag)
                      ? f.selectedTags.filter((t) => t !== tag)
                      : [...f.selectedTags, tag],
                  }))}
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
          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג שירות מבוקש</label>
              <select className="input" value={form.requestedService} onChange={(e) => setForm({ ...form, requestedService: e.target.value })}>
                <option value="">בחר...</option>
                <option value="training">אילוף</option>
                <option value="grooming">טיפוח</option>
                <option value="boarding">פנסיון</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div>
              <label className="label">מקור הפנייה</label>
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="">— לא ידוע —</option>
                <option value="referral">המלצה מלקוח</option>
                <option value="google">גוגל</option>
                <option value="instagram">אינסטגרם</option>
                <option value="facebook">פייסבוק</option>
                <option value="tiktok">טיקטוק</option>
                <option value="signage">שלט / מעבר ברחוב</option>
                <option value="other">אחר</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-petra-muted -mt-2">ניתן להשלים מאוחר יותר</p>

          {/* Optional pet */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPetForm((p) => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-petra-text hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-petra-muted" />
                הוספת חיה
                <span className="text-[11px] text-petra-muted font-normal">(אופציונלי)</span>
              </span>
              {showPetForm ? <ChevronUp className="w-4 h-4 text-petra-muted" /> : <ChevronDown className="w-4 h-4 text-petra-muted" />}
            </button>
            {showPetForm && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">שם החיה</label>
                    <input className="input" value={petForm.name} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} placeholder="בוקי" />
                  </div>
                  <div>
                    <label className="label">סוג</label>
                    <select className="input" value={petForm.species} onChange={(e) => setPetForm({ ...petForm, species: e.target.value })}>
                      <option value="">בחר...</option>
                      <option value="dog">כלב</option>
                      <option value="cat">חתול</option>
                      <option value="other">אחר</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">גזע</label>
                    <input className="input" value={petForm.breed} onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })} placeholder="לברדור" />
                  </div>
                  <div>
                    <label className="label">גיל</label>
                    <input className="input" value={petForm.age} onChange={(e) => setPetForm({ ...petForm, age: e.target.value })} placeholder="2" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={validateAndSubmitNew}
          >
            <UserPlus className="w-4 h-4" />
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
