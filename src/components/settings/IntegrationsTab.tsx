"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { CheckCircle2, Zap, Plug, Calendar, MessageCircle, Mail, ExternalLink, Loader2, XCircle, CheckCircle, AlertCircle, FileText, Settings2, X, Eye, EyeOff, Copy, CreditCard, RefreshCw, Repeat } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useSearchParams } from "next/navigation";
import { cn, fetchJSON, copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { PaywallCard } from "@/components/paywall/PaywallCard";
import { WhatsAppConnectCard } from "@/components/settings/WhatsAppConnectCard";
import { Business } from "./shared";
import { InvoicingConnectModal, InvoicingMappingModal } from "./InvoicingTab";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReadOnlyNotice, SettingsFieldset } from "./settings-ui";
import { BUSINESS_SETTINGS_QUERY_KEY } from "@/hooks/useBusinessSettings";
const RepeatIcon = Repeat;

type DisconnectTarget = "gcal" | "stripe" | "invoicing";

const DISCONNECT_COPY: Record<DisconnectTarget, { title: string; description: string }> = {
  gcal: {
    title: "לנתק את Google Calendar?",
    description: "פגישות חדשות לא יסונכרנו יותר ליומן Google שלך. אירועים שכבר סונכרנו יישארו ביומן Google. אפשר לחבר מחדש בכל עת.",
  },
  stripe: {
    title: "לנתק את Stripe?",
    description: "מפתחות Stripe יימחקו מהעסק וקישורי תשלום בכרטיס אשראי יפסיקו לעבוד עד לחיבור מחדש.",
  },
  invoicing: {
    title: "לנתק את מערכת החשבוניות?",
    description: "הפקת חשבוניות וקבלות אוטומטית תיפסק עד לחיבור מחדש. מסמכים שכבר הופקו לא יימחקו.",
  },
};

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

export function IntegrationsTab() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { can } = usePlan();
  const { user } = useAuth();
  const perms = usePermissions();
  // PATCH /api/settings + lead-webhook key → SETTINGS_CRITICAL (owner, or member granted it).
  const canCriticalSettings = perms.canCriticalSettings;
  // Invoicing credentials (SETTINGS_WRITE), WhatsApp test → owner/manager (or platform admin).
  const canManageIntegrations = perms.isOwner || perms.isManager || user?.isAdmin === true;
  const [confirmDisconnect, setConfirmDisconnect] = useState<DisconnectTarget | null>(null);
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
    queryKey: BUSINESS_SETTINGS_QUERY_KEY,
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const updateReminderMutation = useMutation({
    mutationFn: async (data: { whatsappRemindersEnabled?: boolean; whatsappReminderLeadHours?: number }) => {
      if (!canCriticalSettings) throw new Error("אין לך הרשאה לשנות הגדרות עסק");
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "שמירה נכשלה");
      }
      return r.json();
    },
    onSuccess: (_res, vars) => {
      // Write the new value straight into the cache so the toggle reflects it
      // immediately and doesn't depend on a refetch (which previously returned
      // a stale HTTP-cached value and made the toggle snap back).
      queryClient.setQueryData<Business>(BUSINESS_SETTINGS_QUERY_KEY, (old) => old ? { ...old, ...vars } : old);
      queryClient.invalidateQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
      toast.success("הגדרות תזכורת עודכנו");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירה"),
  });

  const disconnectGcalMutation = useMutation({
    mutationFn: () =>
      fetch("/api/integrations/google/disconnect", { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.removeQueries({ queryKey: ["gcal-calendar-list"] });
      setConfirmDisconnect(null);
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

  // ── GCal calendar list (for overlay selection) ──
  const gcalConnected = integrations?.find((i) => i.id === "google-calendar")?.connected ?? false;

  const { data: gcalCalendarData, refetch: refetchCalendars } = useQuery<{
    calendars: { id: string; summary: string; backgroundColor: string; primary: boolean }[];
    selectedIds: string[];
  }>({
    queryKey: ["gcal-calendar-list"],
    queryFn: () => fetchJSON("/api/integrations/google/list-calendars"),
    enabled: gcalConnected,
    staleTime: 60_000,
  });

  const saveSelectedCalendarsMutation = useMutation({
    mutationFn: (calendars: { id: string; summary: string; backgroundColor: string }[]) =>
      fetch("/api/integrations/google/selected-calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendars }),
      }).then((r) => {
        if (!r.ok) throw new Error("save failed");
        return r.json();
      }),
    onSuccess: () => toast.success("יומנים לתצוגה עודכנו"),
    onError: () => toast.error("שגיאה בשמירת הגדרות יומן"),
  });

  const disconnectInvoicingMutation = useMutation({
    mutationFn: () =>
      fetch("/api/invoicing/settings", { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setConfirmDisconnect(null);
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
      setConfirmDisconnect(null);
      toast.success("Stripe נותק");
    },
    onError: () => toast.error("שגיאה בניתוק Stripe. נסה שוב."),
  });

  if (isLoading) return <PetraLoader />;

  const disconnectPending =
    disconnectGcalMutation.isPending || disconnectStripeMutation.isPending || disconnectInvoicingMutation.isPending;
  const runDisconnect = () => {
    if (confirmDisconnect === "gcal") disconnectGcalMutation.mutate();
    else if (confirmDisconnect === "stripe") disconnectStripeMutation.mutate();
    else if (confirmDisconnect === "invoicing") disconnectInvoicingMutation.mutate();
  };

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
          <React.Fragment key={integ.id}>
          <div className="card p-5 flex items-start gap-4">
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
              {isGcal && integ.connected && biz && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {/* Google Calendar overlay selector */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-petra-text font-medium">יומנים לתצוגה ביומן פטרה</span>
                      <button
                        onClick={() => refetchCalendars()}
                        className="text-xs text-petra-muted hover:text-petra-text"
                        title="רענן רשימת יומנים"
                      >
                        רענן
                      </button>
                    </div>
                    <p className="text-xs text-petra-muted">בחר יומנים מ-Google שיופיעו בצבע שקוף ביומן פטרה (read-only)</p>
                    {gcalCalendarData ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {gcalCalendarData.calendars.map((cal) => {
                          const isSelected = gcalCalendarData.selectedIds.includes(cal.id);
                          return (
                            <label key={cal.id} className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const current = gcalCalendarData.calendars.filter((c) =>
                                    gcalCalendarData.selectedIds.includes(c.id)
                                  );
                                  const updated = e.target.checked
                                    ? [...current, { id: cal.id, summary: cal.summary, backgroundColor: cal.backgroundColor }]
                                    : current.filter((c) => c.id !== cal.id);
                                  saveSelectedCalendarsMutation.mutate(updated, {
                                    onSuccess: () => refetchCalendars(),
                                  });
                                }}
                                className="rounded accent-orange-500 w-3.5 h-3.5 flex-shrink-0"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: cal.backgroundColor }}
                              />
                              <span className="text-xs text-petra-text group-hover:text-petra-primary truncate">
                                {cal.summary}
                                {cal.primary && <span className="text-petra-muted mr-1">(ראשי)</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <PetraLoader variant="inline" className="py-4" />
                    )}
                  </div>
                </div>
              )}
              {isWhatsApp && integ.connected && biz && can("whatsapp_reminders") && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {!canCriticalSettings && <ReadOnlyNotice className="text-xs px-3 py-2" />}
                  <SettingsFieldset readOnly={!canCriticalSettings} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-petra-text">תזכורות אוטומטיות לתורים</span>
                    {(() => {
                      const optimisticEnabled = updateReminderMutation.isPending
                        ? (updateReminderMutation.variables?.whatsappRemindersEnabled ?? biz.whatsappRemindersEnabled)
                        : biz.whatsappRemindersEnabled;
                      return (
                        <button
                          onClick={() => updateReminderMutation.mutate({ whatsappRemindersEnabled: !biz.whatsappRemindersEnabled })}
                          disabled={updateReminderMutation.isPending || !canCriticalSettings}
                          role="switch"
                          aria-checked={!!optimisticEnabled}
                          aria-label="תזכורות אוטומטיות לתורים"
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                            optimisticEnabled ? "bg-emerald-500" : "bg-slate-300"
                          )}
                          title={optimisticEnabled ? "כבה תזכורות" : "הפעל תזכורות"}
                        >
                          <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", optimisticEnabled ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                      );
                    })()}
                  </div>
                  {biz.whatsappRemindersEnabled && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-petra-muted">שלח שעות לפני התור</span>
                      <select
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-petra-text"
                        value={biz.whatsappReminderLeadHours}
                        onChange={(e) => updateReminderMutation.mutate({ whatsappReminderLeadHours: Number(e.target.value) })}
                        disabled={updateReminderMutation.isPending || !canCriticalSettings}
                        aria-label="שלח שעות לפני התור"
                      >
                        <option value={24}>24 שעות</option>
                        <option value={48}>48 שעות</option>
                        <option value={72}>72 שעות</option>
                        <option value={96}>96 שעות</option>
                      </select>
                    </div>
                  )}
                  </SettingsFieldset>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2 flex-wrap justify-end">
              {isStripe ? (
                !canCriticalSettings ? (
                  <span className="text-xs text-petra-muted">בעלים בלבד</span>
                ) : integ.connected ? (
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
                      onClick={() => setConfirmDisconnect("stripe")}
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
                !canManageIntegrations ? (
                  <span className="text-xs text-petra-muted">בעלים ומנהלים בלבד</span>
                ) : integ.connected ? (
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
                      onClick={() => setConfirmDisconnect("invoicing")}
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
                    onClick={() => setConfirmDisconnect("gcal")}
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
              ) : isWhatsApp && canManageIntegrations ? (
                <button
                  className="btn-secondary text-sm flex items-center gap-1.5"
                  onClick={() => setShowWhatsAppTestModal(true)}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {integ.connected ? "בדיקת חיבור" : user?.isAdmin ? "בדיקת Stub" : "בדיקת חיבור"}
                </button>
              ) : isWhatsApp ? null : (
                <span className="text-xs text-petra-muted">בקרוב</span>
              )}
            </div>
          </div>
          {/* Per-business WhatsApp number (Meta Embedded Signup + coexistence) */}
          {isWhatsApp && <WhatsAppConnectCard />}
          </React.Fragment>
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

      <ConfirmDialog
        open={confirmDisconnect !== null}
        title={confirmDisconnect ? DISCONNECT_COPY[confirmDisconnect].title : ""}
        description={confirmDisconnect ? DISCONNECT_COPY[confirmDisconnect].description : undefined}
        confirmLabel="נתק"
        danger
        loading={disconnectPending}
        onConfirm={runDisconnect}
        onCancel={() => { if (!disconnectPending) setConfirmDisconnect(null); }}
      />

      {showWhatsAppTestModal && (
        <WhatsAppTestModal onClose={() => setShowWhatsAppTestModal(false)} />
      )}

      {/* ── Make.com Webhook ── */}
      {can('webhook_leads') ? (
        canCriticalSettings ? (
          <MakeWebhookCard />
        ) : (
          <div className="card p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-petra-text">חיבור לידים מהאתר</h3>
              <p className="text-sm text-petra-muted mt-0.5">
                ניהול כתובת ה-Webhook ומפתח ה-API זמין רק לבעלי העסק, או למי שקיבל ממנו את ההרשאה &quot;לשנות הגדרות עסק&quot;.
              </p>
            </div>
          </div>
        )
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
        <div className="flex gap-2 min-w-0">
          <input
            readOnly
            value={webhookUrl}
            dir="ltr"
            className="input flex-1 min-w-0 font-mono text-sm bg-slate-50 select-all"
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
          <button
            className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
            // Replacing an existing key breaks the live website form → confirm first.
            // The very first key has nothing to break, so it's created directly.
            onClick={() => (hasKey ? setConfirmRegen(true) : regenMutation.mutate())}
            disabled={regenMutation.isPending}
          >
            {regenMutation.isPending && !confirmRegen ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {hasKey ? "צור מפתח חדש" : "צור מפתח"}
          </button>
        </div>
        <ConfirmDialog
          open={confirmRegen}
          title="ליצור מפתח API חדש?"
          description="המפתח הנוכחי יפסיק לעבוד מיד. טפסים באתר, ב-Make או בכל חיבור אחר שמשתמשים בו יפסיקו ליצור לידים עד שתעדכנו בהם את המפתח החדש."
          confirmLabel="צור מפתח חדש"
          danger
          loading={regenMutation.isPending}
          onConfirm={() => regenMutation.mutate()}
          onCancel={() => setConfirmRegen(false)}
        />

        {keyLoading ? (
          <PetraLoader variant="inline" className="py-4" />
        ) : hasKey ? (
          <div className="flex gap-2 min-w-0">
            <input
              readOnly
              type={showKey ? "text" : "password"}
              value={currentKey}
              dir="ltr"
              className="input flex-1 min-w-0 font-mono text-sm bg-slate-50 select-all"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
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
