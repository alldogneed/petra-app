import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasTenantPermission, TENANT_PERMS } from "@/lib/permissions";
import { TenantAdminShell } from "@/components/tenant-admin/tenant-admin-shell";
import { prisma } from "@/lib/prisma";

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { businessId: string };
}) {
  const session = await getSession();

  if (!session) {
    redirect(`/login?redirect=/app/admin/${params.businessId}`);
  }

  // Check if user has manager+ rights in this business (or is platform admin)
  const isPlatformAdmin = session.user.platformRole === "super_admin" || session.user.platformRole === "admin";
  const membership = session.memberships.find(
    (m) => m.businessId === params.businessId && m.isActive
  );

  if (!isPlatformAdmin && !membership) {
    redirect("/403");
  }

  const hasAdminAccess =
    isPlatformAdmin ||
    (membership && hasTenantPermission(membership.role, TENANT_PERMS.USERS_READ));

  if (!hasAdminAccess) {
    redirect("/403");
  }

  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    select: { id: true, name: true, status: true },
  });

  if (!business) redirect("/403");

  return (
    <TenantAdminShell session={session} business={business} membership={membership ?? null}>
      {children}
    </TenantAdminShell>
  );
}
