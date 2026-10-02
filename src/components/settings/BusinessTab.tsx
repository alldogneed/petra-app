"use client";
import NextImage from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Save, CheckCircle2, Star, Loader2, Upload, Info, ImagePlus } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import { TIERS } from "@/lib/constants";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { Business, ValidationErrors, validatePhone, validateVatNumber, TIER_ICONS } from "./shared";
import { SubscriptionCard } from "./SubscriptionCard";
import { ChangePasswordSection } from "./AccountSection";

// ─── Business Tab ────────────────────────────────────────────────────────────

export function BusinessTab() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { isFree } = usePlan();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [userName, setUserName] = useState("");
  const [userNameSaved, setUserNameSaved] = useState(false);

  // Initialize userName from auth once user is loaded
  const [userNameInit, setUserNameInit] = useState(false);
  if (user && !userNameInit) {
    setUserName(user.name);
    setUserNameInit(true);
  }

  const userNameMutation = useMutation({
    mutationFn: (name: string) =>
      fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: async () => {
      await refreshUser();
      setUserNameSaved(true);
      setTimeout(() => setUserNameSaved(false), 2500);
      toast.success("שם המשתמש עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון השם"),
  });

  const [form, setForm] = useState<Partial<Business> | null>(null);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const editing = form ?? biz;

  const mutation = useMutation({
    mutationFn: (data: Partial<Business>) =>
      fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בשמירה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setErrors({});
      setTimeout(() => setSaved(false), 2500);
      toast.success("ההגדרות נשמרו בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשמירת ההגדרות. נסה שוב."),
  });

  function handleSave() {
    if (!form) return;
    const newErrors: ValidationErrors = {};
    if (!form.name?.trim()) newErrors.name = "שם העסק הוא שדה חובה";
    const phoneErr = validatePhone(form.phone || "");
    if (phoneErr) newErrors.phone = phoneErr;
    const vatErr = validateVatNumber(form.vatNumber || "");
    if (vatErr) newErrors.vatNumber = vatErr;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    mutation.mutate(form);
  }

  if (isLoading) return <PetraLoader />;
  if (!editing) return null;

  const TierIcon = TIER_ICONS[editing.tier as keyof typeof TIER_ICONS] ?? Star;
  const tierInfo = TIERS[editing.tier as keyof typeof TIERS];

  return (
    <div className="space-y-6 max-w-xl">
      {/* Tier Info + Subscription */}
      <SubscriptionCard tier={editing.tier ?? "free"} customerCount={biz?._count.customers ?? 0} appointmentCount={biz?._count.appointments ?? 0} />

      {/* User Display Name */}
      <div className="space-y-4">
        <div>
          <label className="label">שם המשתמש (מוצג בתוך המערכת)</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="שם מלא"
            />
            <button
              onClick={() => { if (userName.trim()) userNameMutation.mutate(userName.trim()); }}
              disabled={!userName.trim() || userNameMutation.isPending || userName === user?.name}
              className="btn-primary flex items-center gap-1.5 px-4 flex-shrink-0"
            >
              {userNameSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {userNameSaved ? "נשמר" : "עדכן"}
            </button>
          </div>
        </div>
      </div>

      {/* Business Details */}
      <div className="space-y-4">
        <div>
          <label className="label">שם העסק *</label>
          <input className={cn("input", errors.name && "border-red-300 focus:ring-red-200")} value={editing.name ?? ""} onChange={(e) => { setForm({ ...editing, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: undefined }); }} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">טלפון</label>
            <input className={cn("input", errors.phone && "border-red-300 focus:ring-red-200")} value={editing.phone ?? ""} onChange={(e) => { setForm({ ...editing, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: undefined }); }} />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="label">אימייל</label>
            <input className="input" type="email" value={editing.email ?? ""} onChange={(e) => setForm({ ...editing, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">כתובת</label>
          <input className="input" value={editing.address ?? ""} onChange={(e) => setForm({ ...editing, address: e.target.value })} />
        </div>
        <div>
          <label className="label">לוגו העסק</label>
          <LogoUpload
            currentLogo={editing.logo ?? null}
            onUploaded={(url) => setForm({ ...editing, logo: url })}
          />
        </div>
        <div>
          <label className="label">סוג ישות משפטית</label>
          <select
            className="input mt-1"
            value={editing.legalEntityType ?? ""}
            onChange={(e) => setForm({ ...editing, legalEntityType: e.target.value || null })}
          >
            <option value="">לא מוגדר</option>
            <option value="עוסק מורשה">עוסק מורשה (ע.מ)</option>
            <option value="עוסק פטור">עוסק פטור</option>
            <option value="חברה">חברה (ח.פ)</option>
          </select>
          {editing.legalEntityType === "עוסק פטור" && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
              עוסק פטור פטור ממע״מ — לא יחושב מע״מ בהזמנות ובמחירון.
            </p>
          )}
        </div>
        {editing.legalEntityType !== "עוסק פטור" && (
          <div>
            <label className="label">{editing.legalEntityType === "חברה" ? "מספר ח.פ" : "מספר עוסק מורשה"}</label>
            <input className={cn("input", errors.vatNumber && "border-red-300 focus:ring-red-200")} placeholder="000000000" value={editing.vatNumber ?? ""} onChange={(e) => { setForm({ ...editing, vatNumber: e.target.value }); if (errors.vatNumber) setErrors({ ...errors, vatNumber: undefined }); }} />
            {errors.vatNumber && <p className="text-xs text-red-500 mt-1">{errors.vatNumber}</p>}
          </div>
        )}
      </div>

      <button
        className={cn("btn-primary flex items-center gap-2 transition-all", saved && "bg-emerald-500 hover:brightness-100")}
        style={saved ? { background: "#10B981" } : undefined}
        disabled={mutation.isPending}
        onClick={handleSave}
      >
        {saved ? <><CheckCircle2 className="w-4 h-4" /> נשמר!</> : <><Save className="w-4 h-4" /> שמור שינויים</>}
      </button>

      {/* Password Change Section */}
      <ChangePasswordSection />
    </div>
  );
}


// ─── LogoUpload Component ─────────────────────────────────────────────────────

function LogoUpload({
  currentLogo,
  onUploaded,
}: {
  currentLogo: string | null;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      onUploaded(data.url);
      toast.success("הלוגו עודכן בהצלחה");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת הלוגו");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Logo preview box — clickable to upload */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`relative w-28 h-28 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all group ${
          currentLogo
            ? "border-slate-200 bg-white hover:border-brand-300"
            : "border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/30"
        }`}
      >
        {currentLogo ? (
          <>
            <NextImage
              src={currentLogo}
              alt="לוגו"
              width={112}
              height={112}
              className="w-full h-full object-contain p-2"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-white" />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            {uploading ? (
              <Loader2 className="w-7 h-7 text-slate-300 animate-spin" />
            ) : (
              <ImagePlus className="w-7 h-7 text-slate-300 group-hover:text-brand-400 transition-colors" />
            )}
            <span className="text-[10px] text-slate-400 group-hover:text-brand-500 transition-colors">
              {uploading ? "מעלה..." : "לחץ להעלאה"}
            </span>
          </div>
        )}
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary flex items-center gap-2 text-sm px-3 py-1.5"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "מעלה..." : currentLogo ? "החלף לוגו" : "העלה לוגו"}
        </button>
        {currentLogo && (
          <button
            type="button"
            onClick={() => onUploaded("")}
            className="text-xs text-red-500 hover:text-red-700"
          >
            הסר
          </button>
        )}
        <span className="text-xs text-petra-muted">PNG, JPG, WebP, SVG · עד 5MB</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
