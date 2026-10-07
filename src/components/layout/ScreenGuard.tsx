"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { isScreenBlocked } from "@/lib/permissions";

/**
 * Replaces a screen the owner switched off for this member (הגדרות ← צוות והרשאות)
 * with a "no access" card. UX only — data stays protected by the API guards.
 */
export function ScreenGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user, loading } = useAuth();

  if (loading || !user || user.isAdmin || user.isImpersonating) return <>{children}</>;
  if (!isScreenBlocked(user.businessRole, user.businessPermissionOverrides, pathname)) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-20">
      <div className="card p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Lock className="w-5 h-5 text-petra-muted" />
        </div>
        <h1 className="text-lg font-bold text-petra-text mb-1">אין לך גישה למסך הזה</h1>
        <p className="text-sm text-petra-muted mb-5">
          בעל העסק יכול לפתוח אותו עבורך בהגדרות ← צוות והרשאות.
        </p>
        <Link href="/dashboard" className="btn-primary inline-flex">
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
