"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { CheckCircle2, Zap, Plug, Calendar, MessageCircle, Mail, ExternalLink, Loader2, XCircle, CheckCircle, AlertCircle, FileText, Settings2, X, Eye, EyeOff, Copy, CreditCard, RefreshCw, Repeat, Lock } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useSearchParams } from "next/navigation";
import { cn, fetchJSON, copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { PaywallCard } from "@/components/paywall/PaywallCard";
import { WhatsAppConnectCard } from "@/components/settings/WhatsAppConnectCard";
import { GoogleContactsSyncRow } from "@/components/settings/GoogleContactsSyncRow";
import { Business } from "./shared";
import { InvoicingConnectModal, InvoicingMappingModal } from "./InvoicingTab";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReadOnlyNotice, SettingsFieldset } from "./settings-ui";
import { BUSINESS_SETTINGS_QUERY_KEY } from "@/hooks/useBusinessSettings";
const RepeatIcon = Repeat;

type DisconnectTarget = "gcal" | "stripe" | "invoicing";

// Titles/descriptions: settings.integrationsTab.disconnect.<target>.{title,description}

// Currencies offered for Stripe (values sent to the API).
const STRIPE_CURRENCIES = ["ILS", "USD", "EUR"]; // i18n-ok

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
  const t = useTranslations("settings.integrationsTab");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { can } = usePlan();
  const { user } = useAuth();
  const perms = usePermissions();
  // PATCH /api/settings + lead-webhook key → SETTINGS_CRITICAL (owner, or member granted it).
  const canCriticalSettings = perms.canCriticalSettings;
  // Invoicing credentials (SETTINGS_WRITE), WhatsApp test → owner/manager (or platform admin).
  const canManageIntegrations = perms.isOwner || perms.isManager || user?.isAdmin === true;
  // CALENDAR_SYNC — business bookings pushed into this member's own Google Calendar
  // (POST /api/integrations/google/sync + automatic push). Connecting stays allowed:
  // the connection also powers busy-time blocking.
  const canSyncCalendar = perms.canSyncCalendar;
  const [confirmDisconnect, setConfirmDisconnect] = useState<DisconnectTarget | null>(null);
  const gcalStatus = searchParams.get("gcal");
  const gcontactsStatus = searchParams.get("gcontacts");
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
      if (!canCriticalSettings) throw new Error(t("reminders.noPermission"));
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || t("reminders.saveFailed"));
      }
      return r.json();
    },
    onSuccess: (_res, vars) => {
      // Write the new value straight into the cache so the toggle reflects it
      // immediately and doesn't depend on a refetch (which previously returned
      // a stale HTTP-cached value and made the toggle snap back).
      queryClient.setQueryData<Business>(BUSINESS_SETTINGS_QUERY_KEY, (old) => old ? { ...old, ...vars } : old);
      queryClient.invalidateQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
      toast.success(t("reminders.updated"));
    },
    onError: (e: Error) => toast.error(e.message || t("reminders.saveError")),
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
      toast.success(t("gcal.disconnected"));
    },
    onError: () => toast.error(t("gcal.disconnectError")),
  });

  const syncGcalMutation = useMutation({
    mutationFn: () => {
      if (!canSyncCalendar) return Promise.reject(new Error(t("gcal.ownerNotApproved")));
      return fetch("/api/integrations/google/sync", { method: "POST" }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((typeof data?.error === "string" && data.error) || t("gcal.syncError"));
        return data;
      });
    },
    onSuccess: (data) => {
      toast.success(data.message || t("gcal.syncDone"));
    },
    onError: (err: Error) => toast.error(err.message || t("gcal.syncErrorRetry")),
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
    onSuccess: () => toast.success(t("gcal.calendarsSaved")),
    onError: () => toast.error(t("gcal.calendarsSaveError")),
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
      toast.success(t("invoicing.disconnected"));
    },
    onError: () => toast.error(t("invoicing.disconnectError")),
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
      toast.success(t("stripe.disconnected"));
    },
    onError: () => toast.error(t("stripe.disconnectError")),
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
          {t("banners.gcalConnected")}
        </div>
      )}
      {gcalStatus === "denied" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {t("banners.gcalDenied")}
        </div>
      )}
      {gcontactsStatus === "connected" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {t("banners.gcontactsConnected")}
        </div>
      )}
      {gcontactsStatus === "denied" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {t("banners.gcontactsDenied")}
        </div>
      )}
      {gcalStatus === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {t("banners.gcalError")}
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
          <div className="card p-5 flex flex-wrap sm:flex-nowrap items-start gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", integ.connected ? "bg-emerald-50" : "bg-slate-100")}>
              <Icon className={cn("w-6 h-6", integ.connected ? "text-emerald-600" : "text-slate-400")} />
            </div>
            <div className="flex-1 min-w-[calc(100%-4rem)] sm:min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-petra-text">{integ.name}</h3>
                {integ.connected ? (
                  <span className="badge badge-success text-xs">{t("card.connected")}</span>
                ) : (
                  <span className="badge badge-neutral text-xs">{t("card.notConnected")}</span>
                )}
              </div>
              <p className="text-sm text-petra-muted mt-0.5">{integ.description}</p>
              {integ.connected && integ.connectedEmail && (
                <p className="text-xs text-emerald-600 mt-1">{integ.connectedEmail}</p>
              )}
              {isGcal && !canSyncCalendar && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  {t("gcal.ownerNotApproved")}
                </p>
              )}
              {isStripe && integ.connected && integ.accountId && (
                <p className="text-xs text-emerald-600 mt-1">Account: {integ.accountId}</p>
              )}
              {isGcal && integ.connected && biz && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {/* Google Calendar overlay selector */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-petra-text font-medium">{t("gcal.overlayTitle")}</span>
                      <button
                        onClick={() => refetchCalendars()}
                        className="text-xs text-petra-muted hover:text-petra-text"
                        title={t("gcal.refreshTitle")}
                      >
                        {t("gcal.refresh")}
                      </button>
                    </div>
                    <p className="text-xs text-petra-muted">{t("gcal.overlayHint")}</p>
                    {gcalCalendarData ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto ps-1">
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
                                {cal.primary && <span className="text-petra-muted ms-1">{t("gcal.primary")}</span>}
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
              {isGcal && integ.connected && <GoogleContactsSyncRow />}
              {isWhatsApp && integ.connected && biz && can("whatsapp_reminders") && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {!canCriticalSettings && <ReadOnlyNotice className="text-xs px-3 py-2" />}
                  <SettingsFieldset readOnly={!canCriticalSettings} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-petra-text">{t("reminders.autoReminders")}</span>
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
                          aria-label={t("reminders.autoReminders")}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                            optimisticEnabled ? "bg-emerald-500" : "bg-slate-300"
                          )}
                          title={optimisticEnabled ? t("reminders.turnOff") : t("reminders.turnOn")}
                        >
                          <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", optimisticEnabled ? "-translate-x-4 ltr:translate-x-4" : "-translate-x-0.5 ltr:translate-x-0.5")} />
                        </button>
                      );
                    })()}
                  </div>
                  {biz.whatsappRemindersEnabled && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-petra-muted">{t("reminders.hoursBefore")}</span>
                      <select
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-petra-text"
                        value={biz.whatsappReminderLeadHours}
                        onChange={(e) => updateReminderMutation.mutate({ whatsappReminderLeadHours: Number(e.target.value) })}
                        disabled={updateReminderMutation.isPending || !canCriticalSettings}
                        aria-label={t("reminders.hoursBefore")}
                      >
                        <option value={24}>{t("reminders.hours24")}</option>
                        <option value={48}>{t("reminders.hours48")}</option>
                        <option value={72}>{t("reminders.hours72")}</option>
                        <option value={96}>{t("reminders.hours96")}</option>
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
                  <span className="text-xs text-petra-muted">{t("card.ownerOnly")}</span>
                ) : integ.connected ? (
                  <>
                    <button
                      className="btn-ghost text-sm flex items-center gap-1.5"
                      onClick={() => setShowStripeModal(true)}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      {t("card.update")}
                    </button>
                    <button
                      className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDisconnect("stripe")}
                      disabled={disconnectStripeMutation.isPending}
                    >
                      {disconnectStripeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("card.disconnect")}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary text-sm flex items-center gap-1.5"
                    onClick={() => setShowStripeModal(true)}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    {t("card.connect")}
                  </button>
                )
              ) : isInvoicing ? (
                !canManageIntegrations ? (
                  <span className="text-xs text-petra-muted">{t("card.ownersManagersOnly")}</span>
                ) : integ.connected ? (
                  <>
                    <button
                      className="btn-ghost text-sm flex items-center gap-1.5"
                      onClick={() => setShowMappingModal(true)}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      {t("card.settings")}
                    </button>
                    <button
                      className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDisconnect("invoicing")}
                      disabled={disconnectInvoicingMutation.isPending}
                    >
                      {disconnectInvoicingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("card.disconnect")}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary text-sm flex items-center gap-1.5"
                    onClick={() => setShowInvoicingModal(true)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t("card.connect")}
                  </button>
                )
              ) : isGcal && integ.connected && integ.disconnectUrl ? (
                <>
                  {canSyncCalendar && (
                  <button
                    className="btn-secondary text-sm flex items-center gap-1.5"
                    onClick={() => syncGcalMutation.mutate()}
                    disabled={syncGcalMutation.isPending}
                    title={t("gcal.syncNowTitle")}
                  >
                    {syncGcalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RepeatIcon className="w-3.5 h-3.5" />}
                    {t("gcal.syncNow")}
                  </button>
                  )}
                  <button
                    className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setConfirmDisconnect("gcal")}
                    disabled={disconnectGcalMutation.isPending}
                  >
                    {disconnectGcalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("card.disconnect")}
                  </button>
                </>
              ) : integ.connectUrl ? (
                <a href={integ.connectUrl} className="btn-primary text-sm flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("card.connect")}
                </a>
              ) : isWhatsApp && canManageIntegrations ? (
                <button
                  className="btn-secondary text-sm flex items-center gap-1.5"
                  onClick={() => setShowWhatsAppTestModal(true)}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {integ.connected ? t("card.testConnection") : user?.isAdmin ? t("card.testStub") : t("card.testConnection")}
                </button>
              ) : isWhatsApp ? null : (
                <span className="text-xs text-petra-muted">{t("card.comingSoon")}</span>
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
        title={confirmDisconnect ? t(`disconnect.${confirmDisconnect}.title`) : ""}
        description={confirmDisconnect ? t(`disconnect.${confirmDisconnect}.description`) : undefined}
        confirmLabel={t("card.disconnect")}
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
              <h3 className="font-semibold text-petra-text">{t("webhookLocked.title")}</h3>
              <p className="text-sm text-petra-muted mt-0.5">
                {t("webhookLocked.body")}
              </p>
            </div>
          </div>
        )
      ) : (
        <PaywallCard
          title={t("paywall.title")}
          description={t("paywall.description")}
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
  const ts = useTranslations("settings.integrationsTab.stripeModal");
  const tc = useTranslations("common");
  const { currency: businessCurrency } = useBusinessLocale();
  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [currency, setCurrency] = useState(
    STRIPE_CURRENCIES.includes(businessCurrency) ? businessCurrency : STRIPE_CURRENCIES[0]
  );
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!publishableKey.trim() || !secretKey.trim()) {
      setError(ts("keysRequired"));
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
        setError(data.error || ts("connectError"));
        return;
      }
      toast.success(ts("connected"));
      onSuccess();
    } catch {
      setError(ts("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-petra-text">{ts("title")}</h2>
              <p className="text-sm text-petra-muted mt-0.5">{ts("subtitle")}</p>
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
            <p className="font-medium mb-1">{ts("howTitle")}</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>{ts.rich("step1", { b: (c) => <strong>{c}</strong> })}</li>
              <li>{ts.rich("step2", { b: (c) => <strong>{c}</strong> })}</li>
              <li>{ts("step3")}</li>
              <li>{ts.rich("step4", { b: (c) => <strong>{c}</strong> })}</li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <label className="label">Publishable Key (pk_...)</label>
            <input
              className="input w-full font-mono text-sm"
              placeholder={ts("publishablePlaceholder")}
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label className="label">Secret Key (sk_...)</label>
            <div className="relative">
              <input
                className={"input w-full font-mono text-sm pl-10" /* rtl-ok: input is dir="ltr" */}
                placeholder={ts("secretPlaceholder")}
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                dir="ltr"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label">{ts("webhookLabel")}</label>
            <div className="relative">
              <input
                className={"input w-full font-mono text-sm pl-10" /* rtl-ok: input is dir="ltr" */}
                placeholder={ts("webhookPlaceholder")}
                type={showWebhook ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                dir="ltr"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
                onClick={() => setShowWebhook((v) => !v)}
              >
                {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-petra-muted">
              {ts("webhookUrlHint")}{" "}
              <span className="font-mono bg-slate-100 px-1 rounded text-xs" dir="ltr">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="label">{ts("currency")}</label>
            <select
              className="input w-full"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {STRIPE_CURRENCIES.map((c) => (
                <option key={c} value={c}>{ts(`currencies.${c}`)}</option>
              ))}
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
          <button onClick={onClose} className="btn-secondary">{tc("actions.cancel")}</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {loading ? ts("saving") : ts("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp Test Modal ─────────────────────────────────────────────────────

function WhatsAppTestModal({ onClose }: { onClose: () => void }) {
  const tw = useTranslations("settings.integrationsTab.whatsappTest");
  const tc = useTranslations("common");
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
        setResult({ success: false, error: data.error || tw("sendError") });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ success: false, error: tw("networkError") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-petra-text">{tw("title")}</h2>
              <p className="text-sm text-petra-muted mt-0.5">{tw("subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label">{tw("phoneLabel")}</label>
            <input
              className="input w-full"
              placeholder="05X-XXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <p className="text-xs text-petra-muted mt-1">{tw("phoneHint")}</p>
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
              <span>{result.success ? (result.message ?? tw("success")) : result.error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">{tc("actions.close")}</button>
          <button
            onClick={handleTest}
            disabled={loading || !phone.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {loading ? tw("sending") : tw("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Webhook Integration Card ─────────────────────────────────────────────────

function MakeWebhookCard() {
  const tWeb = useTranslations("settings.integrationsTab.webhook");
  const tCard = useTranslations("settings.integrationsTab.card");
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
      toast.success(tWeb("keyCreated"));
    },
    onError: () => toast.error(tWeb("keyError")),
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
            <h3 className="font-semibold text-petra-text">{tWeb("title")}</h3>
            <span className={cn("badge text-xs", hasKey ? "badge-success" : "badge-neutral")}>
              {hasKey ? tCard("connected") : tWeb("notConfigured")}
            </span>
          </div>
          <p className="text-sm text-petra-muted mt-0.5">
            {tWeb("description")}
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
            {copiedUrl ? tWeb("copied") : tWeb("copy")}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="label text-xs">{tWeb("apiKey")}</label>
          <button
            className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
            // Replacing an existing key breaks the live website form → confirm first.
            // The very first key has nothing to break, so it's created directly.
            onClick={() => (hasKey ? setConfirmRegen(true) : regenMutation.mutate())}
            disabled={regenMutation.isPending}
          >
            {regenMutation.isPending && !confirmRegen ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {hasKey ? tWeb("newKey") : tWeb("createKey")}
          </button>
        </div>
        <ConfirmDialog
          open={confirmRegen}
          title={tWeb("regenTitle")}
          description={tWeb("regenDescription")}
          confirmLabel={tWeb("newKey")}
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
            <button className="btn-ghost flex-shrink-0" onClick={() => setShowKey((v) => !v)} title={showKey ? tWeb("hide") : tWeb("show")}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0"
              onClick={() => copy(currentKey, setCopiedKey)}
            >
              {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedKey ? tWeb("copied") : tWeb("copy")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{tWeb("noKey")}</span>
          </div>
        )}
      </div>

      {/* Code snippet */}
      {hasKey && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="label text-xs">{tWeb("codeLabel")}</label>
            <button
              className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
              onClick={() => copy(codeSnippet, setCopiedCode)}
            >
              {copiedCode ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copiedCode ? tWeb("copied") : tWeb("copyCode")}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed" dir="ltr">
            {codeSnippet}
          </pre>
        </div>
      )}

      {/* Fields reference */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-petra-muted space-y-2">
        <p className="font-medium text-petra-text text-sm">{tWeb("fieldsTitle")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {[
            "firstName",
            "lastName",
            "fullName",
            "phone",
            "email",
            "city",
            "breed",
            "service",
            "petName",
            "notes",
            "source",
          ].map((field) => (
            <div key={field} className="flex gap-2">
              <code className="text-violet-600 font-mono">{field}</code>
              <span>{tWeb(`fields.${field}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
