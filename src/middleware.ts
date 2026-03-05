import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/logout",
  "/book",
  "/api/book",
  "/my-booking",
  "/api/my-booking",
  // NOTE: /intake and /api/intake are handled below with regex
  // to allow /intake/[token] only — NOT /intake or /intake/ (admin pages)
  "/api/booking/availability",
  "/api/booking/slots",
  "/api/booking/book",
  "/api/cron",
  "/api/webhooks/invoices",
  "/api/webhooks/lead",
  "/api/service-dogs/id-card",
  "/api/integrations/google/callback", // Google Calendar OAuth callback
  "/privacy",
  "/tos-accept",
];

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

  // Allow other public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Allow all /api/auth/* paths
  if (pathname.startsWith("/api/auth")) {
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

  return NextResponse.next();
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
