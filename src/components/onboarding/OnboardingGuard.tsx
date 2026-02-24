"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Wraps the dashboard.
 *
 * New behaviour (setup-checklist model):
 * - The setup checklist lives ON the dashboard — no forced redirect to separate onboarding steps.
 * - The Guard only redirects brand-new users (never logged in before) to /dashboard so they see
 *   the checklist immediately, instead of landing on whatever deep page they navigated to.
 * - If progress is skipped or completed → let through to any page normally.
 * - If already on /dashboard or /settings → always let through (user is working through the checklist).
 *
 * We no longer force-redirect to specific step URLs; instead the SetupChecklist widget on
 * the dashboard links users to the correct pages with ?tab=... query params.
 */
export function OnboardingGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Always allow through: login, onboarding welcome page, dashboard, settings
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/onboarding") ||
      pathname === "/dashboard" ||
      pathname.startsWith("/settings")
    ) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/onboarding/progress");

        if (!res.ok) {
          // 401 or error — auth middleware will handle; just let through
          if (!cancelled) setChecked(true);
          return;
        }

        const progress = await res.json();

        if (!progress || progress.skipped || progress.completedAt) {
          // Setup done — proceed normally
          if (!cancelled) setChecked(true);
          return;
        }

        if (cancelled) return;

        // New user who hasn't started — redirect to dashboard to see the checklist
        if (!progress.startedAt) {
          router.replace("/dashboard");
          return;
        }

        // In-progress user: let them go anywhere (checklist is always visible on dashboard)
        if (!cancelled) setChecked(true);
      } catch {
        if (!cancelled) setChecked(true);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-petra-bg">
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: "3px solid #F97316",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
