"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { localeFromBusiness } from "@/lib/locale"
import { ArrowRight, Calendar, Clock, Users, Video, UserRound } from "lucide-react"
import {
  PortalButton,
  PortalSpinner,
  isActiveMembershipClient,
  type PortalMembership,
} from "../_components/portal-ui"

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

function formatDateParts(iso: string, locale: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  }
}

export default function PortalClassesPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const router = useRouter()
  const t = useTranslations("portal.detailClassesPage")
  const locale = localeFromBusiness({ locale: useLocale() })

  const [classes, setClasses] = useState<PortalClass[] | null>(null)
  const [membership, setMembership] = useState<PortalMembership>(null)
  const [meLoaded, setMeLoaded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadClasses = useCallback(async () => {
    const res = await fetch(`/api/portal/${slug}/classes`)
    if (res.status === 401) {
      router.replace(`/c/${slug}/login`)
      return
    }
    const d = await res.json().catch(() => null)
    setClasses(d?.classes ?? [])
  }, [slug, router])

  useEffect(() => {
    loadClasses()
    fetch(`/api/portal/${slug}/me`)
      .then(async (r) => {
        if (r.status === 401) {
          router.replace(`/c/${slug}/login`)
          return
        }
        const d = await r.json().catch(() => null)
        setMembership(d?.membership ?? null)
      })
      .catch(() => {})
      .finally(() => setMeLoaded(true))
  }, [slug, router, loadClasses])

  const membershipActive = isActiveMembershipClient(membership)

  const register = useCallback(
    async (cls: PortalClass) => {
      setBusyId(cls.id)
      try {
        const res = await fetch(`/api/portal/${slug}/classes/${cls.id}/register`, {
          method: "POST",
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(d.error ?? t("toasts.registerError"))
          return
        }
        if (d.status === "waitlist") {
          toast(t("toasts.waitlisted"))
        } else {
          toast.success(t("toasts.registered"))
        }
        await loadClasses()
      } catch {
        toast.error(t("toasts.registerError"))
      } finally {
        setBusyId(null)
      }
    },
    [slug, loadClasses, t]
  )

  const cancel = useCallback(
    async (cls: PortalClass) => {
      if (!window.confirm(t("confirmCancel", { title: cls.title }))) return
      setBusyId(cls.id)
      try {
        const res = await fetch(`/api/portal/${slug}/classes/${cls.id}/cancel`, {
          method: "POST",
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(d.error ?? t("toasts.cancelError"))
          return
        }
        toast.success(t("toasts.canceled"))
        await loadClasses()
      } catch {
        toast.error(t("toasts.cancelError"))
      } finally {
        setBusyId(null)
      }
    },
    [slug, loadClasses, t]
  )

  if (classes === null || !meLoaded) return <PortalSpinner />

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <Link
        href={`/c/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-petra-muted hover:text-petra-text transition-colors mb-3"
      >
        <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
        {t("backToPortal")}
      </Link>

      <h1 className="text-xl font-bold text-petra-text mb-4">{t("title")}</h1>

      {!membershipActive && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {t("membersOnly")}{" "}
          <Link href={`/c/${slug}`} className="font-semibold underline underline-offset-2">
            {t("requestToJoin")}
          </Link>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-petra-border p-8 text-center">
          <Video className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-petra-muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => {
            const { date, time } = formatDateParts(cls.startsAt, locale)
            const spotsLeft = Math.max(0, cls.capacity - cls.spotsTaken)
            const isFull = spotsLeft === 0
            const busy = busyId === cls.id
            return (
              <div
                key={cls.id}
                className="bg-white rounded-2xl shadow-card border border-petra-border p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="font-bold text-petra-text">{cls.title}</h2>
                  {cls.myStatus === "registered" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0 font-medium">
                      {t("status.registered")}
                    </span>
                  )}
                  {cls.myStatus === "waitlist" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0 font-medium">
                      {t("status.waitlist")}
                    </span>
                  )}
                </div>

                {cls.description && (
                  <p className="text-sm text-petra-muted mb-3 whitespace-pre-wrap">
                    {cls.description}
                  </p>
                )}

                <div className="space-y-1.5 text-sm text-petra-text mb-4">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-petra-muted flex-shrink-0" />
                    {date} · {time}
                  </p>
                  {cls.durationMin != null && (
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-petra-muted flex-shrink-0" />
                      {t("durationMinutes", { count: cls.durationMin })}
                    </p>
                  )}
                  {cls.instructorName && (
                    <p className="flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-petra-muted flex-shrink-0" />
                      {cls.instructorName}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-petra-muted flex-shrink-0" />
                    {isFull ? (
                      <span className="text-amber-700 font-medium">{t("fullWaitlist")}</span>
                    ) : (
                      t("spotsLeft", { count: spotsLeft })
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {cls.zoomLink && cls.myStatus === "registered" && (
                    <a
                      href={cls.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ backgroundColor: "var(--portal-primary)" }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold hover:brightness-95 transition-all"
                    >
                      <Video className="w-4 h-4" />
                      {t("joinZoom")}
                    </a>
                  )}

                  {cls.myStatus === null && membershipActive && (
                    <PortalButton className="w-full" loading={busy} onClick={() => register(cls)}>
                      {isFull ? t("actions.joinWaitlist") : t("actions.register")}
                    </PortalButton>
                  )}

                  {(cls.myStatus === "registered" || cls.myStatus === "waitlist") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cancel(cls)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-petra-border text-sm font-semibold text-petra-muted hover:bg-slate-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                    >
                      {busy && (
                        <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                      )}
                      {t("actions.cancelRegistration")}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
