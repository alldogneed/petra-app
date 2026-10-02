export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";
import { safeNextPath } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const url = buildGoogleAuthUrl(state);

    const response = NextResponse.redirect(url);
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    // Post-login destination (MCP OAuth consent) — only a validated relative path, 10 min
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    if (next) {
      response.cookies.set("petra_login_next", next, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
    } else {
      response.cookies.delete("petra_login_next");
    }

    return response;
  } catch (e) {
    console.error("Google OAuth init error:", e);
    const loginUrl = new URL("/login", process.env.APP_URL || "http://localhost:3000");
    loginUrl.searchParams.set("error", "google_config");
    return NextResponse.redirect(loginUrl);
  }
}
