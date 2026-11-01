"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink, AlertTriangle, Check, X } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useTranslations } from "next-intl";

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
  /** Full redirect target incl. scheme ("https://claude.ai", "cursor://…") — never empty. */
  redirectTarget: string;
  /** Known MCP client redirect (isVerifiedRedirect). Unverified → red warning + default profile "read". */
  verified: boolean;
  userEmail: string;
  businesses: ConsentBusiness[];
  profiles: Array<{ key: string; label: string }>;
  params: ConsentParams;
}

export function ConsentForm({ clientName, redirectTarget, verified, userEmail, businesses, profiles, params }: ConsentFormProps) {
  const t = useTranslations("auth.consentForm");
  const tc = useTranslations("common");
  const roleLabel = (role: string) => (t.has(`roles.${role}`) ? t(`roles.${role}`) : "");
  const eligible = businesses.filter((b) => b.eligible);
  const [businessId, setBusinessId] = useState<string>(eligible[0]?.businessId ?? "");
  const defaultProfile = verified ? "full" : "read";
  const [profile, setProfile] = useState<string>(
    profiles.some((p) => p.key === defaultProfile) ? defaultProfile : profiles[0]?.key ?? ""
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
        setError(data.error || t("errors.approveFailed"));
        return;
      }
      setRedirecting(true);
      window.location.href = data.redirect;
    } catch {
      setError(t("errors.network"));
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
          <span className="text-xs font-semibold">{t("eyebrow")}</span>
        </div>

        {/* client name is attacker-controlled → plain text only */}
        <h1 className="text-[22px] font-bold tracking-tight text-petra-text leading-snug break-words">
          {t.rich("title", { client: () => <span dir="auto">{clientName}</span> })}
        </h1>
        <p className="text-sm text-petra-muted mt-1.5 leading-relaxed">
          {t("subtitle")}
        </p>

        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
          <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            {t.rich("redirectNotice", {
              target: () => (
                <span dir="ltr" className="font-bold break-all">
                  {redirectTarget}
                </span>
              ),
            })}
            <div className="text-xs text-amber-800 mt-0.5">{t("redirectWarning")}</div>
          </div>
        </div>

        {!verified && (
          <div
            role="alert"
            className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="font-semibold">{t("unverified")}</span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-petra-muted">
          <span className="truncate">
            {t.rich("signedInAs", {
              email: () => (
                <span dir="ltr" className="font-medium text-petra-text">
                  {userEmail}
                </span>
              ),
            })}
          </span>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut || redirecting}
            className="shrink-0 text-brand-500 hover:text-brand-600 hover:underline underline-offset-2 disabled:opacity-50"
          >
            {t("notYou")}
          </button>
        </div>

        {/* Business */}
        <div className="mt-5">
          {businesses.length > 1 ? (
            <>
              <label className="label" htmlFor="oauth-business">
                {t("businessLabel")}
              </label>
              <select
                id="oauth-business"
                className="input"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                disabled={!!busy || redirecting}
              >
                {onlyIneligible && <option value="">{t("noEligibleOption")}</option>}
                {businesses.map((b) => (
                  <option key={b.businessId} value={b.businessId} disabled={!b.eligible}>
                    {(b.name || t("unnamedBusiness")) +
                      (roleLabel(b.role) ? ` · ${roleLabel(b.role)}` : "") +
                      (!b.eligible && b.reason ? ` — ${b.reason}` : "")}
                  </option>
                ))}
              </select>
            </>
          ) : businesses.length === 1 ? (
            <div className="text-sm">
              <span className="text-petra-muted">{t("businessPrefix")}</span>
              <span className="font-semibold text-petra-text">{businesses[0].name || t("unnamedBusiness")}</span>
            </div>
          ) : null}

          {onlyIneligible && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {businesses.length === 0
                  ? t("ineligible.none")
                  : businesses.length === 1
                  ? businesses[0].reason || t("ineligible.single")
                  : t("ineligible.all")}
              </span>
            </div>
          )}
        </div>

        {/* Profile */}
        {!onlyIneligible && (
          <fieldset className="mt-5" disabled={!!busy || redirecting}>
            <legend className="label">{t("profileLegend")}</legend>
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
                    {t.has(`profileHints.${p.key}`) && (
                      <span className="block text-xs text-petra-muted mt-0.5">{t(`profileHints.${p.key}`)}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-petra-muted mt-2 leading-relaxed">
              {selected?.role === "manager"
                ? t("scopeNote.manager")
                : t("scopeNote.other")}{" "}
              {t("scopeNote.disconnect")}
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
            {t("approve")}
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
            {tc("actions.cancel")}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-petra-muted mt-4">Petra &copy; {new Date().getFullYear()}</p>
    </div>
  );
}
