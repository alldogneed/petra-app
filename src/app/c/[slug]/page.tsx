"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useBusinessLocale } from "@/hooks/useBusinessLocale"
import {
  Lock,
  LogIn,
  Video,
  GraduationCap,
  Clock,
  CreditCard,
  ChevronLeft,
  Users,
} from "lucide-react"
import {
  PortalButton,
  PortalSpinner,
  MembershipBadge,
  isActiveMembershipClient,
  type PortalMembership,
} from "./_components/portal-ui"

type BrandingData = {
  business: { name: string; logo: string | null }
  branding: {
    primaryColor: string | null
    secondaryColor: string | null
    logoUrl: string | null
    aboutText: string | null
    paymentLinkUrl: string | null
    senderName: string | null
  }
}

type MeData = {
  portalUser: { id: string; name: string; email: string; phone: string }
  membership: PortalMembership
}

type PortalClass = {
  id: string
  title: string
  description: string | null
  instructorName: string | null
  startsAt: string
  durationMin: number | null
  capacity: number
  spotsTaken: number
  myStatus: "registered" | "waitlist" | null
  zoomLink: string | null
}

type PortalCourse = {
  id: string
  title: string
  description: string | null
  coverUrl: string | null
  lessonCount: number
  hasFreePreview: boolean
}

function formatClassDate(iso: string, locale: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

export default function PortalHomePage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const t = useTranslations("portal.cDetailPage")
  const { locale } = useBusinessLocale()

  const [data, setData] = useState<BrandingData | null>(null)
  const [loadError, setLoadError] = useState("")
  const [me, setMe] = useState<MeData | null>(null)
  const [loggedOut, setLoggedOut] = useState(false)
  const [meLoaded, setMeLoaded] = useState(false)
  const [classes, setClasses] = useState<PortalClass[]>([])
  const [courses, setCourses] = useState<PortalCourse[]>([])
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    fetch(`/api/portal/${slug}/branding`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error)
        else setData(d)
      })
      .catch(() => setLoadError(t("loadError")))
  }, [slug])

  useEffect(() => {
    fetch(`/api/portal/${slug}/me`)
      .then(async (r) => {
        if (r.status === 401) {
          setLoggedOut(true)
          return
        }
        const d = await r.json()
        if (d?.portalUser) setMe(d)
        else setLoggedOut(true)
      })
      .catch(() => setLoggedOut(true))
      .finally(() => setMeLoaded(true))
  }, [slug])

  const membershipActive = isActiveMembershipClient(me?.membership ?? null)

  useEffect(() => {
    if (!membershipActive) return
    fetch(`/api/portal/${slug}/classes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.classes) setClasses(d.classes)
      })
      .catch(() => {})
    fetch(`/api/portal/${slug}/courses`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.courses) setCourses(d.courses)
      })
      .catch(() => {})
  }, [slug, membershipActive])

  const requestMembership = useCallback(async () => {
    setRequesting(true)
    try {
      const res = await fetch(`/api/portal/${slug}/membership/request`, { method: "POST" })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.error ?? t("requestError"))
      } else {
        toast.success(t("requestSent"))
        if (d.membership) {
          setMe((prev) => (prev ? { ...prev, membership: d.membership } : prev))
        }
      }
    } catch {
      toast.error(t("requestError"))
    } finally {
      setRequesting(false)
    }
  }, [slug, t])

  if (loadError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-petra-text mb-2">{t("notFound.title")}</h1>
          <p className="text-sm text-petra-muted">{t("notFound.body")}</p>
        </div>
      </div>
    )
  }

  if (!data || !meLoaded) return <PortalSpinner />

  const logoSrc = data.branding.logoUrl || data.business.logo || "/logo.svg"
  const membership = me?.membership ?? null
  const paymentLink = data.branding.paymentLinkUrl
  const showPaymentLink =
    !!paymentLink &&
    (!membership ||
      membership.status === "expired" ||
      membership.status === "suspended" ||
      (membership.status === "active" && !isActiveMembershipClient(membership)))

  const now = Date.now()
  const upcoming = classes
    .filter((c) => new Date(c.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 3)

  return (
    <main className="pb-4">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-petra-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt={data.business.name}
            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-petra-text text-sm leading-tight truncate">
              {data.business.name}
            </h1>
            <p className="text-xs text-petra-muted">{t("membersPortal")}</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Hero / about */}
        {data.branding.aboutText && (
          <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5">
            <p className="text-sm text-petra-text leading-relaxed whitespace-pre-wrap">
              {data.branding.aboutText}
            </p>
          </div>
        )}

        {/* Membership state card */}
        <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5">
          <h2 className="font-bold text-petra-text mb-3">{t("membership.title")}</h2>

          {loggedOut ? (
            <div className="space-y-3">
              <p className="text-sm text-petra-muted">
                {t("membership.loginHint")}
              </p>
              <Link href={`/c/${slug}/login`}>
                <PortalButton className="w-full">
                  <LogIn className="w-4 h-4" />
                  {t("membership.login")}
                </PortalButton>
              </Link>
            </div>
          ) : !membership ? (
            <div className="space-y-3">
              <p className="text-sm text-petra-muted">
                {t("membership.noMembership", { name: me?.portalUser.name ?? "", business: data.business.name })}
              </p>
              <PortalButton className="w-full" onClick={requestMembership} loading={requesting}>
                {t("membership.requestJoin")}
              </PortalButton>
              {showPaymentLink && (
                <a
                  href={paymentLink!}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-petra-border text-sm font-semibold text-petra-text hover:bg-slate-50 transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  {t("membership.pay")}
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <MembershipBadge membership={membership} />
              {membership.status === "pending" && (
                <p className="text-sm text-petra-muted">
                  {t("membership.pendingNote")}
                </p>
              )}
              {showPaymentLink && (
                <a
                  href={paymentLink!}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-petra-border text-sm font-semibold text-petra-text hover:bg-slate-50 transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  {t("membership.pay")}
                </a>
              )}
            </div>
          )}
        </div>

        {membershipActive ? (
          <>
            {/* Upcoming classes */}
            <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-petra-text flex items-center gap-2">
                  <Video className="w-4 h-4" style={{ color: "var(--portal-primary)" }} />
                  {t("classes.title")}
                </h2>
                <Link
                  href={`/c/${slug}/classes`}
                  className="text-sm font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                  style={{ color: "var(--portal-primary)" }}
                >
                  {t("classes.viewAll")}
                  <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-petra-muted py-2">{t("classes.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((c) => {
                    const spotsLeft = Math.max(0, c.capacity - c.spotsTaken)
                    return (
                      <Link
                        key={c.id}
                        href={`/c/${slug}/classes`}
                        className="block border border-petra-border rounded-xl p-3 hover:shadow-card transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-petra-text truncate">
                              {c.title}
                            </p>
                            <p className="text-xs text-petra-muted mt-0.5">
                              {formatClassDate(c.startsAt, locale)}
                            </p>
                          </div>
                          {c.myStatus === "registered" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                              {t("classes.registered")}
                            </span>
                          ) : c.myStatus === "waitlist" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                              {t("classes.waitlist")}
                            </span>
                          ) : (
                            <span className="text-xs text-petra-muted flex items-center gap-1 flex-shrink-0">
                              <Users className="w-3 h-3" />
                              {spotsLeft > 0 ? t("classes.spotsLeft", { count: spotsLeft }) : t("classes.full")}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Courses preview */}
            <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-petra-text flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" style={{ color: "var(--portal-primary)" }} />
                  {t("courses.title")}
                </h2>
                <Link
                  href={`/c/${slug}/courses`}
                  className="text-sm font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                  style={{ color: "var(--portal-primary)" }}
                >
                  {t("courses.viewAll")}
                  <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
                </Link>
              </div>
              {courses.length === 0 ? (
                <p className="text-sm text-petra-muted py-2">{t("courses.empty")}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {courses.slice(0, 4).map((course) => (
                    <Link
                      key={course.id}
                      href={`/c/${slug}/courses/${course.id}`}
                      className="border border-petra-border rounded-xl overflow-hidden hover:shadow-card transition-shadow"
                    >
                      {course.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.coverUrl}
                          alt={course.title}
                          className="w-full h-20 object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-20 flex items-center justify-center"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--portal-primary), var(--portal-secondary))",
                          }}
                        >
                          <GraduationCap className="w-7 h-7 text-white/80" />
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="font-semibold text-xs text-petra-text truncate">
                          {course.title}
                        </p>
                        <p className="text-[11px] text-petra-muted mt-0.5">
                          {t("courses.lessonCount", { count: course.lessonCount })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Teaser for non-active members */
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5 flex items-center gap-4 opacity-80">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-petra-text flex items-center gap-1.5">
                  {t("teaser.liveTitle")}
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </p>
                <p className="text-xs text-petra-muted mt-0.5">
                  {t("teaser.liveBody")}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5 flex items-center gap-4 opacity-80">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-petra-text flex items-center gap-1.5">
                  {t("teaser.coursesTitle")}
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </p>
                <p className="text-xs text-petra-muted mt-0.5">
                  {t("teaser.coursesBody")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-petra-muted px-1">
              <Clock className="w-3.5 h-3.5" />
              {loggedOut
                ? t("teaser.loggedOutHint")
                : t("teaser.pendingHint")}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
