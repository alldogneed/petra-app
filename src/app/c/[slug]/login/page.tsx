"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, KeyRound, UserRound, ArrowRight, ShieldAlert } from "lucide-react"
import { PortalButton } from "../_components/portal-ui"
import { getOrCreateDeviceId } from "@/lib/portal-device"

type LoginStep = "email" | "code" | "profile"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^05\d{8}$/

export default function PortalLoginPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const router = useRouter()

  const [step, setStep] = useState<LoginStep>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  const [emailError, setEmailError] = useState("")
  const [codeError, setCodeError] = useState("")
  const [nameError, setNameError] = useState("")
  const [phoneError, setPhoneError] = useState("")

  const [deviceNotice, setDeviceNotice] = useState("")

  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

  // resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus()
  }, [step])

  const requestOtp = useCallback(
    async (isResend = false) => {
      const trimmed = email.trim().toLowerCase()
      if (!EMAIL_RE.test(trimmed)) {
        setEmailError("כתובת אימייל לא תקינה")
        return
      }
      setEmailError("")
      setSending(true)
      try {
        const res = await fetch(`/api/portal/auth/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        })
        if (res.status === 429) {
          setEmailError("יותר מדי ניסיונות — נסו שוב בעוד כמה דקות")
          return
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setEmailError(d.error ?? "שגיאה בשליחת הקוד")
          return
        }
        setResendCooldown(30)
        if (!isResend) {
          setCode("")
          setCodeError("")
          setStep("code")
        }
      } catch {
        setEmailError("שגיאה בשליחת הקוד — בדקו את החיבור לרשת")
      } finally {
        setSending(false)
      }
    },
    [email]
  )

  const verify = useCallback(
    async (withProfile: boolean) => {
      const trimmed = email.trim().toLowerCase()
      if (code.length !== 6) {
        setCodeError("יש להזין קוד בן 6 ספרות")
        return
      }
      if (withProfile) {
        let bad = false
        if (name.trim().length < 2) {
          setNameError("יש להזין שם מלא")
          bad = true
        } else setNameError("")
        if (!PHONE_RE.test(phone.replace(/\D/g, ""))) {
          setPhoneError("מספר טלפון לא תקין (05X-XXXXXXX)")
          bad = true
        } else setPhoneError("")
        if (bad) return
      }
      setCodeError("")
      setVerifying(true)
      try {
        const body: Record<string, string> = { email: trimmed, code, slug }
        const deviceId = getOrCreateDeviceId()
        if (deviceId) body.deviceId = deviceId
        if (withProfile) {
          body.name = name.trim()
          body.phone = phone.replace(/\D/g, "")
        }
        const res = await fetch(`/api/portal/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const d = await res.json().catch(() => ({}))
        if (res.ok && d.needsProfile) {
          setStep("profile")
          return
        }
        if (res.ok && (d.user || d.portalUser || d.ok)) {
          const signedOut =
            typeof d.signedOutDevices === "number" ? d.signedOutDevices : 0
          if (signedOut > 0) {
            setDeviceNotice(
              signedOut === 1
                ? "נותקת ממכשיר אחר — חשבון זה מוגבל למספר מכשירים"
                : `נותקת מ-${signedOut} מכשירים אחרים — חשבון זה מוגבל למספר מכשירים`
            )
            setRedirecting(true)
            setTimeout(() => router.push(`/c/${slug}`), 2200)
            return
          }
          router.push(`/c/${slug}`)
          return
        }
        if (res.status === 429) {
          setCodeError("יותר מדי ניסיונות — בקשו קוד חדש")
        } else {
          setCodeError(d.error ?? "קוד שגוי או שפג תוקפו — נסו שוב")
        }
      } catch {
        setCodeError("שגיאה באימות — בדקו את החיבור לרשת")
      } finally {
        setVerifying(false)
      }
    },
    [email, code, name, phone, router, slug]
  )

  // auto-submit when 6 digits entered on the code step
  useEffect(() => {
    if (step === "code" && code.length === 6 && !verifying) {
      verify(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step])

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <Link
        href={`/c/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-petra-muted hover:text-petra-text transition-colors mb-4"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לפורטל
      </Link>

      <div className="bg-white rounded-2xl shadow-card border border-petra-border p-6">
        {/* Step 1 — email */}
        {step === "email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              requestOtp()
            }}
            className="space-y-4"
          >
            <div className="text-center mb-2">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: "var(--portal-primary)" }}
              >
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-lg font-bold text-petra-text">התחברות לפורטל</h1>
              <p className="text-sm text-petra-muted mt-1">
                נשלח לך קוד חד-פעמי למייל — בלי סיסמאות
              </p>
            </div>
            <div>
              <label htmlFor="portal-email" className="block text-sm font-medium text-petra-text mb-1.5">
                כתובת אימייל
              </label>
              <input
                id="portal-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 text-left"
              />
              {emailError && <p className="text-xs text-rose-600 mt-1.5">{emailError}</p>}
            </div>
            <PortalButton type="submit" className="w-full" loading={sending}>
              שלח קוד
            </PortalButton>
          </form>
        )}

        {/* Step 2 — code */}
        {step === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              verify(false)
            }}
            className="space-y-4"
          >
            <div className="text-center mb-2">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: "var(--portal-primary)" }}
              >
                <KeyRound className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-lg font-bold text-petra-text">הזינו את הקוד</h1>
              <p className="text-sm text-petra-muted mt-1">
                שלחנו קוד בן 6 ספרות אל <span dir="ltr">{email.trim()}</span>
              </p>
            </div>
            <div>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={6}
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl border border-petra-border text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-offset-1"
              />
              {codeError && <p className="text-xs text-rose-600 mt-1.5 text-center">{codeError}</p>}
            </div>
            <PortalButton type="submit" className="w-full" loading={verifying || redirecting}>
              אימות
            </PortalButton>
            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-petra-muted">
                  אפשר לבקש קוד חדש בעוד {resendCooldown} שניות
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => requestOtp(true)}
                  disabled={sending}
                  className="text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ color: "var(--portal-primary)" }}
                >
                  לא קיבלתי — שלחו קוד חדש
                </button>
              )}
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setStep("email")
                  setCode("")
                  setCodeError("")
                }}
                className="text-xs text-petra-muted hover:text-petra-text transition-colors"
              >
                שינוי כתובת אימייל
              </button>
            </div>
          </form>
        )}

        {/* Step 3 — profile (first login) */}
        {step === "profile" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              verify(true)
            }}
            className="space-y-4"
          >
            <div className="text-center mb-2">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: "var(--portal-primary)" }}
              >
                <UserRound className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-lg font-bold text-petra-text">נעים להכיר!</h1>
              <p className="text-sm text-petra-muted mt-1">
                עוד רגע מסיימים — נשארו רק שם וטלפון
              </p>
            </div>
            <div>
              <label htmlFor="portal-name" className="block text-sm font-medium text-petra-text mb-1.5">
                שם מלא
              </label>
              <input
                id="portal-name"
                type="text"
                autoComplete="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="השם שלך"
                className="w-full px-4 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              />
              {nameError && <p className="text-xs text-rose-600 mt-1.5">{nameError}</p>}
            </div>
            <div>
              <label htmlFor="portal-phone" className="block text-sm font-medium text-petra-text mb-1.5">
                טלפון נייד
              </label>
              <input
                id="portal-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                className="w-full px-4 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 text-left"
              />
              {phoneError && <p className="text-xs text-rose-600 mt-1.5">{phoneError}</p>}
            </div>
            {codeError && <p className="text-xs text-rose-600 text-center">{codeError}</p>}
            <PortalButton type="submit" className="w-full" loading={verifying || redirecting}>
              סיום והתחברות
            </PortalButton>
          </form>
        )}

        {/* Device-cap notice — shown when the server signed out older devices */}
        {deviceNotice && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">{deviceNotice}</p>
          </div>
        )}
      </div>
    </main>
  )
}
