"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Lock,
  FileText,
  PlayCircle,
  AlignRight,
  ListChecks,
  GraduationCap,
} from "lucide-react"
import { PortalSpinner } from "../../_components/portal-ui"
import { LessonQA } from "@/components/portal/LessonQA"
import { QuizRunner } from "@/components/portal/QuizRunner"

type PortalLesson = {
  id: string
  title: string
  description?: string | null
  type: string | null
  provider?: string | null
  videoRef?: string | null
  fileUrl?: string | null
  textContent?: string | null
  durationMin?: number | null
  isFreePreview?: boolean
  locked?: boolean
}

type PortalModuleQuiz = {
  id: string
  title: string
  passScore: number
}

type PortalModule = {
  id: string
  title: string
  lessons: PortalLesson[]
  quiz?: PortalModuleQuiz | null
}

type PortalCertificate = {
  id: string
  courseId: string
  serial: string
  studentName: string
  courseTitle: string
  issuedAt: string
  verifyUrl: string
}

type PortalCourseTree = {
  id: string
  title: string
  description: string | null
  modules: PortalModule[]
}

type PortalProgressDetail = {
  lessonId: string
  percent: number
  completedAt: string | null
}

function isLocked(lesson: PortalLesson): boolean {
  if (lesson.locked === true) return true
  return !lesson.videoRef && !lesson.fileUrl && !lesson.textContent
}

function lessonKind(lesson: PortalLesson): "video" | "pdf" | "text" {
  const t = (lesson.type ?? "").toLowerCase()
  if (t === "pdf") return "pdf"
  if (t === "text") return "text"
  return "video"
}

/* ------------------------------------------------------------------ */
/* YouTube IFrame API loader (single global load, cooperative callback) */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

const YT_API_TIMEOUT_MS = 6000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ytApiPromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no-window"))
  }
  if (window.YT && typeof window.YT.Player === "function") {
    return Promise.resolve(window.YT)
  }
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      if (window.YT && typeof window.YT.Player === "function") {
        settled = true
        window.clearInterval(poll)
        resolve(window.YT)
      }
    }

    // Cooperative global callback — never clobber an existing one.
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof previous === "function") previous()
      } catch {
        /* ignore third-party callback errors */
      }
      finish()
    }

    try {
      const existing = document.querySelector("script[data-petra-yt-api]")
      if (!existing) {
        const script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        script.async = true
        script.setAttribute("data-petra-yt-api", "1")
        script.onerror = () => {
          if (settled) return
          settled = true
          window.clearInterval(poll)
          reject(new Error("yt-api-load-error"))
        }
        document.head.appendChild(script)
      }
    } catch {
      settled = true
      reject(new Error("yt-api-inject-error"))
      return
    }

    const startedAt = Date.now()
    const poll = window.setInterval(() => {
      if (settled) {
        window.clearInterval(poll)
        return
      }
      if (window.YT && typeof window.YT.Player === "function") {
        finish()
        return
      }
      if (Date.now() - startedAt > YT_API_TIMEOUT_MS) {
        settled = true
        window.clearInterval(poll)
        reject(new Error("yt-api-timeout"))
      }
    }, 200)
  })

  ytApiPromise.catch(() => {
    // allow a later retry (e.g. after a transient network failure)
    ytApiPromise = null
  })

  return ytApiPromise
}

/* ------------------------------------------------------------------ */
/* Video lesson player with seek-proof watch tracking                  */
/* ------------------------------------------------------------------ */

const SAMPLE_MS = 1000
const POST_EVERY_MS = 10000

function VideoLessonPlayer({
  slug,
  lessonId,
  videoRef: videoId,
  title,
  initialPercent,
  alreadyCompleted,
  onPercentChange,
  onCompleted,
  onFallbackChange,
}: {
  slug: string
  lessonId: string
  videoRef: string
  title: string
  initialPercent: number
  alreadyCompleted: boolean
  onPercentChange: (lessonId: string, percent: number) => void
  onCompleted: (lessonId: string) => void
  onFallbackChange: (fallback: boolean) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)
  const watchedRef = useRef<Set<number>>(new Set())
  const durationRef = useRef<number>(0)
  const seededRef = useRef(false)
  const readyRef = useRef(false)
  const completedRef = useRef(alreadyCompleted)
  const lastSentValueRef = useRef<number>(-1)
  const lastSentAtRef = useRef<number>(0)
  const sampleTimerRef = useRef<number | null>(null)
  const reportedPercentRef = useRef<number>(Math.round(initialPercent))

  const [fallback, setFallback] = useState(false)
  const [watchPercent, setWatchPercent] = useState<number>(Math.round(initialPercent))

  // keep latest callbacks without re-running the player effect
  const onPercentChangeRef = useRef(onPercentChange)
  const onCompletedRef = useRef(onCompleted)
  const onFallbackChangeRef = useRef(onFallbackChange)
  useEffect(() => {
    onPercentChangeRef.current = onPercentChange
    onCompletedRef.current = onCompleted
    onFallbackChangeRef.current = onFallbackChange
  }, [onPercentChange, onCompleted, onFallbackChange])

  useEffect(() => {
    completedRef.current = alreadyCompleted
  }, [alreadyCompleted])

  const currentWatchedSeconds = useCallback(() => {
    const duration = durationRef.current
    const watched = watchedRef.current.size
    if (duration > 0) return Math.min(watched, Math.ceil(duration))
    return watched
  }, [])

  const sendProgress = useCallback(
    (useBeacon: boolean) => {
      const durationSeconds = Math.round(durationRef.current)
      if (!durationSeconds || durationSeconds <= 0) return
      const watchedSeconds = currentWatchedSeconds()
      if (watchedSeconds <= 0) return
      if (watchedSeconds === lastSentValueRef.current) return
      if (completedRef.current) return

      lastSentValueRef.current = watchedSeconds
      lastSentAtRef.current = Date.now()

      const url = `/api/portal/${slug}/lessons/${lessonId}/progress`
      const body = JSON.stringify({ watchedSeconds, durationSeconds })

      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
          return
        } catch {
          /* fall through to fetch */
        }
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json().catch(() => null)
          if (!data) return
          if (typeof data.percent === "number") {
            const pct = Math.max(0, Math.min(100, Math.round(data.percent)))
            setWatchPercent((prev) => (pct > prev ? pct : prev))
          }
          if (data.completed === true && !completedRef.current) {
            completedRef.current = true
            onCompletedRef.current(lessonId)
          }
        })
        .catch(() => {
          // network hiccup — allow a retry on the next tick
          lastSentValueRef.current = -1
        })
    },
    [slug, lessonId, currentWatchedSeconds]
  )

  const stopSampling = useCallback(() => {
    if (sampleTimerRef.current != null) {
      window.clearInterval(sampleTimerRef.current)
      sampleTimerRef.current = null
    }
  }, [])

  const sampleOnce = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    let t: number | null = null
    try {
      if (typeof player.getCurrentTime === "function") {
        const v = player.getCurrentTime()
        if (typeof v === "number" && isFinite(v) && v >= 0) t = v
      }
      if (!durationRef.current && typeof player.getDuration === "function") {
        const d = player.getDuration()
        if (typeof d === "number" && isFinite(d) && d > 0) durationRef.current = d
      }
    } catch {
      return
    }
    if (t == null) return

    // seed the watched buckets from the server-side percent once duration is known
    if (!seededRef.current && durationRef.current > 0) {
      seededRef.current = true
      const seedSeconds = Math.floor((Math.max(0, Math.min(100, initialPercent)) * durationRef.current) / 100)
      for (let i = 0; i < seedSeconds; i++) watchedRef.current.add(i)
    }

    watchedRef.current.add(Math.floor(t))

    const duration = durationRef.current
    if (duration > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((currentWatchedSeconds() / duration) * 100)))
      if (pct !== reportedPercentRef.current) {
        reportedPercentRef.current = pct
        setWatchPercent((prev) => (pct > prev ? pct : prev))
        onPercentChangeRef.current(lessonId, pct)
      }
    }

    if (Date.now() - lastSentAtRef.current >= POST_EVERY_MS) {
      sendProgress(false)
    }
  }, [initialPercent, lessonId, currentWatchedSeconds, sendProgress])

  const startSampling = useCallback(() => {
    stopSampling()
    sampleTimerRef.current = window.setInterval(sampleOnce, SAMPLE_MS)
  }, [sampleOnce, stopSampling])

  // Empties the player container. YT.Player REPLACES the div we hand it with
  // its own iframe, so the node we appended is no longer ours to remove — and
  // destroy() is a no-op on a player that errored before it was ready. Without
  // this, iframes pile up in the container and the student sees two videos.
  const clearHost = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    try {
      while (host.firstChild) host.removeChild(host.firstChild)
    } catch {
      /* ignore */
    }
  }, [])

  // create / destroy the player for this lesson
  useEffect(() => {
    let cancelled = false
    let mountedEl: HTMLDivElement | null = null

    const failTimer = window.setTimeout(() => {
      if (cancelled || readyRef.current) return
      setFallback(true)
      onFallbackChangeRef.current(true)
    }, YT_API_TIMEOUT_MS)

    loadYouTubeApi()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((YT: any) => {
        if (cancelled) return
        if (!hostRef.current || !YT || typeof YT.Player !== "function") {
          setFallback(true)
          onFallbackChangeRef.current(true)
          return
        }
        try {
          // drop anything a previous player left behind — YT.destroy() can
          // silently fail on an errored player and orphan its iframe here
          clearHost()
          mountedEl = document.createElement("div")
          mountedEl.style.width = "100%"
          mountedEl.style.height = "100%"
          hostRef.current.appendChild(mountedEl)

          playerRef.current = new YT.Player(mountedEl, {
            host: "https://www.youtube-nocookie.com",
            videoId,
            width: "100%",
            height: "100%",
            playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
            events: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onReady: (e: any) => {
                readyRef.current = true
                window.clearTimeout(failTimer)
                try {
                  const d = e?.target?.getDuration?.()
                  if (typeof d === "number" && isFinite(d) && d > 0) durationRef.current = d
                  const frame = e?.target?.getIframe?.()
                  if (frame) {
                    frame.style.width = "100%"
                    frame.style.height = "100%"
                    frame.setAttribute("title", title)
                  }
                } catch {
                  /* ignore */
                }
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onStateChange: (e: any) => {
                const state = e?.data
                const States = YT.PlayerState ?? {}
                if (state === States.PLAYING) {
                  try {
                    const d = e?.target?.getDuration?.()
                    if (typeof d === "number" && isFinite(d) && d > 0) durationRef.current = d
                  } catch {
                    /* ignore */
                  }
                  startSampling()
                } else if (state === States.PAUSED || state === States.ENDED) {
                  stopSampling()
                  sampleOnce()
                  sendProgress(false)
                } else if (state === States.BUFFERING) {
                  // keep sampling — buffering resumes on its own
                }
              },
              onError: () => {
                stopSampling()
                try {
                  if (playerRef.current && typeof playerRef.current.destroy === "function") {
                    playerRef.current.destroy()
                  }
                } catch {
                  /* ignore */
                }
                playerRef.current = null
                setFallback(true)
                onFallbackChangeRef.current(true)
              },
            },
          })
        } catch {
          setFallback(true)
          onFallbackChangeRef.current(true)
        }
      })
      .catch(() => {
        if (cancelled) return
        setFallback(true)
        onFallbackChangeRef.current(true)
      })

    return () => {
      cancelled = true
      window.clearTimeout(failTimer)
      stopSampling()
      // final flush for this lesson before teardown
      try {
        sendProgress(false)
      } catch {
        /* ignore */
      }
      try {
        if (playerRef.current && typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy()
        }
      } catch {
        /* ignore */
      }
      playerRef.current = null
      readyRef.current = false
      try {
        if (mountedEl && mountedEl.parentNode) mountedEl.parentNode.removeChild(mountedEl)
      } catch {
        /* ignore */
      }
      clearHost()
    }
    // videoId/lessonId change → full teardown + rebuild
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, lessonId])

  // falling back to the plain embed → kill the API player and its iframe so
  // only one video is ever on screen
  useEffect(() => {
    if (!fallback) return
    stopSampling()
    try {
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy()
      }
    } catch {
      /* ignore */
    }
    playerRef.current = null
    readyRef.current = false
    clearHost()
  }, [fallback, stopSampling, clearHost])

  // flush on tab hide / page unload
  useEffect(() => {
    const onHide = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        stopSampling()
        sampleOnce()
        sendProgress(true)
      }
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onHide)
    }
  }, [sampleOnce, sendProgress, stopSampling])

  return (
    <>
      {!fallback && (
        <div
          ref={hostRef}
          className="w-full aspect-video rounded-2xl border border-petra-border bg-black overflow-hidden"
        />
      )}
      {fallback && (
        <iframe
          key={videoId}
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full aspect-video rounded-2xl border border-petra-border bg-black"
        />
      )}

      {!fallback && (
        <div className="bg-white rounded-2xl shadow-card border border-petra-border px-4 py-3">
          {alreadyCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              הושלם ✓
            </span>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-petra-muted mb-1.5">
                <span>נצפו {watchPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${watchPercent}%`,
                    backgroundColor: "var(--portal-primary)",
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PortalCoursePlayerPage({
  params,
}: {
  params: { slug: string; courseId: string }
}) {
  const { slug, courseId } = params
  const router = useRouter()

  const [course, setCourse] = useState<PortalCourseTree | null>(null)
  const [loadError, setLoadError] = useState("")
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [watchPercents, setWatchPercents] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [videoFallback, setVideoFallback] = useState(false)
  const [certificate, setCertificate] = useState<PortalCertificate | null>(null)

  // default-lesson selection happens only on the very first load — a refetch
  // (e.g. after passing a quiz) must not yank the student back to lesson #1
  const initialSelectionDoneRef = useRef(false)
  const certificateRequestedRef = useRef(false)

  // if the router reuses this component for another course, start clean
  useEffect(() => {
    initialSelectionDoneRef.current = false
    certificateRequestedRef.current = false
    setCertificate(null)
  }, [courseId])

  const loadCourse = useCallback(async () => {
    try {
      const r = await fetch(`/api/portal/${slug}/courses/${courseId}`)
      if (r.status === 401) {
        router.replace(`/c/${slug}/login`)
        return
      }
      if (!r.ok) {
        setLoadError("הקורס לא נמצא")
        return
      }
      const d = await r.json().catch(() => null)
      const tree: PortalCourseTree | null = d?.course ?? (d?.modules ? d : null)
      if (!tree) {
        setLoadError("הקורס לא נמצא")
        return
      }
      setCourse(tree)
      setCompleted(new Set<string>(d?.myProgress ?? []))

      // optional progressDetail — fall back to myProgress-only behaviour
      const detail: PortalProgressDetail[] = Array.isArray(d?.progressDetail)
        ? d.progressDetail
        : []
      if (detail.length > 0) {
        const map: Record<string, number> = {}
        for (const row of detail) {
          if (!row || typeof row.lessonId !== "string") continue
          const pct = Number(row.percent)
          map[row.lessonId] = Number.isFinite(pct)
            ? Math.max(0, Math.min(100, Math.round(pct)))
            : 0
        }
        setWatchPercents(map)
      }

      // default: first unlocked lesson
      if (!initialSelectionDoneRef.current) {
        initialSelectionDoneRef.current = true
        const firstUnlocked = tree.modules
          .flatMap((m) => m.lessons)
          .find((l) => !isLocked(l))
        const first = firstUnlocked ?? tree.modules.flatMap((m) => m.lessons)[0]
        if (first) setSelectedId(first.id)
      }
    } catch {
      setLoadError("שגיאה בטעינת הקורס")
    }
  }, [slug, courseId, router])

  useEffect(() => {
    void loadCourse()
  }, [loadCourse])

  // reset the API-fallback flag whenever the student switches lesson
  useEffect(() => {
    setVideoFallback(false)
  }, [selectedId])

  const allLessons = useMemo(
    () => (course ? course.modules.flatMap((m) => m.lessons) : []),
    [course]
  )
  const selected = allLessons.find((l) => l.id === selectedId) ?? null
  const total = allLessons.length
  const done = allLessons.filter((l) => completed.has(l.id)).length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const courseComplete = total > 0 && done >= total

  // Certificate — asked for exactly once, only when the course is complete.
  // Any failure is swallowed: the page must keep working without it.
  useEffect(() => {
    if (!courseComplete) return
    if (certificateRequestedRef.current) return
    certificateRequestedRef.current = true

    let cancelled = false
    fetch(`/api/portal/${slug}/courses/${courseId}/certificate`)
      .then(async (r) => {
        if (!r.ok) return
        const d = await r.json().catch(() => null)
        const cert = d?.certificate
        if (!cancelled && cert && typeof cert.verifyUrl === "string") {
          setCertificate(cert as PortalCertificate)
        }
      })
      .catch(() => {
        /* never break the player over a certificate */
      })

    return () => {
      cancelled = true
    }
  }, [courseComplete, slug, courseId])

  const selectLesson = useCallback((lessonId: string) => {
    setSelectedQuizId(null)
    setSelectedId(lessonId)
  }, [])

  const selectQuiz = useCallback((quizId: string) => {
    setSelectedId(null)
    setSelectedQuizId(quizId)
  }, [])

  const handlePercentChange = useCallback((lessonId: string, pct: number) => {
    setWatchPercents((prev) => {
      const current = prev[lessonId] ?? 0
      if (pct <= current) return prev
      return { ...prev, [lessonId]: pct }
    })
  }, [])

  const handleVideoCompleted = useCallback((lessonId: string) => {
    setCompleted((prev) => {
      if (prev.has(lessonId)) return prev
      const next = new Set(prev)
      next.add(lessonId)
      return next
    })
    setWatchPercents((prev) => ({ ...prev, [lessonId]: 100 }))
  }, [])

  const markComplete = useCallback(async () => {
    if (!selected || completed.has(selected.id)) return
    setMarking(true)
    // optimistic
    setCompleted((prev) => new Set(prev).add(selected.id))
    try {
      const res = await fetch(`/api/portal/${slug}/lessons/${selected.id}/complete`, {
        method: "POST",
      })
      if (!res.ok) {
        setCompleted((prev) => {
          const next = new Set(prev)
          next.delete(selected.id)
          return next
        })
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "שגיאה בסימון השיעור")
      }
    } catch {
      setCompleted((prev) => {
        const next = new Set(prev)
        next.delete(selected.id)
        return next
      })
      toast.error("שגיאה בסימון השיעור")
    } finally {
      setMarking(false)
    }
  }, [selected, completed, slug])

  if (loadError) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10 text-center">
        <h1 className="text-lg font-bold text-petra-text mb-2">{loadError}</h1>
        <Link
          href={`/c/${slug}/courses`}
          className="text-sm font-medium underline underline-offset-2"
          style={{ color: "var(--portal-primary)" }}
        >
          חזרה לרשימת הקורסים
        </Link>
      </main>
    )
  }

  if (!course) return <PortalSpinner />

  const selectedLocked = selected ? isLocked(selected) : false
  const selectedKind = selected ? lessonKind(selected) : "video"
  const isDone = selected ? completed.has(selected.id) : false
  const selectedDescription = (selected?.description ?? "").trim()
  // video lessons earn completion by watching; the manual button only returns
  // for pdf/text lessons or when the IFrame API failed to load.
  const showManualButton = selectedKind !== "video" || videoFallback

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/c/${slug}/courses`}
        className="inline-flex items-center gap-1 text-sm text-petra-muted hover:text-petra-text transition-colors mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        לכל הקורסים
      </Link>

      <h1 className="text-xl font-bold text-petra-text mb-3">{course.title}</h1>

      {/* Course completed → certificate */}
      {certificate && (
        <div className="mb-5 bg-white rounded-2xl shadow-card border border-petra-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--portal-primary)" }}
          >
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <p className="flex-1 min-w-0 text-sm font-bold text-petra-text">
            סיימת את הקורס! התעודה שלך מוכנה
          </p>
          <a
            href={certificate.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: "var(--portal-primary)" }}
            className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            לצפייה בתעודה
          </a>
        </div>
      )}

      {/* Course-level progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-petra-muted mb-1.5">
          <span>
            הושלמו {done} מתוך {total} שיעורים
          </span>
          <span className="font-semibold" style={{ color: "var(--portal-primary)" }}>
            {percent}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, backgroundColor: "var(--portal-primary)" }}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Lesson list — right column on desktop (order-1 in RTL flex-row), below player on mobile */}
        <aside className="order-2 md:order-1 w-full md:w-72 lg:w-80 flex-shrink-0 space-y-4">
          {course.modules.map((mod) => (
            <div
              key={mod.id}
              className="bg-white rounded-2xl shadow-card border border-petra-border overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-petra-border bg-slate-50">
                <h2 className="text-sm font-bold text-petra-text">{mod.title}</h2>
              </div>
              <ul>
                {mod.lessons.map((lesson) => {
                  const locked = isLocked(lesson)
                  const lessonDone = completed.has(lesson.id)
                  const isSelected = lesson.id === selectedId
                  const lessonPct = watchPercents[lesson.id] ?? 0
                  const showPct = !lessonDone && !locked && lessonPct > 0
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => selectLesson(lesson.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-right text-sm transition-colors border-b border-petra-border/60 last:border-b-0 ${
                          isSelected ? "bg-slate-50 font-semibold" : "hover:bg-slate-50/60"
                        } ${locked ? "text-petra-muted" : "text-petra-text"}`}
                      >
                        {lessonDone ? (
                          <CheckCircle2
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--portal-primary)" }}
                          />
                        ) : locked ? (
                          <Lock className="w-4 h-4 flex-shrink-0 text-slate-400" />
                        ) : (
                          <Circle className="w-4 h-4 flex-shrink-0 text-slate-300" />
                        )}
                        <span className="flex-1 min-w-0 truncate">{lesson.title}</span>
                        {showPct && (
                          <span className="text-xs text-petra-muted flex-shrink-0">
                            {lessonPct}%
                          </span>
                        )}
                        {lesson.durationMin != null && (
                          <span className="text-[11px] text-petra-muted flex-shrink-0">
                            {lesson.durationMin} דק׳
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}

                {mod.quiz && (
                  <li key={`quiz-${mod.quiz.id}`}>
                    <button
                      type="button"
                      onClick={() => selectQuiz(mod.quiz!.id)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-right text-sm transition-colors border-t border-petra-border/60 ${
                        selectedQuizId === mod.quiz.id
                          ? "bg-slate-50 font-semibold"
                          : "hover:bg-slate-50/60"
                      } text-petra-text`}
                    >
                      <ListChecks
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "var(--portal-primary)" }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{mod.quiz.title}</span>
                        <span className="block text-[11px] text-petra-muted font-normal">
                          בוחן · ציון עובר {mod.quiz.passScore}%
                        </span>
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </aside>

        {/* Player area — top on mobile, left column on desktop */}
        <section className="order-1 md:order-2 flex-1 w-full min-w-0">
          {selectedQuizId ? (
            <QuizRunner
              key={selectedQuizId}
              slug={slug}
              quizId={selectedQuizId}
              onPassed={() => {
                void loadCourse()
              }}
            />
          ) : !selected ? (
            <div className="bg-white rounded-2xl shadow-card border border-petra-border p-8 text-center">
              <p className="text-sm text-petra-muted">אין שיעורים בקורס הזה עדיין</p>
            </div>
          ) : selectedLocked ? (
            <div className="bg-white rounded-2xl shadow-card border border-petra-border p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-slate-400" />
              </div>
              <h2 className="font-bold text-petra-text mb-1">נדרש מנוי פעיל לצפייה</h2>
              <p className="text-sm text-petra-muted mb-4">
                השיעור הזה פתוח למנויים פעילים בלבד
              </p>
              <Link
                href={`/c/${slug}`}
                style={{ backgroundColor: "var(--portal-primary)" }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-95 transition-all"
              >
                לבקשת הצטרפות
              </Link>
            </div>
          ) : (
            <div key={selected.id} className="space-y-4">
              {selectedKind === "video" && selected.videoRef && (
                <VideoLessonPlayer
                  key={selected.id}
                  slug={slug}
                  lessonId={selected.id}
                  videoRef={selected.videoRef}
                  title={selected.title}
                  initialPercent={watchPercents[selected.id] ?? 0}
                  alreadyCompleted={isDone}
                  onPercentChange={handlePercentChange}
                  onCompleted={handleVideoCompleted}
                  onFallbackChange={setVideoFallback}
                />
              )}

              {selectedKind === "pdf" && selected.fileUrl && (
                <div className="bg-white rounded-2xl shadow-card border border-petra-border p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-sm text-petra-muted mb-4">שיעור זה כולל קובץ PDF לצפייה</p>
                  <a
                    href={selected.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ backgroundColor: "var(--portal-primary)" }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-95 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    פתח PDF
                  </a>
                </div>
              )}

              {selectedKind === "text" && selected.textContent && (
                <div className="bg-white rounded-2xl shadow-card border border-petra-border p-6">
                  <div className="flex items-center gap-2 text-petra-muted mb-3">
                    <AlignRight className="w-4 h-4" />
                    <span className="text-xs font-medium">שיעור טקסט</span>
                  </div>
                  <div className="text-sm text-petra-text leading-relaxed whitespace-pre-wrap">
                    {selected.textContent}
                  </div>
                </div>
              )}

              {/* Fallback when type/content mismatch */}
              {((selectedKind === "video" && !selected.videoRef) ||
                (selectedKind === "pdf" && !selected.fileUrl) ||
                (selectedKind === "text" && !selected.textContent)) && (
                <div className="bg-white rounded-2xl shadow-card border border-petra-border p-8 text-center">
                  <PlayCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-petra-muted">התוכן של השיעור הזה עדיין לא זמין</p>
                </div>
              )}

              {/* Lesson title + description + completion control */}
              <div className="bg-white rounded-2xl shadow-card border border-petra-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-petra-text truncate">{selected.title}</h2>
                    {selected.durationMin != null && (
                      <p className="text-xs text-petra-muted mt-0.5">
                        {selected.durationMin} דקות
                      </p>
                    )}
                  </div>

                  {showManualButton ? (
                    <button
                      type="button"
                      onClick={markComplete}
                      disabled={marking || isDone}
                      className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:cursor-default ${
                        isDone
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-white hover:brightness-95"
                      }`}
                      style={isDone ? undefined : { backgroundColor: "var(--portal-primary)" }}
                    >
                      {isDone ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          הושלם ✓
                        </>
                      ) : (
                        "סמן כהושלם"
                      )}
                    </button>
                  ) : isDone && !selected.videoRef ? (
                    /* completed video whose player isn't rendered — the chip
                       normally lives in the watch bar under the player */
                    <span className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      הושלם ✓
                    </span>
                  ) : null}
                </div>

                {selectedDescription && (
                  <p className="mt-3 text-sm text-petra-muted leading-relaxed whitespace-pre-wrap">
                    {selectedDescription}
                  </p>
                )}
              </div>

              {/* Q&A — remounted per lesson so threads never bleed across lessons */}
              <LessonQA
                key={selected.id}
                slug={slug}
                lessonId={selected.id}
                canAsk={!isLocked(selected)}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
