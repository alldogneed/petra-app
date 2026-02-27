"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, User, UserPlus } from "lucide-react";

// Password strength indicator
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
            style={{
              background: i < score ? colors[score - 1] : "#E2E8F0",
            }}
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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "שגיאה ביצירת החשבון");
        return;
      }

      // Registered + logged in → go to onboarding wizard
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("שגיאת רשת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  const isValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-petra-bg p-4" dir="rtl">
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
          <p className="text-sm text-petra-muted mt-1">ניהול עסקי חיות מחמד</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-petra-text">יצירת חשבון</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              הצטרף לפטרה וניהל את העסק בקלות
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="label">שם מלא</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input pr-10"
                placeholder="ישראל ישראלי"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                dir="rtl"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="label">אימייל</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                className="input pr-10"
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
            <label className="label">סיסמה</label>
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

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || !isValid}
          >
            {loading ? (
              <span className="animate-pulse">יוצר חשבון...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                צור חשבון חינם
              </>
            )}
          </button>

          <p className="text-center text-xs text-petra-muted pt-1">
            בלחיצה על &quot;צור חשבון&quot; אתה מסכים לתנאי השימוש
          </p>
        </form>

        <p className="text-center text-sm text-petra-muted mt-4">
          כבר יש לך חשבון?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-500 hover:text-brand-600 underline-offset-2 hover:underline"
          >
            התחבר
          </Link>
        </p>

        <p className="text-center text-xs text-petra-muted mt-4">
          Petra &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
