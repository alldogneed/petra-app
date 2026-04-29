import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPlatformPermission, PLATFORM_PERMS } from "@/lib/permissions";
import AdminShell from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin");
  }

  // Allow users with MASTER role (legacy) OR any platform role
  const hasLegacyAccess = (session.user as { role?: string }).role === "MASTER";
  const hasPlatformAccess = hasPlatformPermission(session.user.platformRole, PLATFORM_PERMS.USERS_READ);

  if (!hasLegacyAccess && !hasPlatformAccess) {
    redirect("/dashboard");
  }

  // Owner Panel is only accessible to platform admins (super_admin, admin, support).
  // Don't show its links to legacy MASTER users without a platformRole — they'd hit /403.
  const showOwnerSection = !!session.user.platformRole;

  return (
    <AdminShell userName={session.user.name} showOwnerSection={showOwnerSection}>
      {children}
    </AdminShell>
  );
}
