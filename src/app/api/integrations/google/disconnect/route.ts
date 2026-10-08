export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { revokeCalendarAccess } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/integrations/google/disconnect
 * Revokes Google Calendar access and clears stored tokens.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await revokeCalendarAccess(session.user.id);

    // The lead → Google Contacts sync runs on the owner's Google connection — off with it.
    const ownedBusinessIds = session.impersonatedBusinessId
      ? []
      : session.memberships.filter((m) => m.isActive && m.role === "owner").map((m) => m.businessId);
    if (ownedBusinessIds.length > 0) {
      await prisma.business.updateMany({
        where: { id: { in: ownedBusinessIds }, googleContactsSync: true },
        data: { googleContactsSync: false },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
