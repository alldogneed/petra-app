"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPasswordPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("errors.sendFailed"));
        return;
      }

      setSent(true);
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-petra-bg p-4"
      dir={cfg.dir}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
            <Image src="/icon.png" alt="Petra" width={64} height={64} className="w-full h-full" priority />
          </div>
          <h1 className="text-2xl font-bold text-petra-text">Petra</h1>
          <p className="text-sm text-petra-muted mt-1">{t("tagline")}</p>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="card p-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-petra-text">{t("sent.title")}</h2>
              <p className="text-sm text-petra-muted mt-1">
                {t.rich("sent.body", {
                  email,
                  addr: (c) => (
                    <span className="font-medium text-petra-text" dir="ltr">
                      {c}
                    </span>
                  ),
                })}
              </p>
            </div>
            <div
              className="p-3 rounded-xl text-sm text-amber-700 border border-amber-100"
              style={{ background: "#FFFBEB" }}
            >
              {t("sent.validity")}
            </div>
            <Link
              href="/login"
              className="btn-secondary w-full justify-center flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
          /* ── Form state ── */
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

            <div>
              <label className="label">{t("form.emailLabel")}</label>
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

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <span className="animate-pulse">{t("form.sending")}</span>
              ) : (
                t("form.submit")
              )}
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-petra-muted hover:text-petra-text transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5 ltr:-scale-x-100" />
              {t("backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
