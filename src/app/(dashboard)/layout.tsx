import { AppShell } from "@/components/layout/app-shell";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId: user.id },
  });

  // If onboarding exists but not completed, redirect to /onboarding
  if (progress && !progress.completedAt) {
    redirect("/onboarding");
  }
  // If no progress record exists at all, redirect to /onboarding
  if (!progress) {
    redirect("/onboarding");
  }

  return (
    <AppShell>
      <Suspense>{children}</Suspense>
    </AppShell>
  );
}
