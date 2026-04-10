export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, ensureUserHasBusiness } from "@/lib/auth";
import { exchangeCodeForTokens, fetchGoogleProfile } from "@/lib/google-oauth";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { notifyOwnerNewUser } from "@/lib/notify-owner";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // User denied access or Google returned an error
    if (error) {
      return redirectToLogin("google_denied");
    }

    if (!code || !state) {
      return redirectToLogin("missing_params");
    }

    // Validate CSRF state
    const storedState = request.cookies.get("google_oauth_state")?.value;
    if (!storedState || storedState !== state) {
      return redirectToLogin("invalid_state");
    }

    // Exchange code for tokens
    const { accessToken } = await exchangeCodeForTokens(code);

    // Fetch Google profile
    const profile = await fetchGoogleProfile(accessToken);
    if (!profile.email || !profile.emailVerified) {
      return redirectToLogin("email_not_verified");
    }

    // Find or create user
    let isNewUser = false;
    let user = await prisma.platformUser.findFirst({
      where: {
        OR: [
          { googleId: profile.sub },
          { email: profile.email.toLowerCase() },
        ],
      },
      select: {
        id: true, email: true, name: true, googleId: true, avatarUrl: true,
        passwordHash: true, authProvider: true, isActive: true,
      },
    });

    if (user) {
      // Link Google account if user exists by email but not yet linked
      if (!user.googleId) {
        user = await prisma.platformUser.update({
          where: { id: user.id },
          data: {
            googleId: profile.sub,
            authProvider: user.passwordHash ? "both" : "google",
            avatarUrl: user.avatarUrl || profile.picture || null,
          },
        });
      }
    } else {
      // Create new user with Google account
      user = await prisma.platformUser.create({
        data: {
          email: profile.email.toLowerCase(),
          name: profile.name || profile.email.split("@")[0],
          googleId: profile.sub,
          authProvider: "google",
          avatarUrl: profile.picture || null,
          passwordHash: null,
        },
      });
      isNewUser = true;
    }

    if (!user.isActive) {
      return redirectToLogin("account_disabled");
    }

    // Ensure user has a business workspace (creates one if missing)
    await ensureUserHasBusiness(
      user.id,
      user.name || profile.name || profile.email.split("@")[0]
    );

    // Invalidate all prior sessions before creating a new one (session fixation protection)
    await prisma.adminSession.deleteMany({ where: { userId: user.id } });

    // Google OAuth always creates a 30-day persistent session (mobile-friendly)
    const { token } = await createSession(user.id, request, true);

    // Check if user has accepted current ToS version
    const consent = await prisma.userConsent.findFirst({
      where: { userId: user.id, termsVersion: CURRENT_TOS_VERSION },
    });

    // Notify owner about new Google registration (awaited before redirect)
    if (isNewUser) {
      await notifyOwnerNewUser({ name: user.name || "", email: user.email, plan: "free" });
    }

    // Redirect: new/existing users without ToS consent go to /tos-accept, others to /dashboard
    const redirectPath = consent ? "/dashboard" : "/tos-accept";
    const response = NextResponse.redirect(new URL(redirectPath, APP_URL));
    response.cookies.set("petra_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days — matches SESSION_TTL_REMEMBER_ME in session.ts
    });
    // Clear the OAuth state cookie
    response.cookies.delete("google_oauth_state");

    return response;
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return redirectToLogin("server_error");
  }
}

function redirectToLogin(error: string) {
  const url = new URL("/login", APP_URL);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
