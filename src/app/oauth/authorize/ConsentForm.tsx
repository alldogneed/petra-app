"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink, AlertTriangle, Check, X } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";

export interface ConsentBusiness {
  businessId: string;
  name: string;
  role: string;
  eligible: boolean;
  reason?: string;
}

export interface ConsentParams {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: "S256";
  state: string | null;
  resource: string | null;
}

interface ConsentFormProps {
  clientName: string;
  redirectHost: string;
  userEmail: string;
  businesses: ConsentBusiness[];
  profiles: Array<{ key: string; label: string }>;
  params: ConsentParams;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "משתמש",
  volunteer: "מתנדב",
};

const PROFILE_HINTS: Record<string, string> = {
  full: "כל מה שההרשאה שלך בעסק מאפשרת",
  read: "צפייה בלבד — בלי שינויים",
};

export function ConsentForm({ clientName, redirectHost, userEmail, businesses, profiles, params }: ConsentFormProps) {
  const eligible = businesses.filter((b) => b.eligible);
  const [businessId, setBusinessId] = useState<string>(eligible[0]?.businessId ?? "");
  const [profile, setProfile] = useState<string>(
    profiles.some((p) => p.key === "full") ? "full" : profiles[0]?.key ?? ""
  );
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const selected = businesses.find((b) => b.businessId === businessId);
  const onlyIneligible = eligible.length === 0;

  async function submit(decision: "approve" | "deny") {
    setError("");
    setBusy(decision);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...params, business_id: businessId, profile, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok || typeof data.redirect !== "string") {
        setError(data.error || "שגיאה באישור החיבור. נסו שוב.");
        return;
      }
      setRedirecting(true);
      window.location.href = data.redirect;
    } catch {
      setError("שגיאת רשת. בדקו את החיבור ונסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // ignore — reload shows the login redirect either way
    }
    window.location.reload();
  }

  return (
    <div>
      {redirecting && <PetraLoader variant="splash" />}

      <div className="card p-6">
        <div className="flex items-center gap-2 text-brand-500 mb-3">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-semibold">בקשת גישה לחשבון</span>
        </div>

        {/* client name is attacker-controlled → plain text only */}
        <h1 className="text-[22px] font-bold tracking-tight text-petra-text leading-snug break-words">
          חיבור <span dir="auto">{clientName}</span> לפטרה
        </h1>
        <p className="text-sm text-petra-muted mt-1.5 leading-relaxed">
          האפליקציה תוכל לקרוא ולעדכן נתונים בעסק שלך לפי רמת הגישה שתבחר/י כאן.
        </p>

        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
          <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            לאחר האישור תועבר/י אל:{" "}
            <span dir="ltr" className="font-bold break-all">
              {redirectHost}
            </span>
            <div className="text-xs text-amber-800 mt-0.5">אשר/י רק אם ביקשת עכשיו לחבר עוזר AI לפטרה.</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-petra-muted">
          <span className="truncate">
            מחובר/ת בתור{" "}
            <span dir="ltr" className="font-medium text-petra-text">
              {userEmail}
            </span>
          </span>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut || redirecting}
            className="shrink-0 text-brand-500 hover:text-brand-600 hover:underline underline-offset-2 disabled:opacity-50"
          >
            לא את/ה? התנתק/י
          </button>
        </div>

        {/* Business */}
        <div className="mt-5">
          {businesses.length > 1 ? (
            <>
              <label className="label" htmlFor="oauth-business">
                עסק
              </label>
              <select
                id="oauth-business"
                className="input"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                disabled={!!busy || redirecting}
              >
                {onlyIneligible && <option value="">— אין עסק זמין לחיבור —</option>}
                {businesses.map((b) => (
                  <option key={b.businessId} value={b.businessId} disabled={!b.eligible}>
                    {(b.name || "עסק ללא שם") +
                      (ROLE_LABELS[b.role] ? ` · ${ROLE_LABELS[b.role]}` : "") +
                      (!b.eligible && b.reason ? ` — ${b.reason}` : "")}
                  </option>
                ))}
              </select>
            </>
          ) : businesses.length === 1 ? (
            <div className="text-sm">
              <span className="text-petra-muted">עסק: </span>
              <span className="font-semibold text-petra-text">{businesses[0].name || "עסק ללא שם"}</span>
            </div>
          ) : null}

          {onlyIneligible && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {businesses.length === 0
                  ? "לא נמצא עסק שאפשר לחבר אליו עוזר AI מהחשבון הזה."
                  : businesses.length === 1
                  ? businesses[0].reason || "לא ניתן לחבר עוזר AI לעסק הזה."
                  : "אף אחד מהעסקים שלך אינו זמין לחיבור כרגע."}
              </span>
            </div>
          )}
        </div>

        {/* Profile */}
        {!onlyIneligible && (
          <fieldset className="mt-5" disabled={!!busy || redirecting}>
            <legend className="label">רמת גישה</legend>
            <div className="space-y-2">
              {profiles.map((p) => (
                <label
                  key={p.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    profile === p.key ? "border-brand-500 bg-orange-50/50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="oauth-profile"
                    value={p.key}
                    checked={profile === p.key}
                    onChange={() => setProfile(p.key)}
                    className="mt-1 accent-orange-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-petra-text">{p.label}</span>
                    {PROFILE_HINTS[p.key] && (
                      <span className="block text-xs text-petra-muted mt-0.5">{PROFILE_HINTS[p.key]}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-petra-muted mt-2 leading-relaxed">
              {selected?.role === "manager"
                ? "כמנהל/ת, החיבור לא יכלול תשלומים, דוחות ופעולות בלתי הפיכות — גם בגישה מלאה."
                : "ההרשאות מוגבלות תמיד לתפקיד שלך בעסק (מנהל: ללא תשלומים, דוחות ופעולות בלתי הפיכות)."}{" "}
              אפשר לנתק את החיבור בכל עת בהגדרות ← עוזרי AI.
            </p>
          </fieldset>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="btn-primary flex-1 justify-center"
            onClick={() => submit("approve")}
            disabled={onlyIneligible || !businessId || !profile || !!busy || redirecting}
          >
            {busy === "approve" ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            אשר חיבור
          </button>
          <button
            type="button"
            className="btn-secondary flex-1 justify-center"
            onClick={() => submit("deny")}
            disabled={!!busy || redirecting}
          >
            {busy === "deny" ? (
              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            ביטול
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-petra-muted mt-4">Petra &copy; {new Date().getFullYear()}</p>
    </div>
  );
}
