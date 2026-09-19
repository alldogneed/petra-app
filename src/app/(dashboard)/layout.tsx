export const dynamic = 'force-dynamic';
import { AppShell } from "@/components/layout/app-shell";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import nextDynamic from "next/dynamic";

const InstallPWABanner = nextDynamic(() => import("@/components/layout/InstallPWABanner"), { ssr: false });

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    console.error("[DashboardLayout] getCurrentUser error:", err);
    throw err;
  }

  if (!user) {
    redirect("/login");
  }

  // Skip ToS / onboarding checks when super_admin is impersonating a tenant
  if (!user.isImpersonating) {
    // Run ToS and onboarding checks in parallel to avoid sequential DB round-trips
    let consent, progress;
    try {
      [consent, progress] = await Promise.all([
        prisma.userConsent.findFirst({
          where: { userId: user.id, termsVersion: CURRENT_TOS_VERSION },
          select: { id: true },
        }),
        prisma.onboardingProgress.findUnique({
          where: { userId: user.id },
          select: { completedAt: true, skipped: true },
        }),
      ]);
    } catch (err) {
      console.error("[DashboardLayout] DB checks error:", err);
      throw err;
    }

    if (!consent) {
      redirect("/tos-accept");
    }

    // If onboarding exists but not completed/skipped, or doesn't exist at all → redirect.
    // "דלג" sets skipped:true without completedAt — that must satisfy the gate too,
    // otherwise a skipping user loops back to /onboarding forever.
    if (!progress || (!progress.completedAt && !progress.skipped)) {
      redirect("/onboarding");
    }
  }

  return (
    <AppShell>
      <Suspense fallback={<PetraLoader />}>{children}</Suspense>
      <InstallPWABanner />
    </AppShell>
  );
}
