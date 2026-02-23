import { AppShell } from "@/components/layout/app-shell";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <Suspense>{children}</Suspense>
    </AppShell>
  );
}
