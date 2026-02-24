import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/permissions";
import { OwnerShell } from "@/components/owner/owner-shell";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/owner");
  }

  if (!session.user.platformRole) {
    redirect("/403");
  }

  if (
    isPlatformAdmin(session.user.platformRole) &&
    session.user.twoFaEnabled &&
    !session.twoFaVerified
  ) {
    redirect("/login?step=2fa&redirect=/owner");
  }

  return <OwnerShell session={session}>{children}</OwnerShell>;
}
