/**
 * GET /oauth/authorize — MCP OAuth 2.1 authorization endpoint (consent screen).
 *
 * Order of checks (RFC 6749 §4.1.2.1 / OAuth 2.1):
 *  1. client_id unknown / missing          → Hebrew error card, NEVER redirect
 *  2. redirect_uri missing / not registered → Hebrew error card, NEVER redirect
 *  3. other param errors                    → redirect to redirect_uri with error + state + iss
 *  4. no session                            → /login?next=<this URL>
 *  5. render <ConsentForm/>; the decision is POSTed to /api/oauth/authorize (re-validates everything)
 *
 * Public in middleware — this page checks the session itself.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  getOAuthOrigin,
  isValidResource,
  redirectUriMatches,
  sanitizeClientName,
  listGrantableBusinesses,
} from "@/lib/mcp-oauth";
import { MCP_PROFILES, MCP_PROFILE_LABELS } from "@/lib/mcp-auth";
import { ConsentForm } from "./ConsentForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "חיבור עוזר AI | Petra",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const MAX_PARAM_LEN = 2048;
const CODE_CHALLENGE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

/** Single-valued param: duplicates (arrays) are invalid per OAuth → undefined + flag. */
function single(sp: SearchParams, key: string): { value: string | undefined; bad: boolean } {
  const v = sp[key];
  if (Array.isArray(v)) return { value: undefined, bad: true };
  if (typeof v !== "string") return { value: undefined, bad: false };
  if (v.length > MAX_PARAM_LEN) return { value: undefined, bad: true };
  return { value: v, bad: false };
}

/** Origin of this request, computed the same way as getOAuthOrigin(request) in the API routes. */
function requestOrigin(): string {
  const h = headers();
  const host = h.get("host") || "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const fake = { url: `${proto}://${host}/oauth/authorize`, headers: h } as unknown as Request;
  return getOAuthOrigin(fake);
}

function errorRedirect(redirectUri: string, error: string, description: string, state: string | undefined, iss: string): never {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state !== undefined) url.searchParams.set("state", state);
  url.searchParams.set("iss", iss);
  redirect(url.toString());
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <OAuthShell>
      <div className="card p-6">
        <h1 className="text-xl font-bold text-petra-text">{title}</h1>
        <p className="text-sm text-petra-muted mt-2 leading-relaxed">{message}</p>
        <p className="text-xs text-petra-muted mt-4 leading-relaxed">
          אפשר לסגור את החלון ולנסות להתחבר מחדש מתוך עוזר ה-AI. אם הבעיה חוזרת — פנו לתמיכה של פטרה.
        </p>
      </div>
    </OAuthShell>
  );
}

function OAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-petra-bg flex items-center justify-center p-4 sm:p-10">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white shadow-card flex items-center justify-center overflow-hidden">
            <Image src="/logo.svg" alt="Petra" width={30} height={30} className="object-contain" priority />
          </div>
          <span className="text-[22px] font-extrabold tracking-tight text-petra-text">Petra</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function OAuthAuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const clientIdP = single(searchParams, "client_id");
  const redirectUriP = single(searchParams, "redirect_uri");

  // ── 1. client_id ─────────────────────────────────────────────────────────
  const clientId = clientIdP.value?.trim();
  if (clientIdP.bad || !clientId || clientId.length > 100) {
    return <ErrorCard title="בקשת חיבור לא תקינה" message="חסר מזהה אפליקציה (client_id) או שהוא לא תקין." />;
  }
  const client = await prisma.oAuthClient.findUnique({
    where: { id: clientId },
    select: { id: true, clientName: true, redirectUris: true },
  });
  if (!client) {
    return (
      <ErrorCard
        title="האפליקציה לא מוכרת"
        message="האפליקציה שמנסה להתחבר לפטרה אינה רשומה (ייתכן שהרישום פג). נסו להסיר את החיבור מעוזר ה-AI ולהוסיף אותו מחדש."
      />
    );
  }

  // ── 2. redirect_uri ──────────────────────────────────────────────────────
  const redirectUri = redirectUriP.value;
  if (redirectUriP.bad || !redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return (
      <ErrorCard
        title="כתובת חזרה לא תקינה"
        message="כתובת החזרה (redirect_uri) של הבקשה אינה תואמת לכתובת הרשומה של האפליקציה, ולכן לא נמשיך."
      />
    );
  }

  // ── 3. remaining params → errors go back to the client ────────────────────
  const origin = requestOrigin();
  const stateP = single(searchParams, "state");
  const state = stateP.bad ? undefined : stateP.value;
  const fail: (error: string, description: string) => never = (error, description) => errorRedirect(redirectUri, error, description, state, origin);

  if (stateP.bad) fail("invalid_request", "state parameter is invalid");
  const responseType = single(searchParams, "response_type");
  if (responseType.bad || responseType.value !== "code") {
    fail("unsupported_response_type", "response_type must be 'code'");
  }
  const challengeP = single(searchParams, "code_challenge");
  const codeChallenge = challengeP.value;
  if (challengeP.bad || !codeChallenge || !CODE_CHALLENGE_RE.test(codeChallenge)) {
    fail("invalid_request", "code_challenge is required (PKCE)");
  }
  const methodP = single(searchParams, "code_challenge_method");
  if (methodP.bad || methodP.value !== "S256") {
    fail("invalid_request", "code_challenge_method must be S256");
  }
  const resourceP = single(searchParams, "resource");
  const resource = resourceP.value;
  if (resourceP.bad || !isValidResource(resource, origin)) {
    fail("invalid_target", "resource must be this server's MCP endpoint");
  }

  // ── 4. session ───────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session || !session.user.isActive) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string") qs.append(k, v);
    }
    redirect("/login?next=" + encodeURIComponent("/oauth/authorize?" + qs.toString()));
  }

  // ── 5. consent ───────────────────────────────────────────────────────────
  const businesses = await listGrantableBusinesses(session);
  const clientName = sanitizeClientName(client.clientName);
  const redirectHost = new URL(redirectUri).host;
  const profiles = Object.keys(MCP_PROFILES).map((key) => ({ key, label: MCP_PROFILE_LABELS[key] ?? key }));

  return (
    <OAuthShell>
      <ConsentForm
        clientName={clientName}
        redirectHost={redirectHost}
        userEmail={session.user.email}
        businesses={businesses}
        profiles={profiles}
        params={{
          client_id: client.id,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state: state ?? null,
          resource: resource ?? null,
        }}
      />
    </OAuthShell>
  );
}
