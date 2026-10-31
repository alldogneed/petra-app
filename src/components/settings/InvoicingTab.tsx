"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plug, Loader2, XCircle, CheckCircle, FileText, Settings2, X } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";

// ─── Invoicing Tab ──────────────────────────────────────────────────────────

export function InvoicingTab() {
  const t = useTranslations("settings.invoicingTab");
  const { locale, currency } = useBusinessLocale();
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
      toast.success(t("toast.disconnected"));
    },
    onError: () => toast.error(t("toast.disconnectError")),
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
      mappingEntries = Object.entries(map).map(([m, dt]) => ({
        method: m,
        label: t.has(`paymentMethods.${m}`) ? t(`paymentMethods.${m}`) : m,
        docType: DOC_TYPE_KEYS[dt] ? t(`docTypes.${DOC_TYPE_KEYS[dt]}`) : String(dt),
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
              <h3 className="font-semibold text-petra-text">{t("status.title")}</h3>
              {isConnected ? (
                <span className="badge badge-success text-xs">{t("status.connected")}</span>
              ) : (
                <span className="badge badge-neutral text-xs">{t("status.notConnected")}</span>
              )}
            </div>
            {isConnected ? (
              <p className="text-sm text-petra-muted mt-0.5">
                {t("status.connectedTo", { provider: (settings?.providerName === "morning" ? t("morningName") : settings?.providerName) ?? "" })}
                {settings?.connectedAt && <>{t("status.connectedAgo", { time: formatRelativeTime(settings.connectedAt) })}</>}
              </p>
            ) : (
              <p className="text-sm text-petra-muted mt-0.5">
                {t("status.connectPrompt")}
              </p>
            )}
            {settings?.lastTestedAt && settings.lastTestResult && (
              <p className={cn("text-xs mt-1", settings.lastTestResult === "success" ? "text-emerald-600" : "text-red-500")}>
                {t("status.lastTest", { result: settings.lastTestResult === "success" ? t("status.testOk") : t("status.testFailed"), time: formatRelativeTime(settings.lastTestedAt) })}
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
                  {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("disconnect")}
                </button>
              </>
            ) : (
              <button
                className="btn-primary text-sm flex items-center gap-1.5"
                onClick={() => setShowConnectModal(true)}
              >
                <Plug className="w-4 h-4" />
                {t("status.connect")}
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
              <h3 className="font-semibold text-petra-text">{t("mapping.title")}</h3>
              <p className="text-sm text-petra-muted mt-0.5">{t("mapping.subtitle")}</p>
            </div>
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              onClick={() => setShowMappingModal(true)}
            >
              <Settings2 className="w-3.5 h-3.5" />
              {t("mapping.edit")}
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
            <p className="text-sm text-petra-muted">{t("mapping.defaultInUse")}</p>
          )}
        </div>
      )}

      {/* Recent Documents */}
      {isConnected && documents && documents.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-petra-text mb-3">{t("recent.title")}</h3>
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
                <div className="text-start">
                  <p className="text-sm font-medium text-petra-text">{currencySymbol({ locale, currency })}{doc.amount.toFixed(2)}</p>
                  <span className={cn("text-xs", doc.status === "issued" ? "text-emerald-600" : doc.status === "draft" ? "text-amber-600" : "text-petra-muted")}>
                    {doc.status === "issued" ? t("recent.statusIssued") : doc.status === "draft" ? t("recent.statusDraft") : doc.status}
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
          <h3 className="font-semibold text-petra-text mb-1">{t("empty.title")}</h3>
          <p className="text-sm text-petra-muted mb-4">{t("empty.body")}</p>
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setShowConnectModal(true)}
          >
            <Plug className="w-4 h-4" />
            {t("empty.connectNow")}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("confirmDisconnect.title")}
        description={t("confirmDisconnect.description")}
        confirmLabel={t("disconnect")}
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
  const t = useTranslations("settings.invoicingTab");
  const tc = useTranslations("common");
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
        if (!r.ok || !data.success) throw new Error(data.error || t("connectModal.testFailed"));
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
          throw new Error(data.error || t("saveFailed"));
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
            <h2 className="text-xl font-bold text-petra-text">{t("connectModal.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{t("connectModal.subtitle")}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t("connectModal.provider")}</label>
            <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="morning">{t("morningName")}</option>
            </select>
          </div>

          <div>
            <label className="label">API Key *</label>
            <input
              className="input"
              dir="ltr"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
              placeholder={t("connectModal.apiKeyPlaceholder")}
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
              placeholder={t("connectModal.apiSecretPlaceholder")}
            />
          </div>

          {testStatus === "success" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {t("connectModal.success")}
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
              {testMutation.isPending ? t("connectModal.testing") : t("connectModal.test")}
            </button>
          ) : (
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ background: "#10B981" }}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saveMutation.isPending ? tc("progress.saving") : t("connectModal.saveAndConnect")}
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Invoicing Document Mapping Modal ───────────────────────────────────────

// Labels: settings.invoicingTab.docTypes.<key>
const DOC_TYPE_KEYS: Record<number, string> = {
  305: "taxInvoice",
  320: "taxInvoiceReceipt",
  400: "receipt",
  330: "creditNote",
  0: "none",
};

const DOC_TYPE_OPTIONS = [
  { value: 320, labelKey: "taxInvoiceReceipt" },
  { value: 400, labelKey: "receipt" },
  { value: 305, labelKey: "taxInvoice" },
  { value: 0, labelKey: "none" },
];

// Labels: settings.invoicingTab.paymentMethods.<method>
const PAYMENT_METHODS = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"];

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
  const t = useTranslations("settings.invoicingTab");
  const tc = useTranslations("common");
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
        if (!r.ok) throw new Error(t("saveFailed"));
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
            <h2 className="text-xl font-bold text-petra-text">{t("mapping.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{t("mappingModal.subtitle")}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {PAYMENT_METHODS.map((method) => (
            <div key={method} className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-petra-text w-32">{t(`paymentMethods.${method}`)}</label>
              <select
                className="input flex-1"
                value={mapping[method] ?? 320}
                onChange={(e) => setMapping({ ...mapping, [method]: Number(e.target.value) })}
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(`docTypes.${opt.labelKey}`)}</option>
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
            {saveMutation.isPending ? tc("progress.saving") : tc("actions.save")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
