"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

// Password strength indicator (same as register page)
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: "לפחות 8 תווים", ok: password.length >= 8 },
    { label: "אות אחת לפחות", ok: /[A-Za-z]/.test(password) },
    { label: "ספרה אחת לפחות", ok: /[0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.ok).length;
  const colors = ["#EF4444", "#F59E0B", "#10B981"];
  const labels = ["חלשה", "בינונית", "חזקה"];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
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
              key={c.label}
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
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // If no token in URL → show error immediately
  useEffect(() => {
    if (!token) setError("לינק לא תקין — חזור לדף 'שכחתי סיסמה' ובקש לינק חדש.");
  }, [token]);

  const isValid =
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
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
        setError(data.error || "שגיאה באיפוס הסיסמה");
        return;
      }

      setDone(true);
      // Redirect to dashboard after 2 seconds (user is now logged in)
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setError("שגיאת רשת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
          <Image src="/icon.svg" alt="Petra" width={64} height={64} className="w-full h-full" priority />
        </div>
        <h1 className="text-2xl font-bold text-petra-text">Petra</h1>
        <p className="text-sm text-petra-muted mt-1">ניהול עסקי חיות מחמד</p>
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
            <h2 className="text-lg font-bold text-petra-text">הסיסמה שונתה!</h2>
            <p className="text-sm text-petra-muted mt-1">
              הסיסמה עודכנה בהצלחה. מעביר אותך לדשבורד...
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
            <h2 className="text-lg font-bold text-petra-text">איפוס סיסמה</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              בחר סיסמה חדשה לחשבון שלך
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
            <label className="label">סיסמה חדשה</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                className="input pr-10 pl-10"
                placeholder="לפחות 8 תווים"
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
            <label className="label">אימות סיסמה</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                className="input pr-10"
                placeholder="הכנס שוב"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                dir="ltr"
                disabled={!token}
              />
            </div>
            {confirm && password !== confirm && (
              <p className="text-xs text-red-500 mt-1">הסיסמאות אינן תואמות</p>
            )}
            {confirm && password === confirm && password.length >= 8 && (
              <p className="text-xs text-green-600 mt-1">✓ הסיסמאות תואמות</p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || !isValid || !token}
          >
            {loading ? (
              <span className="animate-pulse">מעדכן סיסמה...</span>
            ) : (
              "עדכן סיסמה"
            )}
          </button>

          <Link
            href="/forgot-password"
            className="flex justify-center text-sm text-petra-muted hover:text-petra-text transition-colors"
          >
            לינק פג תוקף? בקש לינק חדש
          </Link>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-petra-bg p-4"
      dir="rtl"
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
