export const dynamic = 'force-dynamic';
import { AppShell } from "@/components/layout/app-shell";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { CURRENT_TOS_VERSION } from "@/lib/tos";

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
        select: { completedAt: true },
      }),
    ]);
  } catch (err) {
    console.error("[DashboardLayout] DB checks error:", err);
    throw err;
  }

  if (!consent) {
    redirect("/tos-accept");
  }

  // If onboarding exists but not completed, or doesn't exist at all → redirect
  if (!progress || !progress.completedAt) {
    redirect("/onboarding");
  }

  return (
    <AppShell>
      <Suspense fallback={<div className="p-4 md:p-6 animate-pulse space-y-4"><div className="h-7 w-48 bg-slate-200 rounded-lg"/><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><div key={i} className="h-24 bg-slate-200 rounded-xl"/>)}</div></div>}>{children}</Suspense>
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: { fontFamily: "Heebo, sans-serif", direction: "rtl" },
          classNames: {
            success: "!bg-green-50 !border-green-200 !text-green-800",
            error: "!bg-red-50 !border-red-200 !text-red-700",
            info: "!bg-blue-50 !border-blue-200 !text-blue-800",
          },
        }}
        richColors
      />
    </AppShell>
  );
}
