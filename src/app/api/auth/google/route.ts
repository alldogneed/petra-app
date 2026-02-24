import { NextResponse } from "next/server";
import crypto from "crypto";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const url = buildGoogleAuthUrl(state);

    const response = NextResponse.redirect(url);
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (e) {
    console.error("Google OAuth init error:", e);
    const loginUrl = new URL("/login", process.env.APP_URL || "http://localhost:3000");
    loginUrl.searchParams.set("error", "google_config");
    return NextResponse.redirect(loginUrl);
  }
}
