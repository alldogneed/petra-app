import { NextRequest, NextResponse } from "next/server";

/**
 * Paths that allow unauthenticated access.
 *
 * PREFIX paths (matched with startsWith — any sub-path is also public):
 */
const PUBLIC_PREFIX_PATHS = [
  "/book",          // /book/[slug], /book/[slug]/success, etc.
  "/api/book",      // /api/book/[slug]
  "/my-booking",    // /my-booking/[token]
  "/api/my-booking", // /api/my-booking/[token]
  "/api/cron/",     // /api/cron/* — trailing slash ensures /api/cronXXX won't match
  "/api/webhooks/", // /api/webhooks/* — trailing slash prevents prefix collision (paycall webhook auth handled in-route)
  "/api/service-dogs/id-card", // /api/service-dogs/id-card/[token]
];

/**
 * EXACT paths (matched with === or === path + "/"):
 */
const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/tos-accept",
  "/landing",
  "/accessibility",
  "/checkout",
  "/payment/success",
  "/payment/error",
  "/payment/trial-success",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/logout",
  "/api/booking/availability",
  "/api/booking/slots",
  "/api/booking/book",
  "/api/cardcom/indicator",
  "/api/cardcom/success-redirect",
  "/api/cardcom/create-trial",
  "/api/cardcom/create-checkout",
  "/api/cardcom/checkout-indicator",
  "/api/cardcom/trial-indicator",
  "/api/integrations/google/callback",
]);

/** Validate token format: must be exactly 64 hex characters */
function isValidTokenFormat(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public intake pages: /intake/[token] only — NOT /intake or /intake/ (admin pages)
  if (/^\/intake\/[^/]+/.test(pathname)) return NextResponse.next();
  // Allow public intake API: /api/intake/[token] and /api/intake/[token]/submit
  if (/^\/api\/intake\/[^/]+/.test(pathname)) return NextResponse.next();

  // Allow public contract sign pages: /sign/[token]
  if (/^\/sign\/[^/]+/.test(pathname)) return NextResponse.next();
  // Allow public sign API: /api/sign/[token]
  if (/^\/api\/sign\/[^/]+/.test(pathname)) return NextResponse.next();

  // Allow exact public paths
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Allow prefix-based public paths
  if (PUBLIC_PREFIX_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Allow specific /api/auth/* sub-paths that need public access (2FA, Google OAuth, me, session)
  // These have their own internal auth checks, but must pass through middleware
  // because they're called from both authenticated and unauthenticated contexts
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Allow static files — only match file extensions at the end of the path
  if (/\.\w{2,5}$/.test(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("petra_session")?.value;

  if (!sessionToken || !isValidTokenFormat(sessionToken)) {
    // Redirect to login for page requests
    if (!pathname.startsWith("/api/")) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    // Return 401 for API requests
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rolling remember-me: when the companion flag cookie indicates remember-me,
  // re-set both cookies with a fresh 30-day Max-Age so active users don't get
  // logged out at the 30-day mark from their original login. DB expiresAt is
  // extended in parallel inside getSessionByToken.
  const rememberMe = request.cookies.get("petra_rm")?.value === "1";
  const response = NextResponse.next();
  if (rememberMe) {
    const isProd = process.env.NODE_ENV === "production";
    const maxAge = 30 * 24 * 60 * 60;
    response.cookies.set("petra_session", sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set("petra_rm", "1", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (Next.js static files)
     * - _next/image (Next.js image optimization)
     * - favicon.ico, logo.svg (static assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg).*)",
  ],
};
