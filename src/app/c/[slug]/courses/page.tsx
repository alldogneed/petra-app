"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { ArrowRight, GraduationCap, PlayCircle } from "lucide-react"
import { PortalSpinner } from "../_components/portal-ui"

type PortalCourse = {
  id: string
  title: string
  description: string | null
  coverUrl: string | null
  lessonCount: number
  hasFreePreview: boolean
}

export default function PortalCoursesPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const router = useRouter()
  const t = useTranslations("portal.detailCoursesPage")
  const [courses, setCourses] = useState<PortalCourse[] | null>(null)

  useEffect(() => {
    fetch(`/api/portal/${slug}/courses`)
      .then(async (r) => {
        if (r.status === 401) {
          router.replace(`/c/${slug}/login`)
          return
        }
        const d = await r.json().catch(() => null)
        setCourses(d?.courses ?? [])
      })
      .catch(() => setCourses([]))
  }, [slug, router])

  if (courses === null) return <PortalSpinner />

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

      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-petra-border p-8 text-center">
          <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-petra-muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/c/${slug}/courses/${course.id}`}
              className="block bg-white rounded-2xl shadow-card border border-petra-border overflow-hidden hover:shadow-card-hover transition-shadow"
            >
              {course.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.coverUrl}
                  alt={course.title}
                  className="w-full h-36 object-cover"
                />
              ) : (
                <div
                  className="w-full h-36 flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--portal-primary), var(--portal-secondary))",
                  }}
                >
                  <GraduationCap className="w-10 h-10 text-white/80" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-petra-text">{course.title}</h2>
                  {course.hasFreePreview && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0 font-medium inline-flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" />
                      {t("freeLesson")}
                    </span>
                  )}
                </div>
                {course.description && (
                  <p className="text-sm text-petra-muted mt-1.5 line-clamp-2">
                    {course.description}
                  </p>
                )}
                <p className="text-xs text-petra-muted mt-2.5 font-medium">
                  {t("lessonCount", { count: course.lessonCount })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
