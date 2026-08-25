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

const TEMPLATE_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "מאושר", cls: "badge-success" },
  PENDING: { label: "ממתין", cls: "badge-warning" },
  REJECTED: { label: "נדחה", cls: "badge-danger" },
};
const QUALITY: Record<string, { label: string; cls: string }> = {
  GREEN: { label: "איכות: ירוק", cls: "badge-success" },
  YELLOW: { label: "איכות: צהוב", cls: "badge-warning" },
  RED: { label: "איכות: אדום", cls: "badge-danger" },
};
const heDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

type SignupData = { phoneNumberId: string; wabaId: string };

export function WhatsAppConnectCard() {
  const queryClient = useQueryClient();
  const [coexistence, setCoexistence] = useState(true);
  const [launching, setLaunching] = useState(false);
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
    onSuccess: () => { invalidate(); toast.success("הוואטסאפ של העסק חובר בהצלחה"); },
    onError: (err: Error) => toast.error(err.message || "החיבור נכשל"),
    onSettled: resetFlow,
  });
  const syncMutation = useMutation({
    mutationFn: () => fetchJSON<WaConnectionStatus>("/api/integrations/whatsapp/connection/sync-templates", { method: "POST" }),
    onSuccess: () => { invalidate(); toast.success("התבניות סונכרנו"); },
    onError: (err: Error) => toast.error(err.message || "סנכרון התבניות נכשל"),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => fetchJSON<{ ok: boolean }>("/api/integrations/whatsapp/connection", { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast.success("המספר נותק. הודעות יישלחו שוב מהמספר של Petra"); },
    onError: (err: Error) => toast.error(err.message || "הניתוק נכשל"),
  });
  const testMutation = useMutation({
    mutationFn: (phone: string) =>
      fetchJSON<{ success: boolean; message?: string }>("/api/integrations/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }),
    onSuccess: (d) => toast.success(d.message || "הודעת בדיקה נשלחה"),
    onError: (err: Error) => toast.error(err.message || "שליחת הבדיקה נכשלה"),
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
      if (!FB_ORIGINS.has(event.origin) || typeof event.data !== "string") return;
      let msg: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg || msg.type !== "WA_EMBEDDED_SIGNUP") return;
      if (msg.event === "FINISH" || msg.event === "FINISH_ONLY_WABA") {
        const phoneNumberId = msg.data?.phone_number_id;
        const wabaId = msg.data?.waba_id;
        if (!phoneNumberId || !wabaId) {
          toast.error("התהליך הסתיים בלי מספר טלפון. יש להוסיף מספר WhatsApp Business בתהליך של Meta ולנסות שוב");
          resetFlow();
          return;
        }
        signupRef.current = { phoneNumberId: String(phoneNumberId), wabaId: String(wabaId) };
        setAwaitingMeta(false);
        tryConnect();
      } else if (msg.event === "CANCEL") {
        toast.error(`התהליך בוטל${msg.data?.current_step ? ` (שלב: ${msg.data.current_step})` : ""}`);
        resetFlow();
      } else if (msg.event === "ERROR") {
        toast.error(msg.data?.error_message || "שגיאה בתהליך של Meta");
        resetFlow();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [status?.signupAvailable, resetFlow, tryConnect]);

  const launchSignup = () => {
    if (!META_APP_ID || !META_ES_CONFIG_ID) { toast.error("חיבור מספר עצמאי אינו מוגדר בסביבה זו"); return; }
    // No awaits before FB.login — the popup must open inside the click's user gesture,
    // otherwise Chrome's popup blocker eats it silently.
    if (!window.FB) {
      setLaunching(true);
      ensureFbSdk()
        .then(() => { setLaunching(false); toast.info("מוכן — לחצו שוב על הכפתור כדי להיכנס ל-Facebook"); })
        .catch(() => { setLaunching(false); toast.error("לא ניתן לטעון את Facebook SDK. בדקו חוסם פרסומות ונסו שוב"); });
      return;
    }
    setLaunching(true);
    codeRef.current = null;
    signupRef.current = null;
    setAwaitingMeta(true);
    window.FB.login(
      (response: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const code: string | undefined = response?.authResponse?.code;
        if (!code) {
          toast.error("ההתחברות ל-Facebook לא הושלמה");
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
      <div className="card p-5 flex items-center gap-2 text-sm text-petra-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> טוען מצב חיבור WhatsApp…
      </div>
    );
  }
  if (!status) return null;

  const header = (
    <div className="flex items-start gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", status.status === "active" ? "bg-emerald-50" : "bg-slate-100")}>
        <MessageCircle className={cn("w-5 h-5", status.status === "active" ? "text-emerald-600" : "text-slate-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-petra-text">המספר של העסק ב-WhatsApp</h3>
        <p className="text-sm text-petra-muted mt-0.5">שליחת תזכורות והודעות ללקוחות מהמספר שלכם, במקום מהמספר של Petra</p>
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
            <p className="font-medium">חיבור מספר עצמאי — בקרוב</p>
            <p className="text-xs mt-0.5">בינתיים כל ההודעות האוטומטיות יוצאות מהמספר של Petra.</p>
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
        להשאיר את אפליקציית WhatsApp Business פעילה על אותו מספר (Coexistence)
        <span className="block text-xs text-petra-muted mt-0.5">תמשיכו לשוחח עם לקוחות מהאפליקציה בטלפון, ו-Petra תשלח את ההודעות האוטומטיות מאותו מספר.</span>
      </span>
    </label>
  );

  const connectButton = (label: string) => (
    <button onClick={launchSignup} disabled={busy} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
      {connectMutation.isPending ? "מחבר…" : awaitingMeta ? "ממתין לסיום התהליך ב-Meta…" : label}
    </button>
  );
  const cancelLink = awaitingMeta && !connectMutation.isPending && (
    <button onClick={resetFlow} className="text-xs text-petra-muted underline">בטל</button>
  );

  // Error
  if (status.status === "error") {
    return (
      <div className="card p-5 space-y-4">
        {header}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">החיבור למספר {status.displayPhone ?? "העסק"} נתקל בבעיה</p>
            {status.lastError && <p className="text-xs mt-0.5 break-words">{status.lastError}</p>}
            <p className="text-xs mt-0.5">עד לתיקון, ההודעות יוצאות מהמספר של Petra.</p>
          </div>
        </div>
        <TierGate feature="whatsapp_reminders" title="WhatsApp מהמספר של העסק" description="חיבור מספר WhatsApp עצמאי זמין במנוי PRO ומעלה.">
          <div className="space-y-3">
            {coexistenceToggle}
            <div className="flex flex-wrap items-center gap-3">
              {connectButton("חבר מחדש")}
              <button onClick={() => { if (confirm("לנתק את המספר? ההודעות יחזרו לצאת מהמספר של Petra.")) disconnectMutation.mutate(); }} disabled={disconnectMutation.isPending} className="btn-danger text-sm flex items-center gap-1.5">
                {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />} נתק
              </button>
              {cancelLink}
            </div>
          </div>
        </TierGate>
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
            <CheckCircle2 className="w-4 h-4" /> מחובר — ההודעות יוצאות מהמספר של העסק
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-petra-text">
            {status.displayPhone && <span dir="ltr" className="font-mono">{status.displayPhone}</span>}
            {status.verifiedName && <span>{status.verifiedName}</span>}
            <span className="text-xs text-petra-muted">מחובר מאז {heDate(status.connectedAt)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {quality ? <span className={cn("badge text-xs", quality.cls)}>{quality.label}</span>
              : status.qualityRating ? <span className="badge badge-neutral text-xs">איכות: {status.qualityRating}</span> : null}
            <span className={cn("badge text-xs", status.coexistence ? "badge-brand" : "badge-neutral")}>
              {status.coexistence ? "Coexistence: האפליקציה פעילה במקביל" : "ללא Coexistence"}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-petra-text">תבניות הודעה</h4>
            <div className="flex items-center gap-2">
              {status.templatesSyncedAt && <span className="text-xs text-petra-muted hidden sm:inline">סונכרן {heDate(status.templatesSyncedAt)}</span>}
              <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="btn-secondary text-xs flex items-center gap-1.5">
                <RefreshCw className={cn("w-3.5 h-3.5", syncMutation.isPending && "animate-spin")} /> סנכרן תבניות
              </button>
            </div>
          </div>
          {templateRows.length === 0 ? (
            <p className="text-xs text-petra-muted">עדיין לא סונכרנו תבניות. לחצו "סנכרן תבניות".</p>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {templateRows.map(({ name, st }) => {
                    const meta = TEMPLATE_STATUS[st];
                    return (
                      <tr key={name} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-petra-text break-all" dir="ltr">{name}</td>
                        <td className="px-3 py-2 text-left">
                          {st === "MISSING"
                            ? <span className="badge badge-neutral text-xs">חסרה</span>
                            : <span className={cn("badge text-xs", meta?.cls ?? "badge-neutral")}>{meta?.label ?? st}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {status.missingTemplates.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">תבניות שטרם אושרו אצלכם נשלחות בינתיים מהמספר של Petra.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            className="input flex-1"
            placeholder="05X-XXXXXXX"
            dir="ltr"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && testPhone.trim() && testMutation.mutate(testPhone.trim())}
          />
          <button onClick={() => testMutation.mutate(testPhone.trim())} disabled={!testPhone.trim() || testMutation.isPending} className="btn-secondary text-sm flex items-center gap-1.5 justify-center">
            {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} שלח הודעת בדיקה
          </button>
          <button
            onClick={() => { if (confirm("לנתק את מספר העסק מ-Petra? ההודעות האוטומטיות יחזרו לצאת מהמספר של Petra.")) disconnectMutation.mutate(); }}
            disabled={disconnectMutation.isPending}
            className="btn-danger text-sm flex items-center gap-1.5 justify-center"
          >
            {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />} נתק
          </button>
        </div>
      </div>
    );
  }

  // none / disconnected
  return (
    <div className="card p-5 space-y-4">
      {header}
      {status.status === "disconnected" && (
        <p className="text-xs text-petra-muted">המספר נותק. עד לחיבור מחדש ההודעות יוצאות מהמספר של Petra.</p>
      )}
      <TierGate feature="whatsapp_reminders" title="WhatsApp מהמספר של העסק" description="חיבור מספר WhatsApp עצמאי זמין במנוי PRO ומעלה.">
        <div className="space-y-4">
          <ul className="text-sm text-petra-text space-y-1.5">
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> חשבון Facebook של העסק (Business Manager)</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> מספר WhatsApp Business (אפשר את המספר שכבר בשימוש)</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> אימות בעלות על המספר ב-SMS או בשיחה</li>
          </ul>
          {coexistenceToggle}
          <div className="flex flex-wrap items-center gap-3">
            {connectButton("חבר את הוואטסאפ של העסק")}
            {cancelLink}
          </div>
        </div>
      </TierGate>
    </div>
  );
}

export default WhatsAppConnectCard;
