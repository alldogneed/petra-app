"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_config: "חיבור Google לא מוגדר. פנה למנהל המערכת.",
  google_denied: "ההתחברות עם Google בוטלה.",
  missing_params: "שגיאה בתשובה מ-Google. נסה שוב.",
  invalid_state: "שגיאת אימות. נסה שוב.",
  email_not_verified: "כתובת האימייל ב-Google לא מאומתת.",
  account_disabled: "החשבון מושבת. פנה למנהל המערכת.",
  server_error: "שגיאת שרת. נסה שוב.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    googleError ? GOOGLE_ERROR_MESSAGES[googleError] || "שגיאה בהתחברות עם Google" : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "שגיאה בהתחברות");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("שגיאה בהתחברות. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
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
          <h2 className="text-lg font-bold text-petra-text">התחברות</h2>
          <p className="text-sm text-petra-muted mt-0.5">הכנס את פרטי החשבון שלך</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

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

        <div>
          <label className="label">סיסמה</label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              className="input pr-10 pl-10"
              placeholder="הכנס סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-petra-muted hover:text-brand-500 transition-colors"
          >
            שכחתי סיסמה
          </Link>
        </div>

        <button
          type="submit"
          className="btn-primary w-full justify-center"
          disabled={loading || !email || !password}
        >
          {loading ? (
            <span className="animate-pulse">מתחבר...</span>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              התחבר
            </>
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-petra-muted">או</span>
          </div>
        </div>

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
          התחבר עם Google
        </a>
      </form>

      <p className="text-center text-sm text-petra-muted mt-4">
        אין לך חשבון עדיין?{" "}
        <Link
          href="/register"
          className="font-medium text-brand-500 hover:text-brand-600 underline-offset-2 hover:underline"
        >
          צור חשבון חינם
        </Link>
      </p>

      <p className="text-center text-xs text-petra-muted mt-3">
        Petra &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-petra-bg p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
