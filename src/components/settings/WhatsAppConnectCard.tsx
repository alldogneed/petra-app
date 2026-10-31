"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle, CheckCircle2, AlertTriangle, RefreshCw, Unplug, Loader2, Send, Info,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { TierGate } from "@/components/paywall/TierGate";
import type { WaConnectionStatus } from "@/lib/whatsapp-connections";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/providers/auth-provider";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const FB_SDK_ID = "facebook-jssdk";
const FB_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const FB_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const META_ES_CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

let sdkPromise: Promise<void> | null = null;
function loadFbSdkOnce(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.FB) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    if (document.getElementById(FB_SDK_ID)) return;
    const s = document.createElement("script");
    s.id = FB_SDK_ID;
    s.src = FB_SDK_SRC;
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => {
      // Remove the failed tag so a retry can inject a fresh one (FB CDN occasionally 503s).
      s.remove();
      sdkPromise = null;
      reject(new Error("sdk load failed"));
    };
    document.body.appendChild(s);
  });
  return sdkPromise;
}

/** Load the FB SDK with retries — connect.facebook.net intermittently returns 503. */
async function ensureFbSdk(): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await loadFbSdkOnce();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("sdk load failed");
}

// Labels: settings.whatsAppConnectCard.templateStatus.<key> / .quality.<key>
const TEMPLATE_STATUS: Record<string, { cls: string }> = {
  APPROVED: { cls: "badge-success" },
  PENDING: { cls: "badge-warning" },
  REJECTED: { cls: "badge-danger" },
};
const QUALITY: Record<string, { cls: string }> = {
  GREEN: { cls: "badge-success" },
  YELLOW: { cls: "badge-warning" },
  RED: { cls: "badge-danger" },
};
const shortDate = (iso: string | null, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

type SignupData = { phoneNumberId: string; wabaId: string };

export function WhatsAppConnectCard() {
  const t = useTranslations("settings.whatsAppConnectCard");
  const { locale } = useBusinessLocale();
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const { user } = useAuth();
  // connect / disconnect / sync-templates / test → owner or manager of the business, or platform admin.
  const canManage = perms.isOwner || perms.isManager || user?.isAdmin === true;
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [coexistence, setCoexistence] = useState(true);
  const [launching, setLaunching] = useState(false);
  // Diagnostic trail — every postMessage from Meta + the FB.login callback, shown on
  // screen so a stuck signup can be diagnosed without opening devtools.
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const pushDebug = useCallback((line: string) => {
    const time = new Date().toLocaleTimeString(locale, { hour12: false });
    setDebugLog((prev) => [...prev.slice(-14), `${time}  ${line}`]);
  }, [locale]);
  const [awaitingMeta, setAwaitingMeta] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const codeRef = useRef<string | null>(null);
  const signupRef = useRef<SignupData | null>(null);
  const coexistenceRef = useRef(true);
  coexistenceRef.current = coexistence;

  const { data: status, isLoading } = useQuery<WaConnectionStatus>({
    queryKey: ["whatsapp-connection"],
    queryFn: () => fetchJSON<WaConnectionStatus>("/api/integrations/whatsapp/connection"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
  };
  const resetFlow = useCallback(() => {
    codeRef.current = null;
    signupRef.current = null;
    setLaunching(false);
    setAwaitingMeta(false);
  }, []);

  const connectMutation = useMutation({
    mutationFn: (body: SignupData & { code: string; coexistence: boolean }) =>
      fetchJSON<WaConnectionStatus>("/api/integrations/whatsapp/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => { invalidate(); toast.success(t("toasts.connected")); },
    onError: (err: Error) => toast.error(err.message || t("toasts.connectFailed")),
    onSettled: resetFlow,
  });
  const syncMutation = useMutation({
    mutationFn: () => fetchJSON<WaConnectionStatus>("/api/integrations/whatsapp/connection/sync-templates", { method: "POST" }),
    onSuccess: () => { invalidate(); toast.success(t("toasts.templatesSynced")); },
    onError: (err: Error) => toast.error(err.message || t("toasts.syncFailed")),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => fetchJSON<{ ok: boolean }>("/api/integrations/whatsapp/connection", { method: "DELETE" }),
    onSuccess: () => { invalidate(); setConfirmDisconnect(false); toast.success(t("toasts.disconnected")); },
    onError: (err: Error) => toast.error(err.message || t("toasts.disconnectFailed")),
  });
  const testMutation = useMutation({
    mutationFn: (phone: string) =>
      fetchJSON<{ success: boolean; message?: string }>("/api/integrations/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }),
    onSuccess: (d) => toast.success(d.message || t("toasts.testSent")),
    onError: (err: Error) => toast.error(err.message || t("toasts.testFailed")),
  });

  // Fire the connect POST once BOTH the login code and the signup payload are present
  // (the Meta message event and the FB.login callback may arrive in either order).
  const tryConnect = useCallback(() => {
    const code = codeRef.current;
    const data = signupRef.current;
    if (!code || !data) return;
    connectMutation.mutate({ code, ...data, coexistence: coexistenceRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload the FB SDK ahead of the click: FB.login must run INSIDE the click's user
  // gesture or Chrome blocks the popup silently (spinner stuck, no window).
  useEffect(() => {
    if (!status?.signupAvailable || !status?.betaAccess || !META_APP_ID) return;
    ensureFbSdk().catch(() => { /* surfaced again on click */ });
  }, [status?.signupAvailable, status?.betaAccess]);

  useEffect(() => {
    if (!status?.signupAvailable) return;
    const onMessage = (event: MessageEvent) => {
      // Log anything Facebook sends, even shapes we don't act on — a silent signup
      // usually means Meta posted something other than the expected FINISH.
      if (FB_ORIGINS.has(event.origin)) {
        const raw = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
        pushDebug(t("debug.fromMeta", { raw: String(raw).slice(0, 300) }));
      }
      if (!FB_ORIGINS.has(event.origin) || typeof event.data !== "string") return;
      let msg: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg || msg.type !== "WA_EMBEDDED_SIGNUP") return;
      if (msg.event === "FINISH" || msg.event === "FINISH_ONLY_WABA") {
        const phoneNumberId = msg.data?.phone_number_id;
        const wabaId = msg.data?.waba_id;
        if (!phoneNumberId || !wabaId) {
          toast.error(t("flow.noPhone"));
          resetFlow();
          return;
        }
        signupRef.current = { phoneNumberId: String(phoneNumberId), wabaId: String(wabaId) };
        setAwaitingMeta(false);
        tryConnect();
      } else if (msg.event === "CANCEL") {
        toast.error(msg.data?.current_step ? t("flow.canceledAtStep", { step: String(msg.data.current_step) }) : t("flow.canceled"));
        resetFlow();
      } else if (msg.event === "ERROR") {
        toast.error(msg.data?.error_message || t("flow.metaError"));
        resetFlow();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [status?.signupAvailable, resetFlow, tryConnect, pushDebug, t]);

  const launchSignup = () => {
    if (!META_APP_ID || !META_ES_CONFIG_ID) { toast.error(t("flow.notConfigured")); return; }
    // No awaits before FB.login — the popup must open inside the click's user gesture,
    // otherwise Chrome's popup blocker eats it silently.
    if (!window.FB) {
      setLaunching(true);
      ensureFbSdk()
        .then(() => { setLaunching(false); toast.info(t("flow.sdkReady")); })
        .catch(() => { setLaunching(false); toast.error(t("flow.sdkLoadFailed")); });
      return;
    }
    setLaunching(true);
    codeRef.current = null;
    signupRef.current = null;
    setDebugLog([]);
    pushDebug(t("debug.windowOpened", { config: String(META_ES_CONFIG_ID), coexistence: coexistenceRef.current ? t("debug.yes") : t("debug.no") }));
    setAwaitingMeta(true);
    window.FB.login(
      (response: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
          pushDebug(t("debug.loginResponse", { json: JSON.stringify({ status: response?.status, hasCode: !!response?.authResponse?.code, keys: response ? Object.keys(response) : null, authKeys: response?.authResponse ? Object.keys(response.authResponse) : null }) }));
        } catch { pushDebug(t("debug.loginResponseUnreadable")); }
        const code: string | undefined = response?.authResponse?.code;
        if (!code) {
          toast.error(t("flow.loginIncomplete"));
          resetFlow();
          return;
        }
        codeRef.current = code;
        tryConnect();
      },
      {
        config_id: META_ES_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: coexistenceRef.current ? "whatsapp_business_app_onboarding" : "",
          sessionInfoVersion: "3",
        },
      }
    );
  };

  const busy = launching || awaitingMeta || connectMutation.isPending;

  /* ── Render ──────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="card p-5">
        <PetraLoader variant="inline" />
      </div>
    );
  }
  if (!status) return null;

  const disconnectDialog = (
    <ConfirmDialog
      open={confirmDisconnect}
      title={t("disconnectDialog.title")}
      description={t("disconnectDialog.description")}
      confirmLabel={t("actions.disconnect")}
      danger
      loading={disconnectMutation.isPending}
      onConfirm={() => disconnectMutation.mutate()}
      onCancel={() => setConfirmDisconnect(false)}
    />
  );
  const readOnlyNote = (
    <p className="text-xs text-petra-muted">{t("readOnlyNote")}</p>
  );

  const header = (
    <div className="flex items-start gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", status.status === "active" ? "bg-emerald-50" : "bg-slate-100")}>
        <MessageCircle className={cn("w-5 h-5", status.status === "active" ? "text-emerald-600" : "text-slate-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-petra-text">{t("header.title")}</h3>
        <p className="text-sm text-petra-muted mt-0.5">{t("header.subtitle")}</p>
      </div>
    </div>
  );

  // Private beta: hide the card entirely for non-allowlisted users (an existing
  // connection is still shown so it can be managed/disconnected).
  if (!status.betaAccess && status.status === "none") return null;

  // Not configured on this deployment
  if (!status.signupAvailable) {
    return (
      <div className="card p-5 space-y-3">
        {header}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t("comingSoon.title")}</p>
            <p className="text-xs mt-0.5">{t("comingSoon.body")}</p>
          </div>
        </div>
      </div>
    );
  }

  const coexistenceToggle = (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className="mt-1 w-4 h-4 accent-emerald-600"
        checked={coexistence}
        onChange={(e) => setCoexistence(e.target.checked)}
        disabled={busy}
      />
      <span className="text-sm text-petra-text">
        {t("coexistence.label")}
        <span className="block text-xs text-petra-muted mt-0.5">{t("coexistence.hint")}</span>
      </span>
    </label>
  );

  const connectButton = (label: string) => (
    <button onClick={launchSignup} disabled={busy} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
      {connectMutation.isPending ? t("connect.connecting") : awaitingMeta ? t("connect.awaitingMeta") : label}
    </button>
  );
  const cancelLink = awaitingMeta && !connectMutation.isPending && (
    <button onClick={resetFlow} className="text-xs text-petra-muted underline">{t("connect.cancel")}</button>
  );

  // On-screen trail of what Meta sent back. Only appears once a signup was attempted,
  // so a stuck flow can be diagnosed (and screenshotted) without devtools.
  const debugPanel = debugLog.length > 0 && (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-xs font-semibold text-petra-text">{t("debug.title")}</p>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(debugLog.join("\n")); toast.success(t("debug.copied")); }}
          className="text-[11px] text-petra-muted underline"
        >
          {t("debug.copy")}
        </button>
      </div>
      <div dir="ltr" className="text-left font-mono text-[11px] leading-relaxed text-slate-700 space-y-0.5 max-h-48 overflow-auto">
        {debugLog.map((line, i) => (<div key={i} className="break-all">{line}</div>))}
      </div>
      <p className="text-[11px] text-petra-muted mt-1.5">{t("debug.hint")}</p>
    </div>
  );

  // Error
  if (status.status === "error") {
    return (
      <div className="card p-5 space-y-4">
        {header}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{status.displayPhone != null ? t("error.title", { phone: status.displayPhone }) : t("error.titleNoPhone")}</p>
            {status.lastError && <p className="text-xs mt-0.5 break-words">{status.lastError}</p>}
            <p className="text-xs mt-0.5">{t("error.fallbackNote")}</p>
          </div>
        </div>
        {canManage ? (
          <TierGate feature="whatsapp_reminders" title={t("tierGate.title")} description={t("tierGate.description")}>
            <div className="space-y-3">
              {coexistenceToggle}
              <div className="flex flex-wrap items-center gap-3">
                {connectButton(t("connect.reconnect"))}
                <button onClick={() => setConfirmDisconnect(true)} disabled={disconnectMutation.isPending} className="btn-danger text-sm flex items-center gap-1.5">
                  {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />} {t("actions.disconnect")}
                </button>
                {cancelLink}
              </div>
              {debugPanel}
            </div>
          </TierGate>
        ) : readOnlyNote}
        {disconnectDialog}
      </div>
    );
  }

  // Active
  if (status.status === "active") {
    const quality = status.qualityRating ? QUALITY[status.qualityRating.toUpperCase()] : null;
    const templateRows = [
      ...Object.entries(status.templates).map(([name, st]) => ({ name, st })),
      ...status.missingTemplates.filter((n) => !(n in status.templates)).map((name) => ({ name, st: "MISSING" })),
    ];
    return (
      <div className="card p-5 space-y-4">
        {header}
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" /> {t("active.banner")}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-petra-text">
            {status.displayPhone && <span dir="ltr" className="font-mono">{status.displayPhone}</span>}
            {status.verifiedName && <span>{status.verifiedName}</span>}
            <span className="text-xs text-petra-muted">{t("active.connectedSince", { date: shortDate(status.connectedAt, locale) })}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {quality ? <span className={cn("badge text-xs", quality.cls)}>{t(`quality.${status.qualityRating!.toUpperCase() as "GREEN" | "YELLOW" | "RED"}`)}</span>
              : status.qualityRating ? <span className="badge badge-neutral text-xs">{t("quality.raw", { rating: status.qualityRating })}</span> : null}
            <span className={cn("badge text-xs", status.coexistence ? "badge-brand" : "badge-neutral")}>
              {status.coexistence ? t("active.coexistenceOn") : t("active.coexistenceOff")}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-petra-text">{t("templates.title")}</h4>
            <div className="flex items-center gap-2">
              {status.templatesSyncedAt && <span className="text-xs text-petra-muted hidden sm:inline">{t("templates.syncedAt", { date: shortDate(status.templatesSyncedAt, locale) })}</span>}
              {canManage && (
                <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="btn-secondary text-xs flex items-center gap-1.5">
                  <RefreshCw className={cn("w-3.5 h-3.5", syncMutation.isPending && "animate-spin")} /> {t("templates.sync")}
                </button>
              )}
            </div>
          </div>
          {templateRows.length === 0 ? (
            <p className="text-xs text-petra-muted">{t("templates.empty")}{canManage && <>{" "}{t("templates.emptyHint")}</>}</p>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {templateRows.map(({ name, st }) => {
                    const meta = TEMPLATE_STATUS[st];
                    return (
                      <tr key={name} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-petra-text break-all" dir="ltr">{name}</td>
                        <td className="px-3 py-2 text-end">
                          {st === "MISSING"
                            ? <span className="badge badge-neutral text-xs">{t("templates.missing")}</span>
                            : <span className={cn("badge text-xs", meta?.cls ?? "badge-neutral")}>{meta ? t(`templateStatus.${st as "APPROVED" | "PENDING" | "REJECTED"}`) : st}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {status.missingTemplates.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">{t("templates.missingNote")}</p>
          )}
        </div>

        {canManage ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            className="input flex-1 min-w-0"
            placeholder="05X-XXXXXXX"
            dir="ltr"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && testPhone.trim() && testMutation.mutate(testPhone.trim())}
          />
          <button onClick={() => testMutation.mutate(testPhone.trim())} disabled={!testPhone.trim() || testMutation.isPending} className="btn-secondary text-sm flex items-center gap-1.5 justify-center">
            {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t("test.send")}
          </button>
          <button
            onClick={() => setConfirmDisconnect(true)}
            disabled={disconnectMutation.isPending}
            className="btn-danger text-sm flex items-center gap-1.5 justify-center"
          >
            {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />} {t("actions.disconnect")}
          </button>
        </div>
        ) : readOnlyNote}
        {disconnectDialog}
      </div>
    );
  }

  // none / disconnected
  return (
    <div className="card p-5 space-y-4">
      {header}
      {status.status === "disconnected" && (
        <p className="text-xs text-petra-muted">{t("none.disconnectedNote")}</p>
      )}
      {!canManage ? readOnlyNote : (
      <TierGate feature="whatsapp_reminders" title={t("tierGate.title")} description={t("tierGate.description")}>
        <div className="space-y-4">
          <ul className="text-sm text-petra-text space-y-1.5">
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> {t("none.requirements.facebook")}</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> {t("none.requirements.number")}</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> {t("none.requirements.verify")}</li>
          </ul>
          {coexistenceToggle}
          <div className="flex flex-wrap items-center gap-3">
            {connectButton(t("connect.connectCta"))}
            {cancelLink}
          </div>
          {debugPanel}
        </div>
      </TierGate>
      )}
    </div>
  );
}

export default WhatsAppConnectCard;
