import { NextRequest, NextResponse } from "next/server";

/**
 * Paths that allow unauthenticated access.
 *
 * PREFIX paths (matched with startsWith — any sub-path is also public):
 */
const PUBLIC_PREFIX_PATHS = [
  "/book",          // /book/[slug], /book/[slug]/success, etc.
  "/api/book/",     // /api/book/[slug] — trailing slash prevents matching /api/booking/* admin routes
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
  "/pdf.worker.min.mjs", // pdf.js worker — static asset needed by the PUBLIC /sign/[token] page (unauthenticated customers)
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
  "/api/mcp", // MCP endpoint — self-contained Bearer-token auth + rate limit + audit (NOT a prefix: /api/mcp/connections stays session-protected)
  "/api/cardcom/indicator",
  "/api/cardcom/success-redirect",
  "/api/cardcom/create-trial",
  "/api/cardcom/create-checkout",
  "/api/cardcom/checkout-indicator",
  "/api/cardcom/trial-indicator",
  "/api/integrations/google/callback",
  "/api/invoicing/process-jobs",           // Vercel Cron — in-route timing-safe CRON_SECRET auth
  "/api/integrations/google/process-jobs", // Vercel Cron — in-route verifyCronAuth
]);

/** Validate token format: must be exactly 64 hex characters */
function isValidTokenFormat(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public intake pages: /intake/[token] only — NOT /intake, /intake/create, /intake/list, /intake/send
  // Tokens are UUIDs (36 chars) or cuid-style IDs (25+ chars) — require at least 20 chars to exclude short admin paths
  if (/^\/intake\/[0-9a-zA-Z_-]{20,}$/.test(pathname)) return NextResponse.next();
  // Allow public intake API: /api/intake/[token] and /api/intake/[token]/submit
  if (/^\/api\/intake\/[0-9a-zA-Z_-]{20,}(\/submit)?$/.test(pathname)) return NextResponse.next();

  // Allow public contract sign pages: /sign/[token] (end-anchored to prevent /sign/token/extra bypass)
  if (/^\/sign\/[^/]+$/.test(pathname)) return NextResponse.next();
  // Allow public sign API: /api/sign/[token] and /api/sign/[token]/pdf
  if (/^\/api\/sign\/[^/]+(\/pdf)?$/.test(pathname)) return NextResponse.next();

  // Allow MCP path-based token endpoint: /api/mcp/u/petra_mcp_<64 hex>
  // Strict format match so this never opens /api/mcp/connections or any other sub-path.
  // The route itself does the real Bearer-token auth + rate limit + audit.
  if (/^\/api\/mcp\/u\/petra_mcp_[0-9a-f]{64}$/.test(pathname)) return NextResponse.next();

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

  // Allow specific /api/auth/* sub-paths that need public access.
  // Explicit allowlist (not catch-all) so new auth routes aren't accidentally public.
  const AUTH_PUBLIC_SUBPATHS = [
    "/api/auth/2fa/confirm",
    "/api/auth/2fa/enroll",
    "/api/auth/2fa/verify",
    "/api/auth/exit-impersonation",
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/me",
    "/api/auth/session",
  ];
  if (AUTH_PUBLIC_SUBPATHS.some((p) => pathname === p || pathname === p + "/")) {
    return NextResponse.next();
  }

  // Allow known static file extensions — explicit allowlist to prevent auth bypass via crafted extensions
  if (/\.(ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|map|woff2?|ttf|eot|txt|xml|webmanifest)$/.test(pathname)) {
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
