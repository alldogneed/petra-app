"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldX, Loader2 } from "lucide-react";
import Link from "next/link";
import type { TenantPermission } from "@/lib/permissions";

const ROLE_LEVEL: Record<string, number> = { owner: 0, manager: 1, user: 2 };

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "owner" | "manager";
  permission?: TenantPermission;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  permission,
  fallback,
}: ProtectedRouteProps) {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user) return null;

  // Role hierarchy check
  if (requiredRole) {
    const userLevel = ROLE_LEVEL[user.businessRole ?? ""] ?? 99;
    const requiredLevel = ROLE_LEVEL[requiredRole];
    if (userLevel > requiredLevel) {
      return fallback ?? <AccessDenied />;
    }
  }

  // Permission check
  if (permission && !hasPermission(permission)) {
    return fallback ?? <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="card p-8 max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <ShieldX className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-petra-text">אין הרשאה</h2>
        <p className="text-sm text-petra-muted">
          אין לך הרשאה לגשת לעמוד זה. פנה למנהל העסק לקבלת גישה.
        </p>
        <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
