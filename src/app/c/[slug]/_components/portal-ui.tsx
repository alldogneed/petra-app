"use client"

import React from "react"

/** Filled primary button colored by the business portal branding (CSS var --portal-primary). */
export function PortalButton({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
  className = "",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  type?: "button" | "submit"
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ backgroundColor: "var(--portal-primary)" }}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-95 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}

/** Full-area loading spinner in the portal primary color. */
export function PortalSpinner() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div
        className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "var(--portal-primary)", borderTopColor: "transparent" }}
      />
    </div>
  )
}

export type PortalMembership = {
  id: string
  status: string
  validUntil: string | null
} | null

export function isActiveMembershipClient(m: PortalMembership): boolean {
  if (!m) return false
  if (m.status !== "active") return false
  if (!m.validUntil) return true
  return new Date(m.validUntil).getTime() >= Date.now()
}

/** Colored membership status badge (Hebrew). */
export function MembershipBadge({ membership }: { membership: PortalMembership }) {
  if (!membership) return null
  const validUntil = membership.validUntil
    ? new Date(membership.validUntil).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      })
    : null

  if (isActiveMembershipClient(membership)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        מנוי פעיל
        {validUntil && <span className="text-emerald-600 font-normal">עד {validUntil}</span>}
      </span>
    )
  }
  if (membership.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        ממתין לאישור העסק
      </span>
    )
  }
  if (membership.status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        המנוי מושהה
      </span>
    )
  }
  // expired (either status "expired" or active-but-past validUntil)
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-sm font-medium">
      <span className="w-2 h-2 rounded-full bg-slate-400" />
      המנוי הסתיים
    </span>
  )
}
