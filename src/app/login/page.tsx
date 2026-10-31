"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { safeNextPath } from "@/lib/safe-redirect";
import { useTranslations } from "next-intl";

// Error codes from /api/auth/google → messages under auth.loginPage.googleErrors.*
const GOOGLE_ERROR_CODES = new Set([
  "google_config",
  "google_denied",
  "missing_params",
  "invalid_state",
  "email_not_verified",
  "account_disabled",
  "server_error",
]);

function LoginForm() {
  const t = useTranslations("auth.loginPage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("error");
  // Only /oauth/authorize… is honoured (MCP OAuth consent) — see src/lib/safe-redirect.ts
  const nextPath = safeNextPath(searchParams.get("next"));
  const googleHref = nextPath
    ? `/api/auth/google?next=${encodeURIComponent(nextPath)}`
    : "/api/auth/google";
  // Prefilled after accepting a team invitation with an existing account (/invite).
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(
    googleError
      ? GOOGLE_ERROR_CODES.has(googleError)
        ? t(`googleErrors.${googleError}`)
        : t("googleErrors.generic")
      : searchParams.get("reason") === "access_ended"
        ? t("errors.accessEnded")
        : ""
  );
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errors.loginFailed"));
        return;
      }

      setEntering(true);
      window.location.href = nextPath ?? "/dashboard";
    } catch {
      setError(t("errors.loginFailedRetry"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      {entering && <PetraLoader variant="splash" />}
      {/* Brand */}
      <div className="flex items-center gap-3 mb-9">
        <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white shadow-card flex items-center justify-center overflow-hidden">
          <Image src="/logo.svg" alt="Petra" width={30} height={30} className="object-contain" priority />
        </div>
        <span className="text-[22px] font-extrabold tracking-tight text-petra-text">Petra</span>
      </div>

      {/* Heading */}
      <h1 className="text-[28px] font-bold tracking-tight text-petra-text leading-tight">{t("title")}</h1>
      <p className="text-sm text-petra-muted mt-1.5 mb-7 leading-relaxed">
        {t("subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="label">{t("emailLabel")}</label>
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              className="input ps-10"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="label">{t("passwordLabel")}</label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              className="input ps-10 pe-10"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-500 accent-orange-500 cursor-pointer"
              />
              <span className="text-xs text-petra-muted">{t("rememberMe")}</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-petra-muted hover:text-brand-500 transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <p className="text-[11px] text-petra-muted mt-1.5 leading-relaxed">
            {rememberMe
              ? t("rememberMeOn")
              : t("rememberMeOff")}
          </p>
        </div>

        <button
          type="submit"
          className="btn-primary w-full justify-center"
          disabled={loading || !email || !password}
        >
          {loading ? (
            <span className="animate-pulse">{t("loggingIn")}</span>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              {t("submit")}
            </>
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-petra-bg px-2 text-petra-muted">{t("or")}</span>
          </div>
        </div>

        <div>
          <a
            href={googleHref}
            className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {t("continueWithGoogle")}
          </a>
          <p className="text-center text-xs text-petra-muted mt-1.5">
            {t("googleNewUser")}
          </p>
        </div>
      </form>

      <p className="text-center text-sm text-petra-muted mt-4">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="font-medium text-brand-500 hover:text-brand-600 underline-offset-2 hover:underline"
        >
          {t("createAccount")}
        </Link>
      </p>

      <p className="text-center text-xs text-petra-muted mt-3">
        Petra &copy; {new Date().getFullYear()}
      </p>
      <p className="text-center text-xs text-petra-muted mt-1">
        {t("copyright")}
      </p>
      <p className="text-center text-xs text-petra-muted mt-2 flex items-center justify-center gap-2">
        <Link href="/privacy" className="hover:text-brand-500 transition-colors underline underline-offset-2">
          {t("privacy")}
        </Link>
        <span>·</span>
        <Link href="/terms" className="hover:text-brand-500 transition-colors underline underline-offset-2">
          {t("terms")}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const th = useTranslations("auth.loginPage.hero");
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-petra-bg">
      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>

      {/* Hero side — desktop only */}
      <div
        className="hidden lg:flex relative overflow-hidden text-white p-12 flex-col justify-between"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.85) 100%), url('/trainer-black-shepherd.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <span className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/15 backdrop-blur-sm border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {th("badge")}
        </span>

        <div>
          <p className="text-[28px] font-semibold tracking-tight leading-snug max-w-md">
            <span className="text-brand-300 font-bold">&ldquo;</span>
            {th("quote")}
            <span className="text-brand-300 font-bold">.&rdquo;</span>
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand-300 text-slate-900 flex items-center justify-center font-bold">
              {th("initials")}
            </div>
            <div>
              <div className="text-sm font-semibold">{th("name")}</div>
              <div className="text-xs text-white/70 mt-0.5">{th("role")}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/15">
          <div>
            <div className="text-2xl font-bold tracking-tight">130</div>
            <div className="text-[11px] text-white/70 mt-0.5 uppercase tracking-wider">{th("stats.businesses")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">5,000+</div>
            <div className="text-[11px] text-white/70 mt-0.5 uppercase tracking-wider">{th("stats.appointments")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">98%</div>
            <div className="text-[11px] text-white/70 mt-0.5 uppercase tracking-wider">{th("stats.satisfaction")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
