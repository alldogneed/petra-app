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
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
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
    },
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
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  "message-circle": MessageCircle,
  mail: Mail,
  "file-text": FileText,
};

function IntegrationsTab() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const gcalStatus = searchParams.get("gcal");
  const [showInvoicingModal, setShowInvoicingModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);

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
    },
  });

  const disconnectInvoicingMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings", { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
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
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {isInvoicing ? (
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
                <button
                  className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => disconnectGcalMutation.mutate()}
                  disabled={disconnectGcalMutation.isPending}
                >
                  {disconnectGcalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נתק"}
                </button>
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members"] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members"] }),
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

// ─── Main Settings Page ──────────────────────────────────────────────────────

import AvailabilityTab from "./availability-tab";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const { isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<"business" | "team" | "availability" | "integrations" | "data">(
    gcalParam ? "integrations" : "business"
  );

  const tabs = [
    { id: "business" as const, label: "פרטי העסק", icon: Building2 },
    { id: "availability" as const, label: "זמינות", icon: Calendar },
    ...(isOwner ? [{ id: "team" as const, label: "ניהול צוות", icon: Users2 }] : []),
    { id: "data" as const, label: "נתונים", icon: Database },
    { id: "integrations" as const, label: "אינטגרציות", icon: Plug },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">הגדרות</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto">
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
      {activeTab === "data" && <DataTab />}
      {activeTab === "integrations" && <IntegrationsTab />}
    </div>
  );
}
