"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
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
} from "lucide-react";

const RepeatIcon = Repeat;
import { useSearchParams } from "next/navigation";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { MessagesPanel } from "@/components/messages/messages-panel";
import { toast } from "sonner";
import { TIERS } from "@/lib/constants";
import { useAuth } from "@/providers/auth-provider";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Business {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tier: string;
  vatNumber: string | null;
  boardingCheckInTime: string | null;
  boardingCheckOutTime: string | null;
  boardingCalcMode: string | null;
  boardingMinNights: number | null;
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

const TIER_ICONS = { basic: Star, pro: Zap, groomer: Crown };

// ─── Business Tab ────────────────────────────────────────────────────────────

function BusinessTab() {
  const queryClient = useQueryClient();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [form, setForm] = useState<Partial<Business> | null>(null);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const editing = form ?? biz;

  const mutation = useMutation({
    mutationFn: (data: Partial<Business>) =>
      fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
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
      {/* Tier Info */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(251,146,60,0.04) 100%)", borderColor: "rgba(249,115,22,0.15)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)" }}>
          <TierIcon className="w-5 h-5 text-brand-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-petra-text">חבילה: {tierInfo?.name ?? editing.tier}</p>
          <p className="text-xs text-petra-muted">{biz?._count.customers} לקוחות · {biz?._count.appointments} פגישות</p>
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
          <label className="label">מספר עוסק מורשה</label>
          <input className={cn("input", errors.vatNumber && "border-red-300 focus:ring-red-200")} placeholder="000000000" value={editing.vatNumber ?? ""} onChange={(e) => { setForm({ ...editing, vatNumber: e.target.value }); if (errors.vatNumber) setErrors({ ...errors, vatNumber: undefined }); }} />
          {errors.vatNumber && <p className="text-xs text-red-500 mt-1">{errors.vatNumber}</p>}
        </div>
      </div>

      {/* Boarding Settings */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Hotel className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-petra-text">הגדרות פנסיון</h3>
        </div>
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
      </div>

      {/* Booking Link */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-petra-text">לינק הזמנה מקוונת</h3>
        </div>
        <p className="text-xs text-petra-muted mb-3">שלח ללקוחות לינק זה כדי שיוכלו לקבוע תור בעצמם</p>
        <BookingLinkBox />
      </div>

      <button
        className={cn("btn-primary flex items-center gap-2 transition-all", saved && "bg-emerald-500 hover:brightness-100")}
        style={saved ? { background: "#10B981" } : undefined}
        disabled={mutation.isPending}
        onClick={handleSave}
      >
        {saved ? <><CheckCircle2 className="w-4 h-4" /> נשמר!</> : <><Save className="w-4 h-4" /> שמור שינויים</>}
      </button>
    </div>
  );
}

function BookingLinkBox() {
  const [copied, setCopied] = useState(false);
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/demo-business-001`
    : "/book/demo-business-001";

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waMsg = `היי! 🐾\nרוצה לקבוע תור? אפשר לעשות את זה בקלות דרך הלינק הזה:\n${bookingUrl}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

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
  const gcalStatus = searchParams.get("gcal");
  const [showInvoicingModal, setShowInvoicingModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => fetchJSON<Integration[]>("/api/integrations"),
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

      {integrations?.map((integ) => {
        const Icon = ICON_MAP[integ.icon] ?? Plug;
        const isInvoicing = integ.id === "invoicing";
        const isGcal = integ.id === "google-calendar";
        const isStripe = integ.id === "stripe";

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

      {/* ── Make.com Webhook ── */}
      <MakeWebhookCard />
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

// ─── Make Webhook Card ────────────────────────────────────────────────────────

function MakeWebhookCard() {
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const webhookUrl = `${appUrl}/api/webhooks/lead`;
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // API key is served from a dedicated endpoint so the secret never leaks into the client bundle
  const { data: keyData } = useQuery<{ key: string }>({
    queryKey: ["make-webhook-key"],
    queryFn: () => fetchJSON<{ key: string }>("/api/webhooks/lead/key"),
  });

  function copy(value: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(value).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
          <Zap className="w-6 h-6 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-petra-text">Make.com — לידים מהאתר</h3>
            <span className="badge badge-success text-xs">פעיל</span>
          </div>
          <p className="text-sm text-petra-muted mt-0.5">
            חבר את all-dog.co.il דרך מייק — כל פנייה בטופס תיצור ליד חדש אוטומטית בפטרה.
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
            className="input flex-1 font-mono text-sm bg-slate-50 select-all"
            onFocus={(e) => e.target.select()}
          />
          <button
            className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0"
            onClick={() => copy(webhookUrl, setCopiedUrl)}
          >
            {copiedUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Upload className="w-4 h-4" />}
            {copiedUrl ? "הועתק!" : "העתק"}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="label text-xs">API Key (x-api-key header)</label>
        <div className="flex gap-2">
          <input
            readOnly
            type={showKey ? "text" : "password"}
            value={keyData?.key ?? "טוען..."}
            className="input flex-1 font-mono text-sm bg-slate-50 select-all"
            onFocus={(e) => e.target.select()}
          />
          <button
            className="btn-ghost text-sm flex-shrink-0"
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0"
            onClick={() => keyData && copy(keyData.key, setCopiedKey)}
          >
            {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Upload className="w-4 h-4" />}
            {copiedKey ? "הועתק!" : "העתק"}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2 text-petra-muted">
        <p className="font-medium text-petra-text">איך לחבר במייק:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>צור סצנריו חדש במייק עם טריגר <strong>Webhooks → Custom Webhook</strong></li>
          <li>חבר אותו לטופס הצור קשר באתר all-dog.co.il</li>
          <li>הוסף מודול <strong>HTTP → Make a request</strong> עם ה-URL וה-Key מלמעלה</li>
          <li>
            מפה את שדות הטופס לגוף הבקשה (JSON):
            <pre className="mt-1.5 p-2 bg-white rounded-lg border border-slate-200 text-xs font-mono whitespace-pre-wrap">{`{
  "name": "{{שם מלא}}",
  "phone": "{{טלפון}}",
  "email": "{{אימייל}}",
  "notes": "{{הודעה}}",
  "petName": "{{שם כלב}}",
  "source": "all-dog"
}`}</pre>
          </li>
          <li>שלח בקשת <strong>POST</strong> עם header: <code className="bg-white px-1 rounded">x-api-key: &lt;API Key&gt;</code></li>
        </ol>
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

function DataTab() {
  const queryClient = useQueryClient();

  // Export state
  const [exportType, setExportType] = useState("customers");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importTopIssues, setImportTopIssues] = useState<{ row: number; message: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export handler
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ type: exportType, format: exportFormat });
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);

      const res = await fetch(`/api/exports/download?${params}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `petra_${exportType}_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("שגיאה בהורדת הקובץ");
    } finally {
      setExporting(false);
    }
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
    <div className="space-y-8 max-w-2xl">
      {/* ── Export Section ── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ייצוא נתונים</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג נתונים</label>
              <select className="input" value={exportType} onChange={(e) => setExportType(e.target.value)}>
                <option value="customers">לקוחות</option>
                <option value="pets">חיות מחמד</option>
                <option value="both">לקוחות + חיות</option>
              </select>
            </div>
            <div>
              <label className="label">פורמט</label>
              <select className="input" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מתאריך (אופציונלי)</label>
              <input type="date" className="input" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">עד תאריך (אופציונלי)</label>
              <input type="date" className="input" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
            </div>
          </div>

          <button className="btn-primary flex items-center gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "מייצא..." : "הורד קובץ"}
          </button>
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
            disabled={!name.trim() || !email.trim() || !password.trim() || password.length < 8 || mutation.isPending}
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

// ─── TasksTab ─────────────────────────────────────────────────────────────────

const TASK_CATEGORIES = [
  { value: "GENERAL", label: "כללי" },
  { value: "BOARDING", label: "פנסיון" },
  { value: "TRAINING", label: "אילוף" },
  { value: "HEALTH", label: "בריאות" },
  { value: "MEDICATION", label: "תרופות" },
  { value: "FEEDING", label: "האכלה" },
  { value: "LEADS", label: "לידים" },
];

const TASK_PRIORITIES = [
  { value: "LOW", label: "נמוכה" },
  { value: "MEDIUM", label: "בינונית" },
  { value: "HIGH", label: "גבוהה" },
  { value: "URGENT", label: "דחוף" },
];

const RRULE_PRESETS = [
  { label: "כל יום", value: "FREQ=DAILY;INTERVAL=1" },
  { label: "כל שבוע", value: "FREQ=WEEKLY;INTERVAL=1" },
  { label: "כל שבועיים", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "כל חודש", value: "FREQ=MONTHLY;INTERVAL=1" },
];

interface TaskTemplate {
  id: string;
  name: string;
  defaultCategory: string;
  defaultPriority: string;
  defaultTitleTemplate: string;
  defaultDescriptionTemplate: string | null;
}

interface RecurrenceRule {
  id: string;
  rrule: string;
  startAt: string;
  endAt: string | null;
  isActive: boolean;
  lastGeneratedAt: string | null;
  _count: { tasks: number };
  template: {
    id: string;
    name: string;
    defaultCategory: string;
    defaultTitleTemplate: string;
  };
}

const emptyTemplate = { name: "", defaultCategory: "GENERAL", defaultPriority: "MEDIUM", defaultTitleTemplate: "", defaultDescriptionTemplate: "" };
const emptyRule = { templateId: "", rrule: "FREQ=DAILY;INTERVAL=1", startAt: new Date().toISOString().split("T")[0] };

function TasksTab() {
  const qc = useQueryClient();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TaskTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TaskTemplate[]>({
    queryKey: ["task-templates"],
    queryFn: () => fetch("/api/task-templates").then((r) => r.json()),
  });

  const { data: rules = [], isLoading: loadingRules } = useQuery<RecurrenceRule[]>({
    queryKey: ["task-recurrence"],
    queryFn: () => fetch("/api/task-recurrence").then((r) => r.json()),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: typeof emptyTemplate) =>
      fetch("/api/task-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("תבנית נוצרה");
      setShowTemplateModal(false);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof emptyTemplate }) =>
      fetch(`/api/task-templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("תבנית עודכנה");
      setShowTemplateModal(false);
      setEditTemplate(null);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/task-templates/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task-templates"] }); toast.success("תבנית נמחקה"); },
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof emptyRule) =>
      fetch("/api/task-recurrence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, startAt: new Date(data.startAt).toISOString() }) }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["task-recurrence"] });
      toast.success("כלל חוזרות נוצר");
      setShowRuleModal(false);
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/task-recurrence/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["task-recurrence"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/task-recurrence/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task-recurrence"] }); toast.success("כלל נמחק"); },
  });

  async function generateNow(ruleId: string) {
    setGeneratingId(ruleId);
    try {
      const res = await fetch(`/api/task-recurrence/${ruleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      }).then((r) => r.json());
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["task-recurrence"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`נוצרו ${res.created} משימות`);
    } finally {
      setGeneratingId(null);
    }
  }

  function openCreateTemplate() {
    setEditTemplate(null);
    setTemplateForm(emptyTemplate);
    setShowTemplateModal(true);
  }

  function openEditTemplate(t: TaskTemplate) {
    setEditTemplate(t);
    setTemplateForm({ name: t.name, defaultCategory: t.defaultCategory, defaultPriority: t.defaultPriority, defaultTitleTemplate: t.defaultTitleTemplate, defaultDescriptionTemplate: t.defaultDescriptionTemplate || "" });
    setShowTemplateModal(true);
  }

  function submitTemplate() {
    if (!templateForm.name.trim() || !templateForm.defaultTitleTemplate.trim()) { toast.error("שם ותבנית כותרת הם שדות חובה"); return; }
    if (editTemplate) {
      updateTemplateMutation.mutate({ id: editTemplate.id, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  }

  const catLabel = (v: string) => TASK_CATEGORIES.find((c) => c.value === v)?.label ?? v;
  const priLabel = (v: string) => TASK_PRIORITIES.find((p) => p.value === v)?.label ?? v;
  const rruleLabel = (r: string) => RRULE_PRESETS.find((p) => p.value === r)?.label ?? r;

  const isSavingTemplate = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  return (
    <div className="space-y-8">
      {/* ── Task Templates ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-brand-500" />
              תבניות משימות
            </h2>
            <p className="text-xs text-petra-muted mt-0.5">תבניות לשימוש חוזר ביצירת משימות</p>
          </div>
          <button onClick={openCreateTemplate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            תבנית חדשה
          </button>
        </div>

        {loadingTemplates ? (
          <div className="card p-8 text-center text-petra-muted text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin opacity-40" />טוען...</div>
        ) : templates.length === 0 ? (
          <div className="card p-8 text-center text-petra-muted text-sm">
            <p>אין תבניות עדיין</p>
            <button onClick={openCreateTemplate} className="mt-3 text-brand-500 hover:underline text-xs">צור תבנית ראשונה</button>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-petra-text">{t.name}</span>
                    <span className="badge badge-neutral text-[10px]">{catLabel(t.defaultCategory)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-50 text-brand-600">{priLabel(t.defaultPriority)}</span>
                  </div>
                  <p className="text-xs text-petra-muted truncate mt-0.5">{t.defaultTitleTemplate}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEditTemplate(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTemplateMutation.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recurrence Rules ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
              <RepeatIcon className="w-4 h-4 text-violet-500" />
              משימות חוזרות
            </h2>
            <p className="text-xs text-petra-muted mt-0.5">הגדרת משימות שנוצרות אוטומטית לפי לוח זמנים</p>
          </div>
          <button
            onClick={() => { setRuleForm({ ...emptyRule, startAt: new Date().toISOString().split("T")[0] }); setShowRuleModal(true); }}
            disabled={templates.length === 0}
            title={templates.length === 0 ? "צור תבנית קודם" : undefined}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            כלל חדש
          </button>
        </div>

        {templates.length === 0 && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            יש ליצור תבנית משימה לפני הגדרת חוזרות
          </div>
        )}

        {loadingRules ? (
          <div className="card p-8 text-center text-petra-muted text-sm"><Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin opacity-40" />טוען...</div>
        ) : rules.length === 0 && templates.length > 0 ? (
          <div className="card p-8 text-center text-petra-muted text-sm">אין כללי חוזרות עדיין</div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className={cn("card p-4 transition-opacity", !rule.isActive && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-petra-text">{rule.template.name}</span>
                      {!rule.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">כבוי</span>}
                      <span className="badge badge-neutral text-[10px]">{catLabel(rule.template.defaultCategory)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-petra-muted">
                      <span>{rruleLabel(rule.rrule)}</span>
                      <span>התחלה: {new Date(rule.startAt).toLocaleDateString("he-IL")}</span>
                      <span>{rule._count.tasks} משימות נוצרו</span>
                      {rule.lastGeneratedAt && <span>עודכן לאחרונה: {new Date(rule.lastGeneratedAt).toLocaleDateString("he-IL")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => generateNow(rule.id)}
                      disabled={generatingId === rule.id || !rule.isActive}
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors disabled:opacity-40"
                      title="צור משימות עכשיו (30 יום)"
                    >
                      {generatingId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => toggleRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title={rule.isActive ? "כבה" : "הפעל"}
                    >
                      {rule.isActive ? <ToggleRight className="w-5 h-5 text-brand-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button onClick={() => deleteRuleMutation.mutate(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Template Modal ── */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-petra-text">{editTemplate ? "עריכת תבנית" : "תבנית חדשה"}</h3>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">שם התבנית *</label>
                <input className="input w-full" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} placeholder='למשל: "בדיקת בריאות שבועית"' />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">קטגוריה</label>
                  <select className="input w-full" value={templateForm.defaultCategory} onChange={(e) => setTemplateForm((f) => ({ ...f, defaultCategory: e.target.value }))}>
                    {TASK_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">עדיפות</label>
                  <select className="input w-full" value={templateForm.defaultPriority} onChange={(e) => setTemplateForm((f) => ({ ...f, defaultPriority: e.target.value }))}>
                    {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">כותרת המשימה *</label>
                <input className="input w-full" value={templateForm.defaultTitleTemplate} onChange={(e) => setTemplateForm((f) => ({ ...f, defaultTitleTemplate: e.target.value }))} placeholder="כותרת שתופיע במשימה" />
              </div>
              <div>
                <label className="label">תיאור (אופציונלי)</label>
                <textarea className="input w-full resize-none" rows={3} value={templateForm.defaultDescriptionTemplate} onChange={(e) => setTemplateForm((f) => ({ ...f, defaultDescriptionTemplate: e.target.value }))} placeholder="תיאור מפורט..." />
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setShowTemplateModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200">ביטול</button>
                <button onClick={submitTemplate} disabled={isSavingTemplate || !templateForm.name.trim() || !templateForm.defaultTitleTemplate.trim()} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50">
                  {isSavingTemplate ? "שומר..." : editTemplate ? "שמור שינויים" : "צור תבנית"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rule Modal ── */}
      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-petra-text">כלל חוזרות חדש</h3>
              <button onClick={() => setShowRuleModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">תבנית משימה *</label>
                <select className="input w-full" value={ruleForm.templateId} onChange={(e) => setRuleForm((f) => ({ ...f, templateId: e.target.value }))}>
                  <option value="">— בחר תבנית —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({catLabel(t.defaultCategory)})</option>)}
                </select>
              </div>
              <div>
                <label className="label">תדירות</label>
                <select className="input w-full" value={ruleForm.rrule} onChange={(e) => setRuleForm((f) => ({ ...f, rrule: e.target.value }))}>
                  {RRULE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">תאריך התחלה</label>
                <input type="date" className="input w-full" dir="ltr" value={ruleForm.startAt} onChange={(e) => setRuleForm((f) => ({ ...f, startAt: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setShowRuleModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200">ביטול</button>
                <button
                  onClick={() => { if (!ruleForm.templateId) { toast.error("בחר תבנית"); return; } createRuleMutation.mutate(ruleForm); }}
                  disabled={createRuleMutation.isPending || !ruleForm.templateId}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
                >
                  {createRuleMutation.isPending ? "יוצר..." : "צור כלל"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────────

import AvailabilityTab from "./availability-tab";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const { isOwner } = useAuth();
  const invoicingParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"business" | "team" | "availability" | "integrations" | "invoicing" | "data" | "tasks" | "messages">(
    gcalParam ? "integrations" : invoicingParam === "invoicing" ? "invoicing" : invoicingParam === "messages" ? "messages" : invoicingParam === "tasks" ? "tasks" : "business"
  );

  const tabs = [
    { id: "business" as const, label: "פרטי העסק", icon: Building2 },
    { id: "availability" as const, label: "זמינות", icon: Calendar },
    ...(isOwner ? [{ id: "team" as const, label: "ניהול צוות", icon: Users2 }] : []),
    { id: "invoicing" as const, label: "חשבוניות", icon: FileText },
    { id: "tasks" as const, label: "משימות אוטומטיות", icon: ListTodo },
    { id: "messages" as const, label: "הודעות ואוטומציות", icon: MessageCircle },
    { id: "data" as const, label: "נתונים", icon: Database },
    { id: "integrations" as const, label: "אינטגרציות", icon: Plug },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">הגדרות</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
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
            </button>
          );
        })}
      </div>

      {activeTab === "business" && <BusinessTab />}
      {activeTab === "availability" && <AvailabilityTab />}
      {activeTab === "team" && isOwner && <TeamTab />}
      {activeTab === "invoicing" && <InvoicingTab />}
      {activeTab === "tasks" && <TasksTab />}
      {activeTab === "messages" && <MessagesPanel />}
      {activeTab === "data" && <DataTab />}
      {activeTab === "integrations" && <IntegrationsTab />}
    </div>
  );
}
