"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plug, Loader2, XCircle, CheckCircle, FileText, Settings2, X } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ─── Invoicing Tab ──────────────────────────────────────────────────────────

export function InvoicingTab() {
  const queryClient = useQueryClient();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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
      setConfirmDisconnect(false);
      toast.success("מערכת החשבוניות נותקה");
    },
    onError: () => toast.error("שגיאה בניתוק. נסה שוב."),
  });

  const isConnected = settings?.status === "active";

  if (isLoading) {
    return <PetraLoader />;
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
                  onClick={() => setConfirmDisconnect(true)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

      <ConfirmDialog
        open={confirmDisconnect}
        title="לנתק את מערכת החשבוניות?"
        description="הפקת חשבוניות וקבלות אוטומטית תיפסק עד לחיבור מחדש. מסמכים שכבר הופקו לא יימחקו."
        confirmLabel="נתק"
        danger
        loading={disconnectMutation.isPending}
        onConfirm={() => disconnectMutation.mutate()}
        onCancel={() => setConfirmDisconnect(false)}
      />

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

export function InvoicingConnectModal({
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

export function InvoicingMappingModal({
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
