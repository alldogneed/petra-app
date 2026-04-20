export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * POST /api/account/sessions/revoke-others — revoke all sessions for the current user
 * EXCEPT the one making this request. Use case: "log out of all other devices".
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.adminSession.deleteMany({
    where: {
      userId: session.user.id,
      NOT: { id: session.sessionId },
    },
  });

  return NextResponse.json({ ok: true, revokedCount: result.count });
}
