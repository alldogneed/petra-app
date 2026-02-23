import { NextResponse } from "next/server";
import { getSessionToken, deleteSession, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    const token = getSessionToken();
    if (token) {
      await deleteSession(token);
    }
    clearSessionCookie();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Logout error:", error);
    clearSessionCookie();
    return NextResponse.json({ ok: true });
  }
}
