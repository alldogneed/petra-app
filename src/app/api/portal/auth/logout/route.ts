export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import {
  PORTAL_SESSION_COOKIE,
  deletePortalSession,
  clearPortalSessionCookie,
} from "@/lib/portal-auth";

/**
 * POST /api/portal/auth/logout
 * Deletes the portal session row and clears the cookie. Always {ok:true}.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    if (token) {
      await deletePortalSession(token);
    }
    clearPortalSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("portal logout error:", error);
    clearPortalSessionCookie();
    return NextResponse.json({ ok: true });
  }
}
