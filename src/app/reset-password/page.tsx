"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

// Password strength indicator (same as register page)
function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.resetPasswordPage");
  if (!password) return null;

  const checks = [
    { id: "length", label: t("passwordStrength.checks.length"), ok: password.length >= 12 },
    { id: "upper", label: t("passwordStrength.checks.upper"), ok: /[A-Z]/.test(password) },
    { id: "lower", label: t("passwordStrength.checks.lower"), ok: /[a-z]/.test(password) },
    { id: "digit", label: t("passwordStrength.checks.digit"), ok: /[0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.ok).length;
  const colors = ["#EF4444", "#EF4444", "#F59E0B", "#F59E0B", "#10B981"];
  const labels = [t("passwordStrength.weak"), t("passwordStrength.weak"), t("passwordStrength.medium"), t("passwordStrength.medium"), t("passwordStrength.strong")];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score - 1] : "#E2E8F0" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {checks.map((c) => (
            <span
              key={c.id}
              className="text-[10px] flex items-center gap-0.5"
              style={{ color: c.ok ? "#10B981" : "#94A3B8" }}
            >
              {c.ok ? "✓" : "○"} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span
            className="text-[11px] font-medium"
            style={{ color: colors[score - 1] }}
          >
            {labels[score - 1]}
          </span>
        )}
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.resetPasswordPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // If no token in URL → show error immediately
  useEffect(() => {
    if (!token) setError(t("errors.invalidLink"));
  }, [token]);

  const isValid =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !token) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errors.resetFailed"));
        return;
      }

      setDone(true);
      // Redirect to dashboard after 2 seconds (user is now logged in)
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
          <Image src="/icon.png" alt="Petra" width={64} height={64} className="w-full h-full" priority />
        </div>
        <h1 className="text-2xl font-bold text-petra-text">Petra</h1>
        <p className="text-sm text-petra-muted mt-1">{t("tagline")}</p>
      </div>

      {done ? (
        /* ── Success ── */
        <div className="card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("success.title")}</h2>
            <p className="text-sm text-petra-muted mt-1">
              {t("success.body")}
            </p>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "#E2E8F0" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: "100%",
                background: "linear-gradient(90deg, #10B981, #34D399)",
                animation: "none",
              }}
            />
          </div>
        </div>
      ) : (
        /* ── Form ── */
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("form.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              {t("form.subtitle")}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New password */}
          <div>
            <label className="label">{t("form.newPassword")}</label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                className="input ps-10 pe-10"
                placeholder={t("form.newPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                dir="ltr"
                disabled={!token}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          {/* Confirm */}
          <div>
            <label className="label">{t("form.confirmPassword")}</label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                className={`input ${cfg.dir === "rtl" ? "pr-10" : "pl-10"}`} // rtl-ok: dir=ltr input, padding on the icon side
                placeholder={t("form.confirmPlaceholder")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                dir="ltr"
                disabled={!token}
              />
            </div>
            {confirm && password !== confirm && (
              <p className="text-xs text-red-500 mt-1">{t("form.mismatch")}</p>
            )}
            {confirm && password === confirm && password.length >= 12 && (
              <p className="text-xs text-green-600 mt-1">{t("form.match")}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || !isValid || !token}
          >
            {loading ? (
              <span className="animate-pulse">{t("form.updating")}</span>
            ) : (
              t("form.submit")
            )}
          </button>

          <Link
            href="/forgot-password"
            className="flex justify-center text-sm text-petra-muted hover:text-petra-text transition-colors"
          >
            {t("form.expiredLink")}
          </Link>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-petra-bg p-4"
      dir={cfg.dir}
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
