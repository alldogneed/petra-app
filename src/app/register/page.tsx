"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, User, UserPlus, CheckSquare, Square, Briefcase } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.registerPage");
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
            style={{
              background: i < score ? colors[score] : "#E2E8F0",
            }}
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
            style={{ color: colors[score] }}
          >
            {labels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

const VALID_PLANS = new Set(["basic", "pro", "groomer", "service_dog"]);

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.registerPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const planParam = searchParams.get("plan") ?? "";
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side password validation — give explicit feedback before hitting the API
    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(t("errors.passwordRules"));
      return;
    }

    if (!tosAccepted) {
      setError(t("errors.tosRequired"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessName: businessName.trim() || name.trim(), email, password, tosAccepted, tosVersion: "1.0", plan: planParam || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errors.createFailed"));
        return;
      }

      // Plan selected — go to checkout to enter card details
      if (planParam && VALID_PLANS.has(planParam)) {
        router.push(`/checkout?tier=${planParam}`);
        return;
      }
      // Registered + logged in → go to onboarding wizard
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  const isValid =
    name.trim().length > 0 &&
    businessName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-petra-bg p-4" dir={cfg.dir}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)" }}
          >
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-petra-text">Petra</h1>
          <p className="text-sm text-petra-muted mt-1">{t("tagline")}</p>
        </div>

        {/* Google signup */}
        <div className="card p-4">
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {t("google.continue")}
          </a>
          <p className="text-center text-xs text-petra-muted mt-2">
            {t("google.hint")}
          </p>
        </div>

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-petra-bg px-3 text-petra-muted">{t("divider")}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("form.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              {t("form.subtitle")}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="label">{t("form.fullName")}</label>
            <div className="relative">
              <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input ps-10"
                placeholder={t("form.fullNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                dir={cfg.dir}
              />
            </div>
          </div>

          {/* Business Name */}
          <div>
            <label className="label">{t("form.businessName")}</label>
            <div className="relative">
              <Briefcase className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input ps-10"
                placeholder={t("form.businessNamePlaceholder")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                dir={cfg.dir}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="label">{t("form.email")}</label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                className={`input ${cfg.dir === "rtl" ? "pr-10" : "pl-10"}`} // rtl-ok: dir=ltr input, padding on the icon side
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                dir="ltr"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="label">{t("form.password")}</label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                className="input ps-10 pe-10"
                placeholder={t("form.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                dir="ltr"
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

          {/* ToS Checkbox */}
          <button
            type="button"
            onClick={() => setTosAccepted(!tosAccepted)}
            className="flex items-start gap-2 w-full text-start group"
          >
            <div className="mt-0.5 flex-shrink-0">
              {tosAccepted ? (
                <CheckSquare className="w-4 h-4 text-brand-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-500" />
              )}
            </div>
            <span className="text-xs text-petra-muted leading-relaxed">
              {t.rich("form.tos", {
                terms: (chunks) => (
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-brand-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-brand-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </button>

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || !isValid}
          >
            {loading ? (
              <span className="animate-pulse">{t("form.creating")}</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                {t("form.submit")}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-petra-muted mt-4">
          {t.rich("haveAccount", {
            link: (chunks) => (
              <Link
                href="/login"
                className="font-medium text-brand-500 hover:text-brand-600 underline-offset-2 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>

        <p className="text-center text-xs text-petra-muted mt-4">
          Petra &copy; {new Date().getFullYear()}
        </p>
        <p className="text-center text-xs text-petra-muted mt-1">
          {t("copyright")}
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
