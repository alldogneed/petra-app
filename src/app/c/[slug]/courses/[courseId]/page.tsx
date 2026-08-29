"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
} from "lucide-react"
import { PortalSpinner } from "../../_components/portal-ui"

type PortalLesson = {
  id: string
  title: string
  type: string | null
  videoRef?: string | null
  fileUrl?: string | null
  textContent?: string | null
  durationMin?: number | null
  isFreePreview?: boolean
}

type PortalModule = {
  id: string
  title: string
  lessons: PortalLesson[]
}

type PortalCourseTree = {
  id: string
  title: string
  description: string | null
  modules: PortalModule[]
}

function isLocked(lesson: PortalLesson): boolean {
  return !lesson.videoRef && !lesson.fileUrl && !lesson.textContent
}

function lessonKind(lesson: PortalLesson): "video" | "pdf" | "text" {
  const t = (lesson.type ?? "").toLowerCase()
  if (t === "pdf") return "pdf"
  if (t === "text") return "text"
  return "video"
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    fetch(`/api/portal/${slug}/courses/${courseId}`)
      .then(async (r) => {
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
        // default: first unlocked lesson
        const firstUnlocked = tree.modules
          .flatMap((m) => m.lessons)
          .find((l) => !isLocked(l))
        const first = firstUnlocked ?? tree.modules.flatMap((m) => m.lessons)[0]
        if (first) setSelectedId(first.id)
      })
      .catch(() => setLoadError("שגיאה בטעינת הקורס"))
  }, [slug, courseId, router])

  const allLessons = useMemo(
    () => (course ? course.modules.flatMap((m) => m.lessons) : []),
    [course]
  )
  const selected = allLessons.find((l) => l.id === selectedId) ?? null
  const total = allLessons.length
  const done = allLessons.filter((l) => completed.has(l.id)).length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

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

      {/* Progress bar */}
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
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(lesson.id)}
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
                        {lesson.durationMin != null && (
                          <span className="text-[11px] text-petra-muted flex-shrink-0">
                            {lesson.durationMin} דק׳
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </aside>

        {/* Player area — top on mobile, left column on desktop */}
        <section className="order-1 md:order-2 flex-1 w-full min-w-0">
          {!selected ? (
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
            <div className="space-y-4">
              {selectedKind === "video" && selected.videoRef && (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selected.videoRef}`}
                  title={selected.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video rounded-2xl border border-petra-border bg-black"
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

              {/* Lesson title + complete toggle */}
              <div className="bg-white rounded-2xl shadow-card border border-petra-border p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-petra-text truncate">{selected.title}</h2>
                  {selected.durationMin != null && (
                    <p className="text-xs text-petra-muted mt-0.5">{selected.durationMin} דקות</p>
                  )}
                </div>
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
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
