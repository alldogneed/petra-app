"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";

const ROLE_LABELS: Record<string, string> = { owner: "בעלים", manager: "מנהל", user: "עובד", volunteer: "מתנדב" };

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
  if (!password) return null;
  const checks = [
    { label: "12+ תווים", ok: password.length >= 12 },
    { label: "אות גדולה", ok: /[A-Z]/.test(password) },
    { label: "אות קטנה", ok: /[a-z]/.test(password) },
    { label: "ספרה", ok: /[0-9]/.test(password) },
  ];
  return (
    <div className="flex gap-3 mt-2 flex-wrap">
      {checks.map((c) => (
        <span key={c.label} className={c.ok ? "text-[11px] text-emerald-600" : "text-[11px] text-slate-400"}>
          {c.ok ? "✓" : "○"} {c.label}
        </span>
      ))}
    </div>
  );
}

function InviteForm() {
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
      setLoadError("הקישור לא תקין. בקש/י מבעל העסק לשלוח הזמנה חדשה.");
      return;
    }
    fetch("/api/auth/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lookup", token }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "לא הצלחנו לטעון את ההזמנה");
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
        setError(data.error || "שגיאה באישור ההזמנה");
        return;
      }
      setDone({ loggedIn: true });
      // Full reload so the session picks up the new membership.
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    } catch {
      setError("שגיאת רשת. נסה/י שוב.");
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
        <p className="text-sm text-petra-muted mt-1">ניהול עסקי חיות מחמד</p>
      </div>

      {loadError ? (
        <div className="card p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm text-petra-text">{loadError}</p>
          <Link href="/login" className="btn-secondary inline-flex justify-center">לדף ההתחברות</Link>
        </div>
      ) : !info ? (
        <PetraLoader />
      ) : done ? (
        <div className="card p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-petra-text">ברוך/ה הבא/ה לצוות של {info.businessName}!</h2>
            <p className="text-sm text-petra-muted mt-1">ההצטרפות אושרה. מעבירים אותך למערכת...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={accept} className="card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-petra-text">הזמנה להצטרף לצוות</h2>
              <p className="text-sm text-petra-muted mt-0.5">
                {info.inviterName ? `${info.inviterName} הזמין/ה אותך ל` : "הוזמנת ל"}
                <strong className="text-petra-text">{info.businessName}</strong> בתפקיד{" "}
                <strong className="text-petra-text">{ROLE_LABELS[info.role] ?? info.role}</strong>.
              </p>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-petra-muted">שם משתמש: </span>
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
                ? "את/ה מחובר/ת לחשבון הזה — נשאר רק לאשר."
                : "כבר יש לך חשבון בפטרה עם האימייל הזה. התחבר/י אליו כדי לאשר את ההצטרפות — הסיסמה שלך לא משתנה."}
            </p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="invite-name">שם מלא</label>
                <input id="invite-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
              </div>
              <div>
                <label className="label" htmlFor="invite-password">בחר/י סיסמה</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="invite-password"
                    type={showPassword ? "text" : "password"}
                    className="input pr-10 pl-10"
                    placeholder="לפחות 12 תווים"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordChecks password={password} />
              </div>
              <div>
                <label className="label" htmlFor="invite-confirm">אימות סיסמה</label>
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
                {confirm && password !== confirm && <p className="text-xs text-red-500 mt-1">הסיסמאות אינן תואמות</p>}
              </div>
            </>
          )}

          {info.hasAccount && !info.signedInAsInvitee ? (
            <Link href={loginHref} className="btn-primary w-full justify-center">
              התחברות ואישור
            </Link>
          ) : (
            <button type="submit" className="btn-primary w-full justify-center" disabled={!canSubmit}>
              {submitting ? <span className="animate-pulse">מאשר...</span> : "אישור הצטרפות"}
            </button>
          )}
          <p className="text-xs text-petra-muted text-center">לא מכיר/ה את העסק? אפשר פשוט לסגור את הדף.</p>
        </form>
      )}
    </div>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-petra-bg p-4" dir="rtl">
      <Suspense>
        <InviteForm />
      </Suspense>
    </div>
  );
}
