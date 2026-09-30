export const dynamic = "force-dynamic";
/**
 * POST /api/oauth/authorize — consent decision for the MCP OAuth consent screen.
 *
 * Session-protected (NOT public in middleware). CSRF: Origin must equal our own origin and
 * the body must be JSON (a cross-site form post cannot send application/json without CORS).
 * Every OAuth parameter is re-validated here — the consent page's props are never trusted.
 *
 * Returns { redirect } — the browser navigates there:
 *   approve → <redirect_uri>?code=…&state=…&iss=<origin>
 *   deny    → <redirect_uri>?error=access_denied&state=…&iss=<origin>
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveSession } from "@/lib/auth-guards";
import { rateLimitAsync } from "@/lib/rate-limit";
import { MCP_PROFILES } from "@/lib/mcp-auth";
import {
  getOAuthOrigin,
  isValidResource,
  redirectUriMatches,
  listGrantableBusinesses,
  checkConsentGates,
  issueAuthCode,
} from "@/lib/mcp-oauth";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_PARAM_LEN = 2048;
const CODE_CHALLENGE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Optional string field: undefined/null/"" → null; non-string or too long → invalid. */
function optStr(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  if (typeof v !== "string" || v.length > MAX_PARAM_LEN) return { ok: false };
  return { ok: true, value: v };
}

function reqStr(v: unknown, max = MAX_PARAM_LEN): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

function buildRedirect(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null) url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function POST(request: NextRequest) {
  const session = await resolveSession(request);
  if (!session || !session.user.isActive) {
    return json({ error: "נדרשת התחברות מחדש" }, 401);
  }

  // ── CSRF ─────────────────────────────────────────────────────────────────
  const origin = getOAuthOrigin(request);
  const presentedOrigin = request.headers.get("origin");
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!presentedOrigin || presentedOrigin !== origin || !contentType.startsWith("application/json")) {
    return json({ error: "בקשה נחסמה" }, 403);
  }

  const rl = await rateLimitAsync("oauth:authorize", session.user.id, { max: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return json({ error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." }, 429);
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "בקשה גדולה מדי" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad body");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "בקשה לא תקינה" }, 400);
  }

  // ── Client + redirect_uri (errors here are NEVER redirected) ──────────────
  const clientId = reqStr(body.client_id, 100);
  const redirectUri = reqStr(body.redirect_uri);
  if (!clientId || !redirectUri) return json({ error: "בקשת חיבור לא תקינה" }, 400);

  const client = await prisma.oAuthClient.findUnique({
    where: { id: clientId },
    select: { id: true, redirectUris: true },
  });
  if (!client) return json({ error: "האפליקציה לא מוכרת" }, 400);
  if (!redirectUriMatches(client.redirectUris, redirectUri)) {
    return json({ error: "כתובת החזרה אינה תואמת לאפליקציה" }, 400);
  }

  const stateR = optStr(body.state);
  const resourceR = optStr(body.resource);
  if (!stateR.ok || !resourceR.ok) return json({ error: "בקשה לא תקינה" }, 400);
  const state = stateR.value;
  const resource = resourceR.value;

  // ── Deny ─────────────────────────────────────────────────────────────────
  const decision = body.decision;
  if (decision === "deny") {
    return json({
      redirect: buildRedirect(redirectUri, {
        error: "access_denied",
        error_description: "The user denied the request",
        state,
        iss: origin,
      }),
    });
  }
  if (decision !== "approve") return json({ error: "בקשה לא תקינה" }, 400);

  // ── PKCE / resource / profile ─────────────────────────────────────────────
  const codeChallenge = reqStr(body.code_challenge, 128);
  if (!codeChallenge || !CODE_CHALLENGE_RE.test(codeChallenge) || body.code_challenge_method !== "S256") {
    return json({ error: "בקשת חיבור לא תקינה (PKCE)" }, 400);
  }
  if (!isValidResource(resource, origin)) {
    return json({ error: "כתובת המשאב אינה תקינה" }, 400);
  }
  const profile = reqStr(body.profile, 50);
  if (!profile || !Object.prototype.hasOwnProperty.call(MCP_PROFILES, profile)) {
    return json({ error: "פרופיל גישה לא תקין" }, 400);
  }

  // ── Business (only one of the grantable+eligible ones) ────────────────────
  const businessId = reqStr(body.business_id, 100);
  if (!businessId) return json({ error: "יש לבחור עסק" }, 400);
  const grantable = await listGrantableBusinesses(session);
  const entry = grantable.find((b) => b.businessId === businessId);
  if (!entry) return json({ error: "אין לך גישה לעסק הזה" }, 403);
  if (!entry.eligible) return json({ error: entry.reason || "לא ניתן לחבר עוזר AI לעסק הזה" }, 403);

  const gates = await checkConsentGates(session, businessId, profile);
  if (!gates.ok) return json({ error: gates.error }, gates.status || 403);

  const code = await issueAuthCode({
    clientId: client.id,
    userId: session.user.id,
    businessId,
    redirectUri,
    codeChallenge,
    scopes: gates.scopes,
    profile,
    role: gates.role,
    resource,
  });

  prisma.oAuthClient
    .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return json({ redirect: buildRedirect(redirectUri, { code, state, iss: origin }) });
}
