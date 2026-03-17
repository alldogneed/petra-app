"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Building2,
  Save,
  CheckCircle2,
  Star,
  Zap,
  Crown,
  Plug,
  Calendar,
  MessageCircle,
  Mail,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle,
  AlertCircle,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Hotel,
  Clock,
  Moon,
  Info,
  Users2,
  UserPlus,
  Shield,
  Settings2,
  X,
  Eye,
  EyeOff,
  Copy,
  ListTodo,
  Repeat,
  Pencil,
  Trash2,
  Plus,
  ToggleLeft,
  ToggleRight,
  CreditCard,
  Users,
  PawPrint,
  RefreshCw,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";

const RepeatIcon = Repeat;
import { useSearchParams } from "next/navigation";
import { cn, fetchJSON, formatRelativeTime, copyToClipboard } from "@/lib/utils";
import { MessagesPanel } from "@/components/messages/messages-panel";
import { PendingApprovalsPanel } from "@/components/settings/PendingApprovalsPanel";
import { toast } from "sonner";
import { TIERS, SERVICE_TYPES } from "@/lib/constants";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { PaywallCard } from "@/components/paywall/PaywallCard";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SdSettings {
  trackHours: boolean;
  defaultTargetHours: number;
  allowManualCert: boolean;
}

const DEFAULT_SD_SETTINGS: SdSettings = {
  trackHours: true,
  defaultTargetHours: 120,
  allowManualCert: true,
};

interface Business {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tier: string;
  vatNumber: string | null;
  slug: string | null;
  logo: string | null;
  boardingCheckInTime: string | null;
  boardingCheckOutTime: string | null;
  boardingCalcMode: string | null;
  boardingMinNights: number | null;
  cancellationPolicy: string | null;
  bookingWelcomeText: string | null;
  depositInstructions: string | null;
  sdSettings: SdSettings | null;
  whatsappRemindersEnabled: boolean;
  whatsappReminderLeadHours: number;
  googleContactsSync: boolean;
  _count: { customers: number; appointments: number };
}

interface ValidationErrors {
  name?: string;
  phone?: string;
  vatNumber?: string;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

function validatePhone(phone: string): string | undefined {
  if (!phone) return undefined; // optional
  const digits = phone.replace(/[\s\-().]/g, "");
  // Israeli phone: 0X-XXXXXXX (9-10 digits starting with 0) or +972...
  if (digits.startsWith("+972") && digits.length >= 12 && digits.length <= 13) return undefined;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) return undefined;
  return "מספר טלפון לא תקין (פורמט ישראלי)";
}

function validateVatNumber(vat: string): string | undefined {
  if (!vat) return undefined; // optional
  const digits = vat.replace(/\D/g, "");
  if (digits.length === 9) return undefined;
  return "מספר עוסק מורשה חייב להכיל 9 ספרות";
}

// ─── Tier Icons ──────────────────────────────────────────────────────────────

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = { basic: Star, pro: Zap, groomer: Crown, service_dog: Crown };

// ─── Subscription Card ───────────────────────────────────────────────────────

function SubscriptionCard({ tier, customerCount, appointmentCount }: { tier: string; customerCount: number; appointmentCount: number }) {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const { subscriptionEndsAt, subscriptionDaysLeft, subscriptionExpired, subscriptionActive, trialActive, trialDaysLeft, trialEndsAt } = usePlan();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const TierIcon = TIER_ICONS[tier] ?? Star;
  const tierInfo = TIERS[tier as keyof typeof TIERS];
  const isFree = tier === "free";

  const statusLabel = isFree
    ? "חינמי"
    : trialActive
    ? `ניסיון חינמי — נשארו ${trialDaysLeft} ימים`
    : subscriptionExpired
    ? "פג תוקף"
    : subscriptionActive
    ? `פעיל עד ${subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString("he-IL") : ""}`
    : "לא פעיל";

  const statusColor = subscriptionExpired
    ? "text-red-500"
    : trialActive
    ? "text-amber-600"
    : subscriptionActive && subscriptionDaysLeft <= 7
    ? "text-amber-500"
    : "text-emerald-500";

  const canCancel = !isFree && (trialActive || subscriptionActive);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "שגיאה בביטול המנוי");
        return;
      }
      toast.success("המנוי בוטל בהצלחה. עברת למסלול חינמי.");
      setShowCancelConfirm(false);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      toast.error("שגיאת רשת. נסה שוב.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "rgba(249,115,22,0.15)" }}
    >
      <div className="flex items-center gap-3 p-4"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(251,146,60,0.04) 100%)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)" }}>
          <TierIcon className="w-5 h-5 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-petra-text">מנוי: {tierInfo?.name ?? tier}</p>
          <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
          <p className="text-xs text-petra-muted">{customerCount} לקוחות · {appointmentCount} פגישות</p>
        </div>
        <a href="/upgrade" className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
          שנה מסלול
        </a>
      </div>

      {/* Trial active info */}
      {trialActive && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-between">
          <span>
            ניסיון חינמי — יסתיים ב-<strong>{trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("he-IL") : ""}</strong>.
            לאחר מכן תחויב אוטומטית.
          </span>
        </div>
      )}

      {subscriptionActive && subscriptionDaysLeft <= 7 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-between">
          <span>המנוי שלך יפוג בעוד {subscriptionDaysLeft} ימים</span>
          <a href="/upgrade" className="font-semibold underline">חדש עכשיו</a>
        </div>
      )}
      {subscriptionExpired && !isFree && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center justify-between">
          <span>המנוי שלך פג — חזרת למסלול חינמי</span>
          <a href="/upgrade" className="font-semibold underline">חדש עכשיו</a>
        </div>
      )}

      {/* Cancel subscription */}
      {canCancel && !showCancelConfirm && (
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
          >
            ביטול מנוי
          </button>
        </div>
      )}

      {canCancel && showCancelConfirm && (
        <div className="px-4 py-3 border-t border-red-100 bg-red-50 flex flex-col gap-2">
          <p className="text-xs text-red-700 font-medium">
            {trialActive
              ? "ביטול הניסיון יסיר את הגישה לתכונות מתקדמות מיידית. הכרטיס לא יחויב."
              : "ביטול המנוי יסיר את הגישה לתכונות מתקדמות מיידית."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {cancelling && <Loader2 className="w-3 h-3 animate-spin" />}
              {cancelling ? "מבטל..." : "כן, בטל מנוי"}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              חזרה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Business Tab ────────────────────────────────────────────────────────────

function BusinessTab() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { isFree, can, isGroomer } = usePlan();
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
  const [copiedLink, setCopiedLink] = useState(false);

  // Apply defaults for nullable boarding fields so they don't get sent as null on save
  const rawEditing = form ?? biz;
  const editing = rawEditing ? {
    ...rawEditing,
    boardingCheckInTime: rawEditing.boardingCheckInTime ?? "14:00",
    boardingCheckOutTime: rawEditing.boardingCheckOutTime ?? "11:00",
    boardingCalcMode: rawEditing.boardingCalcMode ?? "nights",
  } : rawEditing;

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
    onError: () => toast.error("שגיאה בשמירת ההגדרות. נסה שוב."),
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

  if (isLoading) return (
    <div className="animate-pulse space-y-3 max-w-xl">
      {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}
    </div>
  );
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
          <label className="label">לוגו העסק (כתובת URL לתמונה)</label>
          <div className="flex items-center gap-3">
            {editing.logo && (
              <img src={editing.logo} alt="לוגו" className="w-8 h-8 rounded object-contain border border-slate-200 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <input type="url" className="input flex-1" placeholder="https://example.com/logo.png" value={editing.logo ?? ""} onChange={(e) => setForm({ ...editing, logo: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">מספר עוסק מורשה</label>
          <input className={cn("input", errors.vatNumber && "border-red-300 focus:ring-red-200")} placeholder="000000000" value={editing.vatNumber ?? ""} onChange={(e) => { setForm({ ...editing, vatNumber: e.target.value }); if (errors.vatNumber) setErrors({ ...errors, vatNumber: undefined }); }} />
          {errors.vatNumber && <p className="text-xs text-red-500 mt-1">{errors.vatNumber}</p>}
        </div>
      </div>

      {/* Boarding Settings — hidden for groomer tier */}
      {!isGroomer && <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Hotel className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-petra-text">הגדרות פנסיון</h3>
          </div>
          {isFree && <span className="text-xs text-slate-400">🔒 זמין במנוי בייסיק</span>}
        </div>
        {isFree && (
          <p className="text-sm text-petra-muted bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <a href="/upgrade" className="text-brand-600 hover:underline font-medium">שדרג לבייסיק</a> כדי להגדיר שעות צ׳ק-אין/אאוט ופנסיון.
          </p>
        )}
        {!isFree && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  שעת צ׳ק-אין
                </label>
                <input type="time" className="input" value={editing.boardingCheckInTime ?? "14:00"} onChange={(e) => setForm({ ...editing, boardingCheckInTime: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  שעת צ׳ק-אאוט
                </label>
                <input type="time" className="input" value={editing.boardingCheckOutTime ?? "11:00"} onChange={(e) => setForm({ ...editing, boardingCheckOutTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5" />
                  חישוב לפי
                </label>
                <select className="input" value={editing.boardingCalcMode ?? "nights"} onChange={(e) => setForm({ ...editing, boardingCalcMode: e.target.value })}>
                  <option value="nights">לילות</option>
                  <option value="days">ימים</option>
                </select>
              </div>
              <div>
                <label className="label">מינימום לילות</label>
                <input type="number" min={0} className="input" value={editing.boardingMinNights ?? 1} onChange={(e) => setForm({ ...editing, boardingMinNights: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        )}
      </div>}

      <button
        className={cn("btn-primary flex items-center gap-2 transition-all", saved && "bg-emerald-500 hover:brightness-100")}
        style={saved ? { background: "#10B981" } : undefined}
        disabled={mutation.isPending}
        onClick={handleSave}
      >
        {saved ? <><CheckCircle2 className="w-4 h-4" /> נשמר!</> : <><Save className="w-4 h-4" /> שמור שינויים</>}
      </button>

      {/* Online Booking Settings */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-petra-text">הגדרות הזמנה אונליין</h3>
          </div>
          {!can('online_bookings') && <span className="text-xs text-slate-400">🔒 זמין במנוי פרו</span>}
        </div>
        {!can('online_bookings') ? (
          <p className="text-sm text-petra-muted bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <a href="/upgrade" className="text-brand-600 hover:underline font-medium">שדרג לפרו</a> כדי להפעיל הזמנות אונליין, להגדיר קישור הזמנה ומדיניות ביטול.
          </p>
        ) : (
        <div className="space-y-4">
          {/* Booking page URL */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <label className="label flex items-center gap-1.5 mb-2">
              <ExternalLink className="w-3.5 h-3.5" />
              קישור להזמנה אונליין
            </label>
            {biz?.slug ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-petra-text font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 truncate select-all">
                  {`${process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com"}/book/${biz.slug}`}
                </span>
                <button
                  type="button"
                  className="flex-shrink-0 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com"}/book/${biz.slug}`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  title="העתק קישור"
                >
                  {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-petra-muted" />}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-600">הגדר כתובת הזמנה (slug) כדי לשתף את הקישור:</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-petra-muted font-mono">petra-app.com/book/</span>
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="my-business"
                    value={editing.slug ?? ""}
                    onChange={(e) => setForm({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              טקסט פתיחה לדף ההזמנה
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="ברוכים הבאים! אנו שמחים לקבל הזמנות אונליין..."
              value={editing.bookingWelcomeText ?? ""}
              onChange={(e) => setForm({ ...editing, bookingWelcomeText: e.target.value })}
            />
            <p className="text-xs text-petra-muted mt-1">יוצג ללקוחות בראש דף ההזמנה</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              מדיניות ביטול
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="ביטול עד 24 שעות לפני התור – ללא עלות. ביטול מאוחר יותר – יגבה דמי ביטול..."
              value={editing.cancellationPolicy ?? ""}
              onChange={(e) => setForm({ ...editing, cancellationPolicy: e.target.value })}
            />
            <p className="text-xs text-petra-muted mt-1">יוצג ללקוחות לפני אישור ההזמנה</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              הוראות תשלום מקדמה
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="יש לשלם את המקדמה דרך Bit / Paybox למספר 050-0000000..."
              value={editing.depositInstructions ?? ""}
              onChange={(e) => setForm({ ...editing, depositInstructions: e.target.value })}
            />
            <p className="text-xs text-petra-muted mt-1">מוצג כשלשירות יש מקדמה אך אין קישור תשלום</p>
          </div>
        </div>
        )}
      </div>

      {/* Password Change Section */}
      <ChangePasswordSection />
    </div>
  );
}

function ChangePasswordSection() {
  const { user } = useAuth();
  const isGoogleOnly = user?.authProvider === "google" && !user?.hasPassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      return data;
    },
    onSuccess: () => {
      toast.success("הסיסמה שונתה בהצלחה");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const setMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      return data;
    },
    onSuccess: () => {
      toast.success("הסיסמה הוגדרה בהצלחה — כעת ניתן להתחבר גם עם אימייל וסיסמה");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const mutation = isGoogleOnly ? setMutation : changeMutation;

  function handleSubmit() {
    setError(null);
    if (!isGoogleOnly && !currentPassword) {
      setError("יש למלא את כל השדות");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("יש למלא את כל השדות");
      return;
    }
    if (newPassword.length < 12) {
      setError("הסיסמה החדשה חייבת להכיל לפחות 12 תווים");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="border-t border-slate-100 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-petra-text">
          {isGoogleOnly ? "הגדרת סיסמה" : "שינוי סיסמה"}
        </h3>
      </div>

      {isGoogleOnly && (
        <div className="flex items-start gap-2 p-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-800 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-500" />
          <p>
            חשבונך מחובר דרך Google. באפשרותך להגדיר סיסמה כדי להתחבר גם עם אימייל וסיסמה בנוסף לכניסה עם Google.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {!isGoogleOnly && (
          <div>
            <label className="label">סיסמה נוכחית</label>
            <div className="relative">
              <input
                className="input w-full pl-10"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                dir="ltr"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        <div>
          <label className="label">{isGoogleOnly ? "סיסמה חדשה" : "סיסמה חדשה"}</label>
          <div className="relative">
            <input
              className="input w-full pl-10"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              dir="ltr"
              placeholder="לפחות 8 תווים"
            />
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">אימות סיסמה</label>
          <input
            className="input w-full"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
            placeholder="הזן שוב את הסיסמה"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          {mutation.isPending
            ? isGoogleOnly ? "מגדיר..." : "מחליף..."
            : isGoogleOnly ? "הגדר סיסמה" : "החלף סיסמה"}
        </button>
      </div>
    </div>
  );
}

function BookingLinkBox() {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const slug = user?.businessSlug || user?.businessId || "";
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${slug}`
    : `/book/${slug}`;

  function copyLink() {
    copyToClipboard(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waMsg = `היי! 🐾\nרוצה לקבוע תור? אפשר לעשות את זה בקלות דרך הלינק הזה:\n${bookingUrl}`;
  const waLink = `https://web.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="flex gap-2 items-center">
      <div className="flex-1 input text-xs text-petra-muted bg-slate-50 truncate cursor-default select-all"
        onClick={copyLink}
        title="לחץ להעתקה"
      >
        {bookingUrl}
      </div>
      <button
        onClick={copyLink}
        className={cn(
          "btn-secondary text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors",
          copied && "bg-emerald-50 text-emerald-600 border-emerald-200"
        )}
        title="העתק לינק"
      >
        {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> הועתק</> : <><Copy className="w-3.5 h-3.5" /> העתק</>}
      </button>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0 transition-colors"
        title="שתף בוואטסאפ"
      >
        <MessageCircle className="w-4 h-4" />
      </a>
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-50 text-brand-500 hover:bg-brand-100 flex-shrink-0 transition-colors"
        title="פתח עמוד הזמנה"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── Integrations Tab ────────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  connectedEmail?: string | null;
  syncEnabled?: boolean;
  lastConnectedAt?: string | null;
  connectUrl?: string | null;
  disconnectUrl?: string | null;
  // Stripe-specific
  publishableKey?: string | null;
  accountId?: string | null;
  // WhatsApp-specific
  fromNumber?: string | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  "message-circle": MessageCircle,
  mail: Mail,
  "file-text": FileText,
  "credit-card": CreditCard,
};

function IntegrationsTab() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { can } = usePlan();
  const { user } = useAuth();
  const gcalStatus = searchParams.get("gcal");
  const [showInvoicingModal, setShowInvoicingModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [showWhatsAppTestModal, setShowWhatsAppTestModal] = useState(false);

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => fetchJSON<Integration[]>("/api/integrations"),
  });

  const { data: biz } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const updateReminderMutation = useMutation({
    mutationFn: (data: { whatsappRemindersEnabled?: boolean; whatsappReminderLeadHours?: number }) =>
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("הגדרות תזכורת עודכנו");
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const updateContactsSyncMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleContactsSync: enabled }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("הגדרות סנכרון עודכנו");
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const syncContactsMutation = useMutation({
    mutationFn: () =>
      fetch("/api/integrations/google/contacts/sync-all", { method: "POST" }).then((r) => r.json()),
    onSuccess: (data) => {
      toast.success(data.message ?? "סנכרון הושלם");
    },
    onError: () => toast.error("שגיאה בסנכרון — ייתכן שנדרש חיבור מחדש של Google"),
  });

  const disconnectGcalMutation = useMutation({
    mutationFn: () =>
      fetch("/api/integrations/google/disconnect", { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Google Calendar נותק בהצלחה");
    },
    onError: () => toast.error("שגיאה בניתוק Google Calendar. נסה שוב."),
  });

  const syncGcalMutation = useMutation({
    mutationFn: () =>
      fetch("/api/integrations/google/sync", { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "שגיאה בסנכרון");
        return data;
      }),
    onSuccess: (data) => {
      toast.success(data.message || "הסנכרון הושלם בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בסנכרון Google Calendar. נסה שוב."),
  });

  const disconnectInvoicingMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings", { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("מערכת החשבוניות נותקה");
    },
    onError: () => toast.error("שגיאה בניתוק מערכת החשבוניות. נסה שוב."),
  });

  const disconnectStripeMutation = useMutation({
    mutationFn: () =>
      fetch("/api/integrations/stripe", { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Stripe נותק");
    },
    onError: () => toast.error("שגיאה בניתוק Stripe. נסה שוב."),
  });

  if (isLoading)
    return (
      <div className="animate-pulse space-y-3 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );

  return (
    <div className="space-y-4 max-w-2xl">
      {gcalStatus === "connected" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          יומן גוגל חובר בהצלחה!
        </div>
      )}
      {gcalStatus === "denied" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          החיבור בוטל. ניתן לנסות שוב בכל עת.
        </div>
      )}
      {gcalStatus === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          אירעה שגיאה בחיבור. נסה שוב.
        </div>
      )}

      {integrations?.filter((integ) =>
        integ.id !== "invoicing" && integ.id !== "stripe" &&
        (integ.id !== "resend" || user?.isAdmin === true)
      ).map((integ) => {
        const Icon = ICON_MAP[integ.icon] ?? Plug;
        const isInvoicing = integ.id === "invoicing";
        const isGcal = integ.id === "google-calendar";
        const isStripe = integ.id === "stripe";
        const isWhatsApp = integ.id === "whatsapp";

        return (
          <div key={integ.id} className="card p-5 flex items-start gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", integ.connected ? "bg-emerald-50" : "bg-slate-100")}>
              <Icon className={cn("w-6 h-6", integ.connected ? "text-emerald-600" : "text-slate-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-petra-text">{integ.name}</h3>
                {integ.connected ? (
                  <span className="badge badge-success text-xs">מחובר</span>
                ) : (
                  <span className="badge badge-neutral text-xs">לא מחובר</span>
                )}
              </div>
              <p className="text-sm text-petra-muted mt-0.5">{integ.description}</p>
              {integ.connected && integ.connectedEmail && (
                <p className="text-xs text-emerald-600 mt-1">{integ.connectedEmail}</p>
              )}
              {isStripe && integ.connected && integ.accountId && (
                <p className="text-xs text-emerald-600 mt-1">Account: {integ.accountId}</p>
              )}
              {integ.id === "whatsapp" && integ.connected && integ.fromNumber && (
                <p className="text-xs text-emerald-600 mt-1">מספר שולח: {integ.fromNumber}</p>
              )}
              {isGcal && integ.connected && biz && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-petra-text">סנכרון לידים ל-Google Contacts</span>
                      <span className="text-xs text-petra-muted">כל ליד חדש/מעודכן ייווצר/יעודכן אוטומטית באנשי הקשר ב-Google</span>
                    </div>
                    <button
                      onClick={() => updateContactsSyncMutation.mutate(!biz.googleContactsSync)}
                      disabled={updateContactsSyncMutation.isPending}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                        biz.googleContactsSync ? "bg-emerald-500" : "bg-slate-300"
                      )}
                      title={biz.googleContactsSync ? "כבה סנכרון" : "הפעל סנכרון"}
                    >
                      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", biz.googleContactsSync ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  {biz.googleContactsSync && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-petra-muted">סנכרן את כל הלידים הקיימים עכשיו</span>
                      <button
                        onClick={() => syncContactsMutation.mutate()}
                        disabled={syncContactsMutation.isPending}
                        className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
                      >
                        {syncContactsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users2 className="w-3 h-3" />}
                        סנכרן הכל
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isWhatsApp && integ.connected && biz && can("whatsapp_reminders") && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-petra-text">תזכורות אוטומטיות לתורים</span>
                    <button
                      onClick={() => updateReminderMutation.mutate({ whatsappRemindersEnabled: !biz.whatsappRemindersEnabled })}
                      disabled={updateReminderMutation.isPending}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                        biz.whatsappRemindersEnabled ? "bg-emerald-500" : "bg-slate-300"
                      )}
                      title={biz.whatsappRemindersEnabled ? "כבה תזכורות" : "הפעל תזכורות"}
                    >
                      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", biz.whatsappRemindersEnabled ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  {biz.whatsappRemindersEnabled && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-petra-muted">שלח שעות לפני התור</span>
                      <select
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-petra-text"
                        value={biz.whatsappReminderLeadHours}
                        onChange={(e) => updateReminderMutation.mutate({ whatsappReminderLeadHours: Number(e.target.value) })}
                        disabled={updateReminderMutation.isPending}
                      >
                        <option value={24}>24 שעות</option>
                        <option value={48}>48 שעות</option>
                        <option value={72}>72 שעות</option>
                        <option value={96}>96 שעות</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {isStripe ? (
                integ.connected ? (
                  <>
                    <button
                      className="btn-ghost text-sm flex items-center gap-1.5"
                      onClick={() => setShowStripeModal(true)}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      עדכן
                    </button>
                    <button
                      className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => disconnectStripeMutation.mutate()}
                      disabled={disconnectStripeMutation.isPending}
                    >
                      {disconnectStripeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נתק"}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary text-sm flex items-center gap-1.5"
                    onClick={() => setShowStripeModal(true)}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    חבר
                  </button>
                )
              ) : isInvoicing ? (
                integ.connected ? (
                  <>
                    <button
                      className="btn-ghost text-sm flex items-center gap-1.5"
                      onClick={() => setShowMappingModal(true)}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      הגדרות
                    </button>
                    <button
                      className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => disconnectInvoicingMutation.mutate()}
                      disabled={disconnectInvoicingMutation.isPending}
                    >
                      {disconnectInvoicingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נתק"}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary text-sm flex items-center gap-1.5"
                    onClick={() => setShowInvoicingModal(true)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    חבר
                  </button>
                )
              ) : isGcal && integ.connected && integ.disconnectUrl ? (
                <>
                  <button
                    className="btn-secondary text-sm flex items-center gap-1.5"
                    onClick={() => syncGcalMutation.mutate()}
                    disabled={syncGcalMutation.isPending}
                    title="סנכרן פגישות קיימות ל-Google Calendar"
                  >
                    {syncGcalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RepeatIcon className="w-3.5 h-3.5" />}
                    סנכרן עכשיו
                  </button>
                  <button
                    className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => disconnectGcalMutation.mutate()}
                    disabled={disconnectGcalMutation.isPending}
                  >
                    {disconnectGcalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נתק"}
                  </button>
                </>
              ) : integ.connectUrl ? (
                <a href={integ.connectUrl} className="btn-primary text-sm flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  חבר
                </a>
              ) : isWhatsApp ? (
                <button
                  className="btn-secondary text-sm flex items-center gap-1.5"
                  onClick={() => setShowWhatsAppTestModal(true)}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {integ.connected ? "בדיקת חיבור" : "בדיקת Stub"}
                </button>
              ) : (
                <span className="text-xs text-petra-muted">בקרוב</span>
              )}
            </div>
          </div>
        );
      })}

      {showInvoicingModal && (
        <InvoicingConnectModal
          onClose={() => setShowInvoicingModal(false)}
          onSuccess={() => {
            setShowInvoicingModal(false);
            queryClient.invalidateQueries({ queryKey: ["integrations"] });
          }}
        />
      )}

      {showMappingModal && (
        <InvoicingMappingModal
          onClose={() => setShowMappingModal(false)}
          onSuccess={() => {
            setShowMappingModal(false);
            queryClient.invalidateQueries({ queryKey: ["integrations"] });
          }}
        />
      )}

      {showStripeModal && (
        <StripeConnectModal
          onClose={() => setShowStripeModal(false)}
          onSuccess={() => {
            setShowStripeModal(false);
            queryClient.invalidateQueries({ queryKey: ["integrations"] });
          }}
        />
      )}

      {showWhatsAppTestModal && (
        <WhatsAppTestModal onClose={() => setShowWhatsAppTestModal(false)} />
      )}

      {/* ── Make.com Webhook ── */}
      {can('webhook_leads') ? (
        <MakeWebhookCard />
      ) : (
        <PaywallCard
          title="אינטגרציית Webhook ללידים"
          description="קבל לידים אוטומטית מטפסי Make.com ואתר האינטרנט שלך — זמין במנוי פרו וכלבי שירות."
          requiredTier="pro"
          variant="inline"
        />
      )}

    </div>
  );
}

// ─── Stripe Connect Modal ─────────────────────────────────────────────────────

function StripeConnectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!publishableKey.trim() || !secretKey.trim()) {
      setError("נדרשים Publishable Key ו-Secret Key");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishableKey: publishableKey.trim(),
          secretKey: secretKey.trim(),
          webhookSecret: webhookSecret.trim() || undefined,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בחיבור");
        return;
      }
      toast.success("Stripe חובר בהצלחה!");
      onSuccess();
    } catch {
      setError("שגיאת רשת — בדוק את החיבור ונסה שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-petra-text">חיבור Stripe</h2>
              <p className="text-sm text-petra-muted mt-0.5">קבל תשלומים בכרטיס אשראי מלקוחות</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Info box */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-800">
            <p className="font-medium mb-1">איך מוצאים את המפתחות?</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>היכנס ל-<strong>dashboard.stripe.com</strong></li>
              <li>עבור אל <strong>Developers → API keys</strong></li>
              <li>העתק את ה-Publishable key ואת ה-Secret key</li>
              <li>לוובהוק: עבור אל <strong>Webhooks → Add endpoint</strong>, הוסף את ה-URL של Petra</li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <label className="label">Publishable Key (pk_...)</label>
            <input
              className="input w-full font-mono text-sm"
              placeholder="pk_live_... או pk_test_..."
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label className="label">Secret Key (sk_...)</label>
            <div className="relative">
              <input
                className="input w-full font-mono text-sm pr-10"
                placeholder="sk_live_... או sk_test_..."
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label">Webhook Secret (whsec_...) — אופציונלי</label>
            <div className="relative">
              <input
                className="input w-full font-mono text-sm pr-10"
                placeholder="whsec_... (לאימות אירועי Stripe)"
                type={showWebhook ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
                onClick={() => setShowWebhook((v) => !v)}
              >
                {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-petra-muted">
              Webhook URL לרשום ב-Stripe:{" "}
              <span className="font-mono bg-slate-100 px-1 rounded text-xs" dir="ltr">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="label">מטבע</label>
            <select
              className="input w-full"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="ILS">ILS — שקל ישראלי (₪)</option>
              <option value="USD">USD — דולר ($)</option>
              <option value="EUR">EUR — יורו (€)</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">ביטול</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {loading ? "מוודא ושומר..." : "חבר Stripe"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp Test Modal ─────────────────────────────────────────────────────

function WhatsAppTestModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; stub?: boolean; message?: string; error?: string } | null>(null);

  async function handleTest() {
    if (!phone.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, error: data.error || "שגיאה בשליחה" });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ success: false, error: "שגיאת רשת" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-petra-text">בדיקת WhatsApp</h2>
              <p className="text-sm text-petra-muted mt-0.5">שלח הודעת בדיקה למספר טלפון</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label">מספר טלפון לבדיקה</label>
            <input
              className="input w-full"
              placeholder="05X-XXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <p className="text-xs text-petra-muted mt-1">הזן מספר ישראלי (יתוקנן אוטומטית)</p>
          </div>

          {result && (
            <div className={cn(
              "flex items-start gap-2 p-3 rounded-xl text-sm border",
              result.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            )}>
              {result.success
                ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{result.success ? (result.message ?? "ההודעה נשלחה בהצלחה!") : result.error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">סגור</button>
          <button
            onClick={handleTest}
            disabled={loading || !phone.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {loading ? "שולח..." : "שלח הודעת בדיקה"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Webhook Integration Card ─────────────────────────────────────────────────

function MakeWebhookCard() {
  const queryClient = useQueryClient();
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";

  const webhookUrl = `${appUrl}/api/webhooks/lead`;

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const { data: keyData, isLoading: keyLoading } = useQuery<{ key: string | null }>({
    queryKey: ["webhook-api-key"],
    queryFn: () => fetchJSON<{ key: string | null }>("/api/webhooks/lead/key"),
  });

  const regenMutation = useMutation({
    mutationFn: () =>
      fetch("/api/webhooks/lead/key", { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-api-key"] });
      setConfirmRegen(false);
      setShowKey(true);
      toast.success("מפתח API חדש נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת מפתח. נסה שוב."),
  });

  function copy(value: string, setter: (v: boolean) => void) {
    copyToClipboard(value).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  const currentKey = keyData?.key;
  const hasKey = !!currentKey;

  const codeSnippet = `await fetch("${webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${currentKey ?? "YOUR_API_KEY"}"
  },
  body: JSON.stringify({
    firstName: formData.firstName,
    lastName: formData.lastName,
    phone: formData.phone,
    email: formData.email,
    city: formData.city,
    breed: formData.breed,
    service: formData.service,
  })
});`;

  return (
    <div className="card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
          <Zap className="w-6 h-6 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-petra-text">חיבור לידים מהאתר</h3>
            <span className={cn("badge text-xs", hasKey ? "badge-success" : "badge-neutral")}>
              {hasKey ? "מחובר" : "לא מוגדר"}
            </span>
          </div>
          <p className="text-sm text-petra-muted mt-0.5">
            כל פנייה בטופס האתר תיצור ליד חדש אוטומטית בפטרה.
          </p>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <label className="label text-xs">Webhook URL</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={webhookUrl}
            dir="ltr"
            className="input flex-1 font-mono text-sm bg-slate-50 select-all"
            onFocus={(e) => e.target.select()}
          />
          <button
            className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0"
            onClick={() => copy(webhookUrl, setCopiedUrl)}
          >
            {copiedUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copiedUrl ? "הועתק!" : "העתק"}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="label text-xs">מפתח API</label>
          {!confirmRegen ? (
            <button
              className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
              onClick={() => setConfirmRegen(true)}
            >
              <RefreshCw className="w-3 h-3" />
              {hasKey ? "צור מפתח חדש" : "צור מפתח"}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-600">בטוח? המפתח הישן יפסיק לעבוד</span>
              <button
                className="text-red-500 hover:text-red-600 font-medium"
                onClick={() => regenMutation.mutate()}
                disabled={regenMutation.isPending}
              >
                {regenMutation.isPending ? "יוצר..." : "אישור"}
              </button>
              <button className="text-petra-muted" onClick={() => setConfirmRegen(false)}>ביטול</button>
            </div>
          )}
        </div>

        {keyLoading ? (
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        ) : hasKey ? (
          <div className="flex gap-2">
            <input
              readOnly
              type={showKey ? "text" : "password"}
              value={currentKey}
              dir="ltr"
              className="input flex-1 font-mono text-sm bg-slate-50 select-all"
              onFocus={(e) => e.target.select()}
            />
            <button className="btn-ghost flex-shrink-0" onClick={() => setShowKey((v) => !v)} title={showKey ? "הסתר" : "הצג"}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0"
              onClick={() => copy(currentKey, setCopiedKey)}
            >
              {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedKey ? "הועתק!" : "העתק"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>טרם נוצר מפתח. לחץ על &quot;צור מפתח&quot; מעל.</span>
          </div>
        )}
      </div>

      {/* Code snippet */}
      {hasKey && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="label text-xs">קוד להדבקה באתר (Next.js / JavaScript)</label>
            <button
              className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
              onClick={() => copy(codeSnippet, setCopiedCode)}
            >
              {copiedCode ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copiedCode ? "הועתק!" : "העתק קוד"}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed" dir="ltr">
            {codeSnippet}
          </pre>
        </div>
      )}

      {/* Fields reference */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-petra-muted space-y-2">
        <p className="font-medium text-petra-text text-sm">שדות נתמכים</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {[
            ["firstName", "שם פרטי"],
            ["lastName", "שם משפחה"],
            ["fullName", "שם מלא (חלופה)"],
            ["phone", "טלפון"],
            ["email", "אימייל"],
            ["city", "עיר"],
            ["breed", "גזע הכלב"],
            ["service", "שירות מבוקש"],
            ["petName", "שם הכלב"],
            ["notes", "הערות חופשיות"],
            ["source", "מקור (ברירת מחדל: website)"],
          ].map(([field, desc]) => (
            <div key={field} className="flex gap-2">
              <code className="text-violet-600 font-mono">{field}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Invoicing Tab ──────────────────────────────────────────────────────────

function InvoicingTab() {
  const queryClient = useQueryClient();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);

  const { data: settings, isLoading } = useQuery<{
    providerName: string;
    status: string;
    connectedAt: string | null;
    documentMapping: string;
    lastTestedAt: string | null;
    lastTestResult: string | null;
  } | null>({
    queryKey: ["invoicing-settings"],
    queryFn: async () => {
      const res = await fetch("/api/invoicing/settings");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const { data: documents } = useQuery<Array<{
    id: string;
    docTypeName: string;
    amount: number;
    status: string;
    documentNumber: string | null;
    createdAt: string;
    customer: { name: string } | null;
  }>>({
    queryKey: ["invoicing-documents"],
    queryFn: () => fetchJSON("/api/invoicing/documents"),
    enabled: settings?.status === "active",
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings", { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("מערכת החשבוניות נותקה");
    },
    onError: () => toast.error("שגיאה בניתוק. נסה שוב."),
  });

  const isConnected = settings?.status === "active";

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 max-w-2xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
      </div>
    );
  }

  // Parse mapping for display
  let mappingEntries: Array<{ method: string; label: string; docType: string }> = [];
  if (isConnected && settings?.documentMapping) {
    try {
      const map = JSON.parse(settings.documentMapping) as Record<string, number>;
      const docLabels: Record<number, string> = { 305: "חשבונית מס", 320: "חשבונית מס / קבלה", 400: "קבלה", 330: "זיכוי", 0: "ללא מסמך" };
      const methodLabels: Record<string, string> = { cash: "מזומן", credit_card: "כרטיס אשראי", bank_transfer: "העברה בנקאית", bit: "ביט", paybox: "פייבוקס", check: "צ׳ק" };
      mappingEntries = Object.entries(map).map(([m, dt]) => ({
        method: m,
        label: methodLabels[m] ?? m,
        docType: docLabels[dt] ?? String(dt),
      }));
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Connection Status Card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", isConnected ? "bg-emerald-50" : "bg-slate-100")}>
            <FileText className={cn("w-6 h-6", isConnected ? "text-emerald-600" : "text-slate-400")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-petra-text">חיבור ספק חשבוניות</h3>
              {isConnected ? (
                <span className="badge badge-success text-xs">מחובר</span>
              ) : (
                <span className="badge badge-neutral text-xs">לא מחובר</span>
              )}
            </div>
            {isConnected ? (
              <p className="text-sm text-petra-muted mt-0.5">
                מחובר ל-{settings?.providerName === "morning" ? "Morning (חשבונית ירוקה)" : settings?.providerName}
                {settings?.connectedAt && <> · חובר {formatRelativeTime(settings.connectedAt)}</>}
              </p>
            ) : (
              <p className="text-sm text-petra-muted mt-0.5">
                חבר את חשבון Morning (חשבונית ירוקה) להפקת חשבוניות וקבלות אוטומטית
              </p>
            )}
            {settings?.lastTestedAt && settings.lastTestResult && (
              <p className={cn("text-xs mt-1", settings.lastTestResult === "success" ? "text-emerald-600" : "text-red-500")}>
                בדיקה אחרונה: {settings.lastTestResult === "success" ? "תקין" : "נכשל"} · {formatRelativeTime(settings.lastTestedAt)}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {isConnected ? (
              <>
                <button
                  className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נתק"}
                </button>
              </>
            ) : (
              <button
                className="btn-primary text-sm flex items-center gap-1.5"
                onClick={() => setShowConnectModal(true)}
              >
                <Plug className="w-4 h-4" />
                חבר
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Mapping Card */}
      {isConnected && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-petra-text">מיפוי מסמכים</h3>
              <p className="text-sm text-petra-muted mt-0.5">איזה סוג מסמך יופק לכל אמצעי תשלום</p>
            </div>
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              onClick={() => setShowMappingModal(true)}
            >
              <Settings2 className="w-3.5 h-3.5" />
              ערוך
            </button>
          </div>
          {mappingEntries.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {mappingEntries.map((entry) => (
                <div key={entry.method} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-petra-text">{entry.label}</span>
                  <span className="text-xs text-petra-muted">{entry.docType}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-petra-muted">מיפוי ברירת מחדל בשימוש</p>
          )}
        </div>
      )}

      {/* Recent Documents */}
      {isConnected && documents && documents.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-petra-text mb-3">מסמכים אחרונים</h3>
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-petra-muted" />
                  <div>
                    <p className="text-sm text-petra-text">{doc.docTypeName}{doc.documentNumber ? ` #${doc.documentNumber}` : ""}</p>
                    <p className="text-xs text-petra-muted">{doc.customer?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-petra-text">₪{doc.amount.toFixed(2)}</p>
                  <span className={cn("text-xs", doc.status === "issued" ? "text-emerald-600" : doc.status === "draft" ? "text-amber-600" : "text-petra-muted")}>
                    {doc.status === "issued" ? "הופק" : doc.status === "draft" ? "טיוטה" : doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when not connected */}
      {!isConnected && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-semibold text-petra-text mb-1">עדיין לא מחובר ספק חשבוניות</h3>
          <p className="text-sm text-petra-muted mb-4">חבר את חשבון Morning שלך כדי להפיק חשבוניות וקבלות אוטומטית כשנרשמת תשלום</p>
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setShowConnectModal(true)}
          >
            <Plug className="w-4 h-4" />
            חבר עכשיו
          </button>
        </div>
      )}

      {showConnectModal && (
        <InvoicingConnectModal
          onClose={() => setShowConnectModal(false)}
          onSuccess={() => {
            setShowConnectModal(false);
            queryClient.invalidateQueries({ queryKey: ["invoicing-settings"] });
            queryClient.invalidateQueries({ queryKey: ["integrations"] });
          }}
        />
      )}

      {showMappingModal && (
        <InvoicingMappingModal
          onClose={() => setShowMappingModal(false)}
          onSuccess={() => {
            setShowMappingModal(false);
            queryClient.invalidateQueries({ queryKey: ["invoicing-settings"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Invoicing Connect Modal ────────────────────────────────────────────────

function InvoicingConnectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [provider, setProvider] = useState("morning");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  const testMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName: provider, apiKey, apiSecret }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || "בדיקה נכשלה");
        return data;
      }),
    onMutate: () => {
      setTestStatus("testing");
      setTestError(null);
    },
    onSuccess: () => setTestStatus("success"),
    onError: (err: Error) => {
      setTestStatus("error");
      setTestError(err.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName: provider, apiKey, apiSecret }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "שמירה נכשלה");
        }
        return r.json();
      }),
    onSuccess,
    onError: (err: Error) => {
      setTestStatus("error");
      setTestError(err.message);
    },
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">חיבור חשבוניות</h2>
            <p className="text-sm text-petra-muted mt-0.5">הפקת חשבוניות וקבלות אוטומטית</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">ספק</label>
            <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="morning">Morning (חשבונית ירוקה)</option>
            </select>
          </div>

          <div>
            <label className="label">API Key *</label>
            <input
              className="input"
              dir="ltr"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
              placeholder="API Key מ-Morning"
            />
          </div>

          <div>
            <label className="label">API Secret *</label>
            <input
              className="input"
              type="password"
              dir="ltr"
              value={apiSecret}
              onChange={(e) => { setApiSecret(e.target.value); setTestStatus("idle"); }}
              placeholder="API Secret מ-Morning"
            />
          </div>

          {testStatus === "success" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              החיבור תקין!
            </div>
          )}

          {testStatus === "error" && testError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {testError}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          {testStatus !== "success" ? (
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={!apiKey.trim() || !apiSecret.trim() || testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              {testMutation.isPending ? "בודק..." : "בדוק חיבור"}
            </button>
          ) : (
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ background: "#10B981" }}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saveMutation.isPending ? "שומר..." : "שמור וחבר"}
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Invoicing Document Mapping Modal ───────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: 320, label: "חשבונית מס / קבלה" },
  { value: 400, label: "קבלה" },
  { value: 305, label: "חשבונית מס" },
  { value: 0, label: "ללא מסמך" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  bit: "ביט",
  paybox: "פייבוקס",
  check: "צ׳ק",
};

const DEFAULT_MAPPING: Record<string, number> = {
  cash: 320,
  credit_card: 320,
  bank_transfer: 320,
  bit: 400,
  paybox: 400,
  check: 320,
};

function InvoicingMappingModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: settings } = useQuery<{ documentMapping: string } | null>({
    queryKey: ["invoicing-settings"],
    queryFn: () => fetchJSON("/api/invoicing/settings"),
  });

  const [mapping, setMapping] = useState<Record<string, number>>(DEFAULT_MAPPING);
  const [initialized, setInitialized] = useState(false);

  // Sync mapping from server settings when they load
  const settingsMappingStr = settings?.documentMapping;
  if (settingsMappingStr && !initialized) {
    try {
      const parsed = JSON.parse(settingsMappingStr);
      setMapping({ ...DEFAULT_MAPPING, ...parsed });
    } catch { /* keep default */ }
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentMapping: mapping, updateMappingOnly: true }),
      }).then(async (r) => {
        if (!r.ok) throw new Error("שמירה נכשלה");
        return r.json();
      }),
    onSuccess,
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">מיפוי מסמכים</h2>
            <p className="text-sm text-petra-muted mt-0.5">בחר איזה מסמך יופק לכל אמצעי תשלום</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => (
            <div key={method} className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-petra-text w-32">{label}</label>
              <select
                className="input flex-1"
                value={mapping[method] ?? 320}
                onChange={(e) => setMapping({ ...mapping, [method]: Number(e.target.value) })}
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "שומר..." : "שמור"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Data Tab (Import / Export) ──────────────────────────────────────────────

type ImportPhase = "idle" | "uploading" | "preview" | "executing" | "done" | "error";

interface ImportStats {
  totalCustomers: number;
  totalPets: number;
  skippedRows: number;
  inFileDuplicates: number;
  dbDuplicates: number;
  orphanPets: number;
}

interface ImportResult {
  createdCustomers: number;
  mergedCustomers: number;
  createdPets: number;
}

// Export types/constants for DataTab
interface ExportJob {
  id: string;
  exportType: string;
  format: string;
  outputMode: string;
  status: string;
  fileName: string | null;
  fileSize: number | null;
  recordCount: number | null;
  filterFromDate: string | null;
  filterToDate: string | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
}

const EXPORT_DATA_TYPES = [
  { value: "customers", label: "לקוחות בלבד", description: "שם, טלפון, מייל, כתובת, תגיות", icon: Users },
  { value: "dogs", label: "כלבים בלבד", description: "שם, גזע, מין, משקל, בעלים", icon: PawPrint },
  { value: "customers_dogs", label: "לקוחות + כלבים", description: "נתוני לקוחות וכלבים משולבים", icon: FileSpreadsheet },
];
const EXPORT_STATUS_CFG: Record<string, { icon: React.ElementType; badgeClass: string; label: string; spin?: boolean }> = {
  pending:    { icon: Clock,         badgeClass: "bg-amber-50 text-amber-700 border-amber-200",   label: "ממתין" },
  processing: { icon: RefreshCw,     badgeClass: "bg-blue-50 text-blue-700 border-blue-200",      label: "מעבד", spin: true },
  completed:  { icon: CheckCircle2,  badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "מוכן" },
  failed:     { icon: XCircle,       badgeClass: "bg-red-50 text-red-700 border-red-200",         label: "נכשל" },
  expired:    { icon: XCircle,       badgeClass: "bg-slate-50 text-slate-500 border-slate-200",   label: "פג תוקף" },
};
const EXPORT_TYPE_LABELS: Record<string, string> = {
  customers: "לקוחות בלבד", dogs: "כלבים בלבד", customers_dogs: "לקוחות + כלבים",
  pets: "חיות מחמד", both: "לקוחות + חיות",
};
function fmtFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DataTab() {
  const queryClient = useQueryClient();

  // Export state (async job system)
  const [exportType, setExportType] = useState<"customers" | "dogs" | "customers_dogs">("customers");
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [outputMode, setOutputMode] = useState<"flat" | "separate">("separate");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // Import state
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importTopIssues, setImportTopIssues] = useState<{ row: number; message: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export jobs query
  const { data: exportJobs = [] } = useQuery<ExportJob[]>({
    queryKey: ["exports"],
    queryFn: () => fetch("/api/exports").then((r) => r.json()),
    refetchInterval: (query) => {
      const data = query.state.data as ExportJob[] | undefined;
      return data?.some((j) => j.status === "pending" || j.status === "processing") ? 3000 : false;
    },
  });

  const createExportMutation = useMutation({
    mutationFn: () =>
      fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType, format: exportFormat, outputMode, filterFromDate: filterFromDate || null, filterToDate: filterToDate || null }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה ביצירת הייצוא"); return d; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exports"] }),
    onError: () => toast.error("שגיאה ביצירת הייצוא"),
  });

  function handleDownloadExport(jobId: string) {
    window.location.href = `/api/exports/download?jobId=${jobId}`;
  }

  // Template download
  async function handleDownloadTemplate() {
    const res = await fetch("/api/import/template");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petra-import-template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // File upload & parse
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportPhase("uploading");
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("includePets", "true");

      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Parse failed");

      const data = await res.json();
      setImportBatchId(data.batchId);
      setImportStats(data.stats);
      setImportTopIssues(data.topIssues?.map((i: { row: number; message: string }) => ({ row: i.row, message: i.message })) || []);
      setImportPhase("preview");
    } catch {
      setImportError("שגיאה בניתוח הקובץ");
      setImportPhase("error");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Execute import
  async function handleExecuteImport() {
    if (!importBatchId) return;
    setImportPhase("executing");

    try {
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: importBatchId }),
      });
      if (!res.ok) throw new Error("Execute failed");

      const data = await res.json();
      setImportResult(data);
      setImportPhase("done");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch {
      setImportError("שגיאה בביצוע הייבוא");
      setImportPhase("error");
    }
  }

  function resetImport() {
    setImportPhase("idle");
    setImportStats(null);
    setImportBatchId(null);
    setImportResult(null);
    setImportError(null);
    setImportTopIssues([]);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* ── Export Section ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ייצוא נתונים</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Export Form */}
          <div className="lg:col-span-2 card p-5 space-y-4 self-start">
            <h4 className="text-sm font-bold text-petra-text">ייצוא חדש</h4>
            {/* Type */}
            <div>
              <label className="label mb-2 block">סוג ייצוא</label>
              <div className="space-y-2">
                {EXPORT_DATA_TYPES.map((t) => {
                  const Icon = t.icon;
                  const sel = exportType === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setExportType(t.value as typeof exportType)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all",
                        sel ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-200 bg-white"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 flex-shrink-0", sel ? "text-brand-500" : "text-petra-muted")} />
                      <div>
                        <p className={cn("text-sm font-semibold", sel ? "text-brand-700" : "text-petra-text")}>{t.label}</p>
                        <p className="text-xs text-petra-muted">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Format */}
            <div>
              <label className="label mb-2 block">פורמט קובץ</label>
              <div className="flex gap-2">
                {(["xlsx", "csv"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setExportFormat(f)}
                    className={cn("flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all",
                      exportFormat === f ? "bg-brand-500 text-white border-brand-500" : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                    )}
                  >
                    {f === "xlsx" ? "Excel (.xlsx)" : "CSV"}
                  </button>
                ))}
              </div>
            </div>
            {/* Output mode */}
            <div>
              <label className="label mb-2 block">אופן פלט</label>
              <div className="flex flex-col gap-2">
                {[{ value: "flat", label: "שטוח (גיליון אחד)" }, { value: "separate", label: "מופרד (גיליון לכל סוג)" }].map((m) => (
                  <button key={m.value} type="button" onClick={() => setOutputMode(m.value as typeof outputMode)}
                    className={cn("w-full py-2 px-3 rounded-xl text-sm font-medium border text-right transition-all",
                      outputMode === m.value ? "bg-brand-500 text-white border-brand-500" : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                    )}
                  >{m.label}</button>
                ))}
              </div>
            </div>
            {/* Date filter */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarRange className="w-4 h-4 text-petra-muted" />
                <label className="label">פילטר תאריכים (אופציונלי)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-petra-muted mb-1 block">מתאריך</label>
                  <input className="input text-sm" type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-petra-muted mb-1 block">עד תאריך</label>
                  <input className="input text-sm" type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                </div>
              </div>
            </div>
            <button type="button" onClick={() => createExportMutation.mutate()} disabled={createExportMutation.isPending}
              className="btn-primary w-full gap-2 justify-center flex items-center"
            >
              {createExportMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />מייצא...</> : <><Download className="w-4 h-4" />ייצא עכשיו</>}
            </button>
            {createExportMutation.isSuccess && <p className="text-xs text-emerald-600 text-center">בקשת הייצוא נשלחה. הקובץ יופיע בהיסטוריה.</p>}
          </div>
          {/* Export History */}
          <div className="lg:col-span-3 card p-5">
            <h4 className="text-sm font-bold text-petra-text mb-4">היסטוריית ייצואים</h4>
            {exportJobs.length === 0 ? (
              <div className="py-10 text-center text-petra-muted text-sm">אין ייצואים עדיין</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["סוג", "פורמט", "מצב", "רשומות", "גודל", "תאריך", ""].map((h) => (
                        <th key={h} className="table-header-cell">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportJobs.map((job) => {
                      const cfg = EXPORT_STATUS_CFG[job.status] ?? EXPORT_STATUS_CFG.pending;
                      const Icon = cfg.icon;
                      const downloadable = job.status === "completed" && new Date(job.expiresAt) > new Date();
                      return (
                        <tr key={job.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="table-cell font-medium">{EXPORT_TYPE_LABELS[job.exportType] ?? job.exportType}</td>
                          <td className="table-cell uppercase text-petra-muted">{job.format}</td>
                          <td className="table-cell">
                            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cfg.badgeClass)}>
                              <Icon className={cn("w-3 h-3", cfg.spin && "animate-spin")} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="table-cell text-petra-muted">{job.recordCount != null ? job.recordCount.toLocaleString("he-IL") : "—"}</td>
                          <td className="table-cell text-petra-muted">{fmtFileSize(job.fileSize)}</td>
                          <td className="table-cell text-petra-muted whitespace-nowrap">{new Date(job.createdAt).toLocaleDateString("he-IL")}</td>
                          <td className="table-cell">
                            {downloadable ? (
                              <button onClick={() => handleDownloadExport(job.id)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />הורד
                              </button>
                            ) : job.status === "completed" ? <span className="text-xs text-petra-muted">פג תוקף</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Import Section ── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ייבוא נתונים</h3>
        </div>

        {importPhase === "idle" && (
          <div className="space-y-4">
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="w-4 h-4" />
              הורד תבנית לדוגמה
            </button>

            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-petra-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-petra-text">לחץ להעלאת קובץ</p>
              <p className="text-xs text-petra-muted mt-1">Excel (.xlsx) או CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        )}

        {importPhase === "uploading" && (
          <div className="flex items-center gap-3 p-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="text-sm text-petra-muted">מנתח קובץ...</span>
          </div>
        )}

        {importPhase === "preview" && importStats && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
              <Info className="w-4 h-4 flex-shrink-0" />
              סיכום ניתוח הקובץ
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-lg font-bold text-emerald-700">{importStats.totalCustomers}</p>
                <p className="text-xs text-emerald-600">לקוחות חדשים</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{importStats.totalPets}</p>
                <p className="text-xs text-blue-600">חיות מחמד</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-lg font-bold text-amber-700">{importStats.skippedRows}</p>
                <p className="text-xs text-amber-600">שורות דולגו</p>
              </div>
            </div>

            {importStats.dbDuplicates > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {importStats.dbDuplicates} לקוחות כבר קיימים במערכת (ימוזגו)
              </p>
            )}

            {importTopIssues.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-petra-muted">בעיות שזוהו:</p>
                {importTopIssues.slice(0, 5).map((issue, i) => (
                  <p key={i} className="text-xs text-red-500">
                    שורה {issue.row}: {issue.message}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleExecuteImport}>
                <CheckCircle className="w-4 h-4" />
                אשר ייבוא
              </button>
              <button className="btn-secondary" onClick={resetImport}>ביטול</button>
            </div>
          </div>
        )}

        {importPhase === "executing" && (
          <div className="flex items-center gap-3 p-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="text-sm text-petra-muted">מייבא נתונים...</span>
          </div>
        )}

        {importPhase === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              הייבוא הושלם בהצלחה!
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-lg font-bold text-emerald-700">{importResult.createdCustomers}</p>
                <p className="text-xs text-emerald-600">לקוחות נוצרו</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{importResult.mergedCustomers}</p>
                <p className="text-xs text-blue-600">לקוחות מוזגו</p>
              </div>
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-center">
                <p className="text-lg font-bold text-violet-700">{importResult.createdPets}</p>
                <p className="text-xs text-violet-600">חיות נוצרו</p>
              </div>
            </div>
            <button className="btn-secondary" onClick={resetImport}>ייבוא נוסף</button>
          </div>
        )}

        {importPhase === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {importError || "אירעה שגיאה"}
            </div>
            <button className="btn-secondary" onClick={resetImport}>נסה שוב</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team Tab (Owner only) ───────────────────────────────────────────────────

interface TeamMember {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    sessions?: { lastSeenAt: string }[];
  };
}

const ROLE_LABELS: Record<string, string> = { owner: "בעלים", manager: "מנהל", user: "עובד" };
const ROLE_COLORS: Record<string, string> = {
  owner: "badge-brand",
  manager: "badge-warning",
  user: "badge-neutral",
};

function TeamTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => fetchJSON<TeamMember[]>(`/api/admin/${user?.businessId}/members`),
    enabled: !!user?.businessId,
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      fetch(`/api/admin/${user?.businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("הרשאות עודכנו בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון הרשאות. נסה שוב."),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ memberId, isActive }: { memberId: string; isActive: boolean }) =>
      fetch(`/api/admin/${user?.businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success(isActive ? "המשתמש הופעל" : "המשתמש הושבת");
    },
    onError: () => toast.error("שגיאה בעדכון הסטטוס. נסה שוב."),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 max-w-2xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ניהול צוות</h3>
          <span className="text-sm text-petra-muted">({members?.length ?? 0})</span>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAddModal(true)}>
          <UserPlus className="w-4 h-4" />
          הוסף עובד
        </button>
      </div>

      <div className="space-y-3">
        {members?.map((member) => {
          const isSelf = member.user.id === user?.id;
          const lastSeen = member.user.sessions?.[0]?.lastSeenAt;

          return (
            <div key={member.id} className="card p-4 flex items-center gap-4">
              {/* Avatar */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                member.isActive ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-400"
              )}>
                {member.user.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-petra-text truncate">{member.user.name}</span>
                  <span className={cn("badge text-xs", ROLE_COLORS[member.role] ?? "badge-neutral")}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  {!member.isActive && (
                    <span className="badge badge-danger text-xs">מושבת</span>
                  )}
                  {isSelf && (
                    <span className="text-xs text-petra-muted">(את/ה)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-petra-muted">{member.user.email}</span>
                  <span className="text-xs text-petra-muted">
                    {lastSeen ? formatRelativeTime(lastSeen) : "לא התחבר"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {!isSelf && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    className="input text-xs py-1.5 px-2 w-24"
                    value={member.role}
                    onChange={(e) => roleMutation.mutate({ memberId: member.id, role: e.target.value })}
                    disabled={roleMutation.isPending}
                  >
                    <option value="owner">בעלים</option>
                    <option value="manager">מנהל</option>
                    <option value="user">עובד</option>
                  </select>
                  <button
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                      member.isActive
                        ? "text-red-600 hover:bg-red-50 border border-red-200"
                        : "text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                    )}
                    onClick={() => toggleActiveMutation.mutate({ memberId: member.id, isActive: !member.isActive })}
                    disabled={toggleActiveMutation.isPending}
                  >
                    {member.isActive ? "השבת" : "הפעל"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <AddEmployeeModal
          businessId={user?.businessId ?? ""}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["team-members"] });
          }}
        />
      )}

      {/* Pending approvals panel — visible to all team members (owner sees full controls, manager sees own requests) */}
      <PendingApprovalsPanel />
    </div>
  );
}

// ─── Add Employee Modal ─────────────────────────────────────────────────────

function AddEmployeeModal({
  businessId,
  onClose,
  onSuccess,
}: {
  businessId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/${businessId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, temporaryPassword: password }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "שגיאה ביצירת עובד");
        }
        return r.json();
      }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">עובד חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף עובד חדש לצוות</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">שם מלא *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">אימייל *</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
            </div>
            <div>
              <label className="label">סיסמה זמנית *</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 8 תווים" dir="ltr" minLength={8} />
            </div>
          </div>
          <div>
            <label className="label">תפקיד</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">עובד</option>
              <option value="manager">מנהל</option>
              <option value="owner">בעלים</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || !email.trim() || !password.trim() || password.length < 12 || mutation.isPending}
            onClick={() => { setError(null); mutation.mutate(); }}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {mutation.isPending ? "מוסיף..." : "הוסף עובד"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}


// ─── Service Dogs Settings Tab ───────────────────────────────────────────────

function ServiceDogsSettingsTab() {
  const queryClient = useQueryClient();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [form, setForm] = useState<SdSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const settings: SdSettings = form ?? (biz?.sdSettings ? { ...DEFAULT_SD_SETTINGS, ...biz.sdSettings } : DEFAULT_SD_SETTINGS);

  const mutation = useMutation({
    mutationFn: (data: SdSettings) =>
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdSettings: data }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("הגדרות כלבי שירות נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  if (isLoading) {
    return <div className="space-y-4 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}</div>;
  }

  function toggle(field: keyof SdSettings) {
    setForm({ ...settings, [field]: !settings[field as "trackHours" | "allowManualCert"] });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Track hours */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-petra-text">מעקב שעות הכשרה</p>
            <p className="text-sm text-petra-muted mt-0.5">האם לעקוב אחרי שעות ולהציג התקדמות לכל כלב</p>
          </div>
          <button
            onClick={() => toggle("trackHours")}
            className={cn("flex-shrink-0 w-12 h-6 rounded-full transition-colors relative", settings.trackHours ? "bg-orange-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", settings.trackHours ? "right-0.5" : "left-0.5")} />
          </button>
        </div>

        {/* Default target hours — shown only when trackHours is on */}
        {settings.trackHours && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="label">יעד שעות ברירת מחדל לכלב חדש</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                max={999}
                className="input w-28 text-center"
                value={settings.defaultTargetHours}
                onChange={(e) => setForm({ ...settings, defaultTargetHours: Math.max(1, Number(e.target.value) || 1) })}
              />
              <span className="text-sm text-petra-muted">שעות</span>
            </div>
            <p className="text-xs text-petra-muted mt-1">ניתן לשנות ליעד שונה לכל כלב בפרופיל הכלב</p>
          </div>
        )}
      </div>

      {/* Allow manual certification */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-petra-text">אפשר הסמכה ידנית</p>
            <p className="text-sm text-petra-muted mt-0.5">
              {settings.trackHours
                ? "אפשר לבעל העסק להסמיך כלב גם אם לא הגיע ליעד שעות ההכשרה"
                : "הסמכה על פי שיקול דעת בעל העסק — ללא מעקב שעות"}
            </p>
          </div>
          <button
            onClick={() => toggle("allowManualCert")}
            className={cn("flex-shrink-0 w-12 h-6 rounded-full transition-colors relative", settings.allowManualCert ? "bg-orange-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", settings.allowManualCert ? "right-0.5" : "left-0.5")} />
          </button>
        </div>
        {!settings.trackHours && !settings.allowManualCert && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            כשמעקב שעות כבוי, מומלץ לאפשר הסמכה ידנית כדי שניתן יהיה להסמיך כלבים
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-petra-muted space-y-1">
        <p className="font-medium text-petra-text mb-2">סיכום הגדרות:</p>
        <p>• מעקב שעות: <span className="font-medium text-petra-text">{settings.trackHours ? "פעיל" : "כבוי"}</span></p>
        {settings.trackHours && (
          <p>• יעד שעות לכלב חדש: <span className="font-medium text-petra-text">{settings.defaultTargetHours} שעות</span></p>
        )}
        <p>• הסמכה ידנית: <span className="font-medium text-petra-text">{settings.allowManualCert ? "מאושרת" : "לא מאושרת"}</span></p>
      </div>

      <button
        className="btn-primary"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(settings)}
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {mutation.isPending ? "שומר..." : saved ? "נשמר!" : "שמור הגדרות"}
      </button>
    </div>
  );
}

// ─── Contracts Tab ────────────────────────────────────────────────────────────

interface ContractTemplate {
  id: string;
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  signaturePage: number;
  signatureX: number;
  signatureY: number;
  signatureWidth: number;
  signatureHeight: number;
  fields: string; // JSON
  createdAt: string;
}

function ContractsTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["contract-templates"],
    queryFn: () => fetch("/api/contracts/templates").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contracts/templates/${id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      toast.success("תבנית נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת התבנית"),
  });

  if (isLoading) {
    return <div className="space-y-3 animate-pulse">{[1,2].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-petra-text">תבניות חוזים</h2>
          <p className="text-sm text-petra-muted mt-0.5">העלה תבניות PDF להחתמת לקוחות</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          תבנית חדשה
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-petra-muted">אין תבניות חוזים עדיין</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            העלה תבנית ראשונה
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            let fieldCount = 0;
            try { fieldCount = JSON.parse(t.fields || "[]").length; } catch { fieldCount = 0; }
            return (
              <div key={t.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-petra-text text-sm">{t.name}</p>
                  <p className="text-xs text-petra-muted mt-0.5">
                    {t.fileName} · {(t.fileSize / 1024).toFixed(0)} KB
                    {fieldCount > 0 ? ` · ${fieldCount} שדות` : " · ללא שדות"}
                  </p>
                  <p className="text-xs text-petra-muted">
                    נוצר: {new Date(t.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditingTemplate(t)}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    ערוך
                  </button>
                  <button
                    onClick={() => { if (confirm(`למחוק את "${t.name}"?`)) deleteMutation.mutate(t.id); }}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <AddContractTemplateModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ["contract-templates"] }); }} />}
      {editingTemplate && <EditContractTemplateModal template={editingTemplate} onClose={() => setEditingTemplate(null)} onSaved={() => { setEditingTemplate(null); queryClient.invalidateQueries({ queryKey: ["contract-templates"] }); }} />}
    </div>
  );
}

// ─── Contract field types ────────────────────────────────────────────────────

interface ContractField {
  id: string;
  type: "customer_name" | "id_number" | "address" | "phone" | "signature";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const FIELD_TYPES: { type: ContractField["type"]; label: string; color: string; bgColor: string }[] = [
  { type: "customer_name", label: "👤 שם לקוח", color: "#2563eb", bgColor: "rgba(37,99,235,0.12)" },
  { type: "id_number",     label: "🆔 ת.ז.",     color: "#7c3aed", bgColor: "rgba(124,58,237,0.12)" },
  { type: "address",       label: "🏠 כתובת",    color: "#16a34a", bgColor: "rgba(22,163,74,0.12)" },
  { type: "phone",         label: "📞 טלפון",    color: "#0891b2", bgColor: "rgba(8,145,178,0.12)" },
  { type: "signature",     label: "✍️ חתימה",    color: "#ea580c", bgColor: "rgba(234,88,12,0.12)" },
];

const FIELD_DEFAULTS: Record<ContractField["type"], { width: number; height: number }> = {
  customer_name: { width: 0.3,  height: 0.04 },
  id_number:     { width: 0.2,  height: 0.04 },
  address:       { width: 0.4,  height: 0.04 },
  phone:         { width: 0.2,  height: 0.04 },
  signature:     { width: 0.35, height: 0.07 },
};

const FIELD_SHORT_LABELS: Record<ContractField["type"], string> = {
  customer_name: "שם לקוח",
  id_number: "ת.ז.",
  address: "כתובת",
  phone: "טלפון",
  signature: "חתימה",
};

function ContractFieldOverlay({
  field,
  overlayRef,
  onUpdate,
  onRemove,
}: {
  field: ContractField;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (id: string, updates: Partial<ContractField>) => void;
  onRemove: (id: string) => void;
}) {
  const ft = FIELD_TYPES.find((t) => t.type === field.type)!;

  const startInteraction = (e: React.PointerEvent, mode: "drag" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const rect = overlayRef.current!.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const { x, y, width, height } = field;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "drag") {
        onUpdate(field.id, {
          x: Math.max(0, Math.min(1 - width, x + dx)),
          y: Math.max(0, Math.min(1 - height, y + dy)),
        });
      } else {
        onUpdate(field.id, {
          width: Math.max(0.05, Math.min(1 - x, width + dx)),
          height: Math.max(0.02, Math.min(1 - y, height + dy)),
        });
      }
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        border: `2px dashed ${ft.color}`,
        background: ft.bgColor,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 4px",
        cursor: "move",
        touchAction: "none",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).dataset.resize) return;
        startInteraction(e, "drag");
      }}
    >
      <span style={{ fontSize: 10, color: ft.color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", pointerEvents: "none" }}>
        {ft.label}
      </span>
      <button
        type="button"
        style={{ color: ft.color, lineHeight: 1, flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
        onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}
      >
        ×
      </button>
      {/* Resize handle — bottom-right */}
      <div
        data-resize="true"
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          width: 8,
          height: 8,
          background: ft.color,
          borderRadius: 2,
          cursor: "nwse-resize",
          touchAction: "none",
        }}
        onPointerDown={(e) => startInteraction(e, "resize")}
      />
    </div>
  );
}

function FieldsSummary({ fields, onClear }: { fields: ContractField[]; onClear: () => void }) {
  if (fields.length === 0) return null;
  const hasSignature = fields.some((f) => f.type === "signature");
  const byPage = fields.reduce<Record<number, ContractField[]>>((acc, f) => {
    (acc[f.page] ||= []).push(f);
    return acc;
  }, {});
  const pages = Object.keys(byPage).map(Number).sort((a, b) => a - b);

  return (
    <div className="mt-1.5 space-y-1">
      <div className="text-xs text-petra-muted space-y-0.5">
        {pages.map((p) => {
          const labels = byPage[p].map((f) => FIELD_SHORT_LABELS[f.type]);
          return (
            <p key={p}>עמוד {p}: <span className="font-medium text-petra-text">{labels.join(", ")}</span></p>
          );
        })}
      </div>
      <p className="text-xs text-petra-muted">
        {fields.length} שד{fields.length === 1 ? "ה" : "ות"} בסך הכל ·{" "}
        <button type="button" className="underline" onClick={onClear}>נקה הכל</button>
      </p>
      {!hasSignature && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs">לא הוצב שדה חתימה – הלקוח לא יוכל לחתום על המסמך</p>
        </div>
      )}
    </div>
  );
}

function AddContractTemplateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signaturePage, setSignaturePage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [fields, setFields] = useState<ContractField[]>([]);
  const [selectedType, setSelectedType] = useState<ContractField["type"]>("signature");
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const renderPage = useCallback(async (doc: NonNullable<typeof pdfDocRef.current>, pageNum: number) => {
    if (!canvasRef.current) return;
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    const page = await doc.getPage(pageNum);
    const containerWidth = Math.max(400, canvasRef.current.parentElement?.clientWidth ?? 600);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = containerWidth / unscaled.width;
    const viewport = page.getViewport({ scale });
    canvasRef.current.width = viewport.width;
    canvasRef.current.height = viewport.height;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
  }, []);

  useEffect(() => {
    if (!file) return;
    setPdfLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const ab = await file.arrayBuffer();
        const doc = await getDocument({ data: new Uint8Array(ab), cMapUrl: "/cmaps/", cMapPacked: true, standardFontDataUrl: "/standard_fonts/" }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setSignaturePage(1);
        await renderPage(doc, 1);
      } catch (e) {
        console.error("PDF load error", e);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file, renderPage]);

  useEffect(() => {
    if (!pdfDocRef.current || signaturePage < 1) return;
    renderPage(pdfDocRef.current, signaturePage);
  }, [signaturePage, renderPage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFields([]);
    pdfDocRef.current = null;
    setTotalPages(0);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const def = FIELD_DEFAULTS[selectedType];
    const newField: ContractField = {
      id: crypto.randomUUID(),
      type: selectedType,
      page: signaturePage,
      x: Math.max(0, Math.min(x - def.width / 2, 1 - def.width)),
      y: Math.max(0, Math.min(y - def.height / 2, 1 - def.height)),
      width: def.width,
      height: def.height,
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));
  const updateField = (id: string, updates: Partial<ContractField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));

  const [sigWarningShown, setSigWarningShown] = useState(false);

  const handleSave = async () => {
    if (!file || !name.trim()) return;
    if (!fields.some((f) => f.type === "signature") && !sigWarningShown) {
      setSigWarningShown(true);
      toast.error("לא הוצב שדה חתימה – הלקוח לא יוכל לחתום. לחץ שוב לשמור בכל זאת.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("signaturePage", String(signaturePage));
      fd.append("fields", JSON.stringify(fields));
      const r = await fetch("/api/contracts/templates", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "שגיאה בשמירה"); return; }
      toast.success("תבנית נשמרה!");
      onSaved();
    } catch {
      toast.error("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  };

  const currentPageFields = fields.filter((f) => f.page === signaturePage);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">תבנית חוזה חדשה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם התבנית *</label>
            <input className="input" placeholder="לדוג׳: חוזה פנסיון, הסכם אילוף..." value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">קובץ PDF *</label>
            <input type="file" accept="application/pdf" onChange={handleFileChange} className="input" />
          </div>

          {file && (
            <div className="space-y-3">
              {/* Page navigation */}
              {totalPages > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-petra-muted">עמוד:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40"
                      disabled={signaturePage <= 1}
                      onClick={() => setSignaturePage((p) => Math.max(1, p - 1))}
                    >‹</button>
                    <span className="text-sm font-medium text-petra-text min-w-[60px] text-center">
                      {signaturePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40"
                      disabled={signaturePage >= totalPages}
                      onClick={() => setSignaturePage((p) => Math.min(totalPages, p + 1))}
                    >›</button>
                  </div>
                </div>
              )}

              {/* Field type toolbar */}
              <div>
                <p className="text-xs text-petra-muted mb-2">בחר סוג שדה ולחץ על המסמך למיקומו:</p>
                <div className="flex flex-wrap gap-2">
                  {FIELD_TYPES.map((ft) => (
                    <button
                      key={ft.type}
                      type="button"
                      onClick={() => setSelectedType(ft.type)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        selectedType === ft.type
                          ? "ring-2 ring-orange-500 border-transparent"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                      style={selectedType === ft.type ? { background: ft.bgColor, color: ft.color } : {}}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas PDF viewer with field overlays */}
              <div>
                <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100" style={{ minHeight: 300 }}>
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                  )}
                  <canvas ref={canvasRef} className="w-full block" style={{ display: pdfLoading ? "none" : "block" }} />
                  <div
                    ref={overlayRef}
                    className="absolute inset-0 cursor-crosshair"
                    style={{ zIndex: 10 }}
                    onClick={handleOverlayClick}
                  >
                    {currentPageFields.map((f) => (
                      <ContractFieldOverlay
                        key={f.id}
                        field={f}
                        overlayRef={overlayRef}
                        onUpdate={updateField}
                        onRemove={removeField}
                      />
                    ))}
                  </div>
                </div>
                <FieldsSummary fields={fields} onClear={() => setFields([])} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100">
          <button
            className="btn-primary flex-1"
            disabled={!file || !name.trim() || saving}
            onClick={handleSave}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />שומר...</> : <><Save className="w-4 h-4" />שמור תבנית</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Contract Template Modal ────────────────────────────────────────────

function EditContractTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: ContractTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [signaturePage, setSignaturePage] = useState(template.signaturePage);
  const [totalPages, setTotalPages] = useState(0);
  const [fields, setFields] = useState<ContractField[]>(() => {
    try { return JSON.parse(template.fields || "[]"); } catch { return []; }
  });
  const [selectedType, setSelectedType] = useState<ContractField["type"]>("signature");
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const renderPage = useCallback(async (doc: NonNullable<typeof pdfDocRef.current>, pageNum: number) => {
    if (!canvasRef.current || !containerRef.current) return;
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    const page = await doc.getPage(pageNum);
    const containerWidth = Math.max(400, containerRef.current.clientWidth || 600);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = containerWidth / unscaled.width;
    const viewport = page.getViewport({ scale });
    canvasRef.current.width = viewport.width;
    canvasRef.current.height = viewport.height;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
  }, []);

  // Load PDF from existing URL — delay slightly so container has width
  useEffect(() => {
    setPdfLoading(true);
    setPdfError(false);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const resp = await fetch(template.fileUrl);
        if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        const doc = await getDocument({ data: new Uint8Array(ab), cMapUrl: "/cmaps/", cMapPacked: true, standardFontDataUrl: "/standard_fonts/" }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        await renderPage(doc, signaturePage);
      } catch (e) {
        console.error("PDF load error", e);
        if (!cancelled) setPdfError(true);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.fileUrl]);

  useEffect(() => {
    if (!pdfDocRef.current || signaturePage < 1) return;
    renderPage(pdfDocRef.current, signaturePage);
  }, [signaturePage, renderPage]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const def = FIELD_DEFAULTS[selectedType];
    const newField: ContractField = {
      id: crypto.randomUUID(),
      type: selectedType,
      page: signaturePage,
      x: Math.max(0, Math.min(x - def.width / 2, 1 - def.width)),
      y: Math.max(0, Math.min(y - def.height / 2, 1 - def.height)),
      width: def.width,
      height: def.height,
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));
  const updateField = (id: string, updates: Partial<ContractField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));

  const [sigWarningShown, setSigWarningShown] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (!fields.some((f) => f.type === "signature") && !sigWarningShown) {
      setSigWarningShown(true);
      toast.error("לא הוצב שדה חתימה – הלקוח לא יוכל לחתום. לחץ שוב לשמור בכל זאת.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/contracts/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), fields: JSON.stringify(fields) }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "שגיאה בשמירה"); return; }
      toast.success("תבנית עודכנה!");
      onSaved();
    } catch {
      toast.error("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  };

  const currentPageFields = fields.filter((f) => f.page === signaturePage);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">עריכת תבנית: {template.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם התבנית</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-3">
            {/* Page navigation */}
            {totalPages > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-petra-muted">עמוד:</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40" disabled={signaturePage <= 1} onClick={() => setSignaturePage((p) => Math.max(1, p - 1))}>‹</button>
                  <span className="text-sm font-medium text-petra-text min-w-[60px] text-center">{signaturePage} / {totalPages}</span>
                  <button type="button" className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40" disabled={signaturePage >= totalPages} onClick={() => setSignaturePage((p) => Math.min(totalPages, p + 1))}>›</button>
                </div>
              </div>
            )}

            {/* Field type toolbar */}
            <div>
              <p className="text-xs text-petra-muted mb-2">בחר סוג שדה ולחץ על המסמך למיקומו:</p>
              <div className="flex flex-wrap gap-2">
                {FIELD_TYPES.map((ft) => (
                  <button key={ft.type} type="button" onClick={() => setSelectedType(ft.type)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", selectedType === ft.type ? "ring-2 ring-orange-500 border-transparent" : "border-slate-200 hover:border-slate-300")}
                    style={selectedType === ft.type ? { background: ft.bgColor, color: ft.color } : {}}>
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas + overlays */}
            <div>
              <div ref={containerRef} className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100" style={{ minHeight: 300 }}>
                {pdfLoading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
                {pdfError && !pdfLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-500">
                    <FileText className="w-8 h-8" />
                    <p className="text-sm">שגיאה בטעינת המסמך</p>
                    <button type="button" className="text-xs underline" onClick={() => { setPdfLoading(true); setPdfError(false); setTimeout(async () => { try { const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist"); GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; const resp = await fetch(template.fileUrl); const ab = await resp.arrayBuffer(); const doc = await getDocument({ data: new Uint8Array(ab), cMapUrl: "/cmaps/", cMapPacked: true, standardFontDataUrl: "/standard_fonts/" }).promise; pdfDocRef.current = doc; setTotalPages(doc.numPages); await renderPage(doc, signaturePage); setPdfError(false); } catch { setPdfError(true); } finally { setPdfLoading(false); } }, 100); }}>נסה שוב</button>
                  </div>
                )}
                <canvas ref={canvasRef} className="w-full block" style={{ display: pdfLoading || pdfError ? "none" : "block" }} />
                {!pdfLoading && !pdfError && (
                  <div ref={overlayRef} className="absolute inset-0 cursor-crosshair" style={{ zIndex: 10 }} onClick={handleOverlayClick}>
                    {currentPageFields.map((f) => (
                      <ContractFieldOverlay
                        key={f.id}
                        field={f}
                        overlayRef={overlayRef}
                        onUpdate={updateField}
                        onRemove={removeField}
                      />
                    ))}
                  </div>
                )}
              </div>
              <FieldsSummary fields={fields} onClear={() => setFields([])} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100">
          <button className="btn-primary flex-1" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />שומר...</> : <><Save className="w-4 h-4" />שמור שינויים</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────────

import AvailabilityTab from "./availability-tab";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const { isOwner, isManager } = useAuth();
  const { isFree, isBasic, isGroomer, can } = usePlan();
  const invoicingParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"business" | "team" | "availability" | "integrations" | "invoicing" | "data" | "messages" | "service-dogs" | "contracts">(
    gcalParam ? "integrations" : invoicingParam === "invoicing" ? "invoicing" : invoicingParam === "messages" ? "messages" : invoicingParam === "data" ? "data" : invoicingParam === "contracts" ? "contracts" : "business"
  );

  // Tabs locked per tier
  const FREE_LOCKED_TABS = new Set(["availability", "team", "messages", "service-dogs", "data", "integrations", "contracts"]);
  // Basic: open business, data, integrations, team — lock availability, messages, service-dogs
  const BASIC_LOCKED_TABS = new Set(["availability", "messages", "service-dogs"]);

  const tabs = [
    { id: "business" as const, label: "פרטי העסק", icon: Building2 },
    { id: "availability" as const, label: "זמינות", icon: Calendar },
    ...(isOwner ? [{ id: "team" as const, label: "ניהול צוות", icon: Users2 }] : []),
    // { id: "invoicing" as const, label: "חשבוניות", icon: FileText }, // hidden — in development
    { id: "messages" as const, label: "הודעות ואוטומציות", icon: MessageCircle },
    // Service dogs tab — hidden for groomer tier (irrelevant track)
    ...(!isGroomer ? [{ id: "service-dogs" as const, label: "כלבי שירות", icon: PawPrint }] : []),
    ...(isOwner || isManager ? [{ id: "contracts" as const, label: "חוזים", icon: FileText }] : []),
    { id: "data" as const, label: "נתונים", icon: Database },
    { id: "integrations" as const, label: "אינטגרציות", icon: Plug },
  ];

  return (
    <div>
      <PageTitle title="הגדרות" />
      <DesktopBanner />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">הגדרות</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const locked = (isFree && FREE_LOCKED_TABS.has(tab.id)) || (isBasic && BASIC_LOCKED_TABS.has(tab.id));
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {locked && <span className="text-[10px]">🔒</span>}
            </button>
          );
        })}
      </div>

      {activeTab === "business" && <BusinessTab />}
      {activeTab === "availability" && (
        (isFree || isBasic)
          ? <PaywallCard title="הגדרות זמינות" description="הגדר שעות פעילות, חסימות ופסקי זמן — זמין במנוי פרו ומעלה." requiredTier="pro" variant="page" />
          : <AvailabilityTab />
      )}
      {activeTab === "team" && isOwner && (
        isFree
          ? <PaywallCard title="ניהול צוות" description="הוסף חברי צוות ונהל הרשאות — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <TeamTab />
      )}
      {activeTab === "invoicing" && <InvoicingTab />}
      {activeTab === "messages" && (
        (isFree || isBasic)
          ? <PaywallCard title="הודעות ואוטומציות" description="תבניות WhatsApp, תזכורות אוטומטיות ואוטומציות — זמין במנוי פרו ומעלה." requiredTier="pro" variant="page" />
          : <MessagesPanel />
      )}
      {activeTab === "service-dogs" && (
        !can("service_dogs")
          ? <PaywallCard title="הגדרות כלבי שירות" description="הגדרות תוכנית כלבי שירות — זמין במנוי Service Dog בלבד." requiredTier="service_dog" variant="page" />
          : <ServiceDogsSettingsTab />
      )}
      {activeTab === "data" && (
        isFree
          ? <PaywallCard title="ייצוא נתונים" description="ייצוא לקוחות ובעלי חיים ל-Excel/CSV — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <DataTab />
      )}
      {activeTab === "integrations" && (
        isFree
          ? <PaywallCard title="אינטגרציות" description="חבר יומן Google, WhatsApp ועוד — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <IntegrationsTab />
      )}
      {activeTab === "contracts" && (
        isFree
          ? <PaywallCard title="חוזים דיגיטליים" description="שלח חוזים לחתימה דיגיטלית — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <ContractsTab />
      )}
    </div>
  );
}
