export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, invalidateSessionCache } from "@/lib/session";

/** DELETE /api/account/sessions/[id] — revoke a specific session owned by the current user. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the raw token so we can evict it from the in-memory cache
  const target = await prisma.adminSession.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { token: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await prisma.adminSession.delete({ where: { id: params.id } });
  // Token in DB is already hashed; cache key is the raw token, so eviction
  // happens naturally on next request. But if this is the current session,
  // we invalidate immediately to prevent stale reads in warm Lambda.
  invalidateSessionCache(target.token);

  return NextResponse.json({ ok: true });
}
