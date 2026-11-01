"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

interface InviteInfo {
  businessName: string;
  name: string;
  email: string;
  role: string;
  inviterName: string | null;
  hasAccount: boolean;
  /** Existing account: the browser is signed in as it, so accepting is one click. */
  signedInAsInvitee: boolean;
}

function PasswordChecks({ password }: { password: string }) {
  const t = useTranslations("auth.invitePage.passwordChecks");
  if (!password) return null;
  const checks = [
    { id: "length", ok: password.length >= 12 },
    { id: "upper", ok: /[A-Z]/.test(password) },
    { id: "lower", ok: /[a-z]/.test(password) },
    { id: "digit", ok: /[0-9]/.test(password) },
  ] as const;
  return (
    <div className="flex gap-3 mt-2 flex-wrap">
      {checks.map((c) => (
        <span key={c.id} className={c.ok ? "text-[11px] text-emerald-600" : "text-[11px] text-slate-400"}>
          {c.ok ? "✓" : "○"} {t(c.id)}
        </span>
      ))}
    </div>
  );
}

function InviteForm() {
  const t = useTranslations("auth.invitePage");
  const token = useSearchParams().get("token") ?? "";

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { loggedIn: true }>(null);

  useEffect(() => {
    if (!token) {
      setLoadError(t("errors.invalidLink"));
      return;
    }
    fetch("/api/auth/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lookup", token }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || t("errors.loadFailed"));
        setInfo(data);
        setName(data.name ?? "");
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  const passwordOk =
    password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && password === confirm;
  const canSubmit =
    !!info && !submitting && (info.hasAccount ? info.signedInAsInvitee : passwordOk && name.trim().length > 0);
  const loginHref = info
    ? `/login?email=${encodeURIComponent(info.email)}&next=${encodeURIComponent(`/invite?token=${token}`)}`
    : "/login";

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !info) return;
    setError("");
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          info.hasAccount ? { action: "accept", token } : { action: "accept", token, password, name: name.trim() },
        ),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || t("errors.acceptFailed"));
        return;
      }
      setDone({ loggedIn: true });
      // Full reload so the session picks up the new membership.
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    } catch {
      setError(t("errors.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
          <Image src="/icon.png" alt="Petra" width={64} height={64} className="w-full h-full" priority />
        </div>
        <h1 className="text-2xl font-bold text-petra-text">Petra</h1>
        <p className="text-sm text-petra-muted mt-1">{t("tagline")}</p>
      </div>

      {loadError ? (
        <div className="card p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm text-petra-text">{loadError}</p>
          <Link href="/login" className="btn-secondary inline-flex justify-center">{t("toLogin")}</Link>
        </div>
      ) : !info ? (
        <PetraLoader />
      ) : done ? (
        <div className="card p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("done.title", { business: info.businessName })}</h2>
            <p className="text-sm text-petra-muted mt-1">{t("done.subtitle")}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={accept} className="card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-petra-text">{t("form.title")}</h2>
              <p className="text-sm text-petra-muted mt-0.5">
                {t.rich(info.inviterName ? "form.introByInviter" : "form.intro", {
                  inviter: info.inviterName ?? "",
                  business: info.businessName,
                  role: t.has(`roles.${info.role}`) ? t(`roles.${info.role}`) : info.role,
                  b: (c) => <strong className="text-petra-text">{c}</strong>,
                })}
              </p>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-petra-muted">{t("form.usernameLabel")}</span>
            <span className="font-medium text-petra-text" dir="ltr">{info.email}</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info.hasAccount ? (
            <p className="text-sm text-petra-muted">
              {info.signedInAsInvitee
                ? t("form.signedInAsInvitee")
                : t("form.hasAccount")}
            </p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="invite-name">{t("form.fullName")}</label>
                <input id="invite-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
              </div>
              <div>
                <label className="label" htmlFor="invite-password">{t("form.choosePassword")}</label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="invite-password"
                    type={showPassword ? "text" : "password"}
                    className="input ps-10 pe-10"
                    placeholder={t("form.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? t("form.hidePassword") : t("form.showPassword")}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordChecks password={password} />
              </div>
              <div>
                <label className="label" htmlFor="invite-confirm">{t("form.confirmPassword")}</label>
                <input
                  id="invite-confirm"
                  type={showPassword ? "text" : "password"}
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                  required
                />
                {confirm && password !== confirm && <p className="text-xs text-red-500 mt-1">{t("form.passwordMismatch")}</p>}
              </div>
            </>
          )}

          {info.hasAccount && !info.signedInAsInvitee ? (
            <Link href={loginHref} className="btn-primary w-full justify-center">
              {t("form.loginAndAccept")}
            </Link>
          ) : (
            <button type="submit" className="btn-primary w-full justify-center" disabled={!canSubmit}>
              {submitting ? <span className="animate-pulse">{t("form.accepting")}</span> : t("form.accept")}
            </button>
          )}
          <p className="text-xs text-petra-muted text-center">{t("form.notYours")}</p>
        </form>
      )}
    </div>
  );
}

export default function InvitePage() {
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  return (
    <div className="min-h-screen flex items-center justify-center bg-petra-bg p-4" dir={cfg.dir}>
      <Suspense>
        <InviteForm />
      </Suspense>
    </div>
  );
}
