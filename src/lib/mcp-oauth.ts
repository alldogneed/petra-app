/**
 * MCP OAuth 2.1 — shared server-side library (auto-login for Claude / Codex connectors).
 *
 * Standards: MCP Authorization (2025-06-18), RFC 9728 (protected resource metadata),
 * RFC 8414 (AS metadata), RFC 7591 (dynamic client registration), OAuth 2.1 auth-code +
 * PKCE (S256 only), refresh-token rotation, RFC 8707 `resource`, RFC 7009 revocation.
 *
 * Design:
 *  - An OAuth grant IS an McpConnection row. The access token is a normal `petra_mcp_…`
 *    token, so validateMcpToken() (allowlist, role capping, revocation, audit, rate limit)
 *    applies unchanged. `accessExpiresAt` = 1h access expiry; `expiresAt` = 90-day sliding
 *    grant/refresh expiry.
 *  - Refresh tokens `petra_mcpr_…` and auth codes are stored as SHA-256 only.
 *  - No $transaction (Supabase PgBouncer): single-use codes and refresh rotation are made
 *    atomic with conditional `updateMany` (count must be 1).
 *  - Never log raw tokens / codes / verifiers.
 *
 * Server-side only. Never import from client components.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import type { FullSession } from "@/lib/session";
import {
  generateMcpToken,
  hashToken,
  MCP_PROFILES,
  capScopesForRole,
} from "@/lib/mcp-auth";
import { isMcpAllowedUser, isMcpAllowedBusiness, isInternalTestEmail } from "@/lib/mcp-allowlist";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";

// ─── Constants ────────────────────────────────────────────────────────────────

export const OAUTH_ACCESS_TOKEN_TTL_SEC = 3600;
export const OAUTH_REFRESH_TTL_DAYS = 90;
export const OAUTH_CODE_TTL_SEC = 600;
export const REFRESH_TOKEN_PREFIX = "petra_mcpr_";

const ACCESS_TOKEN_PREFIX = "petra_mcp_";
const REFRESH_TOKEN_RE = /^petra_mcpr_[0-9a-f]{64}$/;
const ACCESS_TOKEN_RE = /^petra_mcp_[0-9a-f]{64}$/;
const AUTH_CODE_RE = /^[0-9a-f]{64}$/;
const MAX_ACTIVE_CONNECTIONS = 10;
const MAX_REDIRECT_URI_LENGTH = 500;
const CLIENT_NAME_MAX = 60;
const CLIENT_NAME_FALLBACK = "עוזר AI";
const CONNECTION_NAME_SUFFIX = " (התחברות אוטומטית)";
const CONNECTION_NAME_MAX = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const LIMIT_ERROR = "הגעת למקסימום 10 חיבורים פעילים";

// ─── Errors / types ───────────────────────────────────────────────────────────

export class OAuthGrantError extends Error {
  constructor(
    public code: "invalid_grant" | "invalid_request" | "invalid_client" | "access_denied",
    message: string
  ) {
    super(message);
    this.name = "OAuthGrantError";
  }
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

// ─── Small crypto helpers ─────────────────────────────────────────────────────

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/** Constant-time string equality (length leak only). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Still burn a comparison so the mismatch path isn't measurably faster.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateAuthCode(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: sha256Hex(raw) };
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = REFRESH_TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
  return { raw, hash: sha256Hex(raw) };
}

const PKCE_VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
/** base64url(SHA-256) is always exactly 43 chars. */
const PKCE_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;

/** RFC 7636 S256: base64url(sha256(verifier)) === challenge, compared in constant time. */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (typeof verifier !== "string" || typeof challenge !== "string") return false;
  if (!PKCE_VERIFIER_RE.test(verifier)) return false;
  if (!PKCE_CHALLENGE_RE.test(challenge)) return false;
  const computed = base64url(crypto.createHash("sha256").update(verifier, "ascii").digest());
  return timingSafeEqualStr(computed, challenge);
}

// ─── Origin / resource / metadata ─────────────────────────────────────────────

const HOST_RE = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

function firstHeaderValue(v: string | null): string | null {
  if (!v) return null;
  const first = v.split(",")[0]?.trim();
  return first ? first : null;
}

/** Issuer/base URL = the request's own origin (honors x-forwarded-proto/host). */
export function getOAuthOrigin(request: Request | NextRequest): string {
  const fallback = (() => {
    const nextUrl = (request as NextRequest).nextUrl;
    if (nextUrl && typeof nextUrl.origin === "string") return nextUrl.origin;
    return new URL(request.url).origin;
  })();

  const fwdHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const fwdProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))?.toLowerCase() ?? null;

  const fallbackUrl = new URL(fallback);
  const proto = fwdProto === "https" || fwdProto === "http" ? fwdProto : fallbackUrl.protocol.replace(":", "");
  const host = fwdHost && HOST_RE.test(fwdHost) ? fwdHost.toLowerCase() : fallbackUrl.host;

  // Drop default ports so the issuer is canonical.
  let origin = `${proto}://${host}`;
  if (proto === "https" && origin.endsWith(":443")) origin = origin.slice(0, -4);
  if (proto === "http" && origin.endsWith(":80")) origin = origin.slice(0, -3);
  return origin;
}

export function getMcpResourceUrl(origin: string): string {
  return `${origin}/api/mcp`;
}

function stripOneTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/** RFC 8707: absent → true; else must equal the MCP resource URL (one trailing slash ignored). */
export function isValidResource(resource: string | null | undefined, origin: string): boolean {
  if (resource === null || resource === undefined || resource === "") return true;
  if (typeof resource !== "string") return false;
  return stripOneTrailingSlash(resource) === stripOneTrailingSlash(getMcpResourceUrl(origin));
}

/** RFC 9728 Protected Resource Metadata. */
export function protectedResourceMetadata(origin: string): Record<string, unknown> {
  return {
    resource: getMcpResourceUrl(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    resource_name: "Petra",
    scopes_supported: ["mcp"],
  };
}

/** RFC 8414 Authorization Server Metadata. */
export function authorizationServerMetadata(origin: string): Record<string, unknown> {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
    scopes_supported: ["mcp"],
  };
}

// ─── Redirect URIs ────────────────────────────────────────────────────────────

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CUSTOM_SCHEME_RE = /^[a-z][a-z0-9+.-]*$/;
const FORBIDDEN_SCHEMES = new Set(["javascript", "data", "file", "vbscript", "about", "blob"]);
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE_RE = /[\u0000-\u0020\u007F-\u009F]/;

/**
 * Registration policy (RFC 7591 + RFC 8252):
 *  - https:// any host; http:// only loopback (127.0.0.1 / localhost / [::1]);
 *  - private-use custom schemes (cursor://, vscode://) matching /^[a-z][a-z0-9+.-]*$/,
 *    except javascript/data/file/vbscript/about/blob;
 *  - no fragment, no userinfo, no whitespace/control chars, ≤ 500 chars.
 * Returns null when OK, otherwise an error reason.
 */
export function validateRedirectUriForRegistration(uri: string): string | null {
  if (typeof uri !== "string" || uri.length === 0) return "redirect_uri חסר";
  if (uri.length > MAX_REDIRECT_URI_LENGTH) return "redirect_uri ארוך מדי (מקסימום 500 תווים)";
  if (CONTROL_OR_SPACE_RE.test(uri)) return "redirect_uri מכיל תווים לא חוקיים";
  if (uri.includes("#")) return "redirect_uri לא יכול להכיל fragment (#)";

  const schemeMatch = /^([^:/?#]+):/.exec(uri);
  if (!schemeMatch) return "redirect_uri חייב להיות כתובת מלאה (absolute URI)";
  const scheme = schemeMatch[1].toLowerCase();

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return "redirect_uri אינו כתובת תקינה";
  }
  if (url.username || url.password) return "redirect_uri לא יכול להכיל פרטי משתמש (userinfo)";
  // Belt and braces: '@' in the authority part even when URL parsing dropped it.
  const afterScheme = uri.slice(scheme.length + 1);
  if (afterScheme.startsWith("//")) {
    const authority = afterScheme.slice(2).split(/[/?]/)[0] ?? "";
    if (authority.includes("@")) return "redirect_uri לא יכול להכיל פרטי משתמש (userinfo)";
  }

  if (scheme === "https") {
    if (!url.hostname) return "redirect_uri חייב לכלול שם שרת";
    return null;
  }
  if (scheme === "http") {
    if (!LOOPBACK_HOSTS.has(url.hostname)) {
      return "http:// מותר רק לכתובות loopback (127.0.0.1 / localhost / [::1]) — השתמש ב-https://";
    }
    return null;
  }
  if (!CUSTOM_SCHEME_RE.test(schemeMatch[1])) return "סכמת redirect_uri אינה חוקית";
  if (FORBIDDEN_SCHEMES.has(scheme)) return `סכמת redirect_uri "${scheme}" אסורה`;
  return null;
}

function parseLoopback(uri: string): URL | null {
  try {
    const u = new URL(uri);
    if (u.protocol !== "http:") return null;
    if (!LOOPBACK_HOSTS.has(u.hostname)) return null;
    if (u.username || u.password || u.hash || uri.includes("#")) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Exact string match against a registered redirect URI, or (RFC 8252 §7.3) a loopback
 * http URI on the same host with any port and identical path + query.
 */
export function redirectUriMatches(registered: string[], presented: string): boolean {
  if (typeof presented !== "string" || !presented || !Array.isArray(registered)) return false;
  if (registered.some((r) => typeof r === "string" && r === presented)) return true;

  const p = parseLoopback(presented);
  if (!p) return false;
  return registered.some((r) => {
    if (typeof r !== "string") return false;
    const reg = parseLoopback(r);
    if (!reg) return false;
    return reg.hostname === p.hostname && reg.pathname === p.pathname && reg.search === p.search;
  });
}

// ─── Client name ──────────────────────────────────────────────────────────────

// Control chars + bidi embeddings/overrides/isolates (anti-spoofing on the consent screen).
// eslint-disable-next-line no-control-regex
const STRIP_NAME_RE = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069\u2028\u2029\uFEFF]/g;

export function sanitizeClientName(name: unknown): string {
  if (typeof name !== "string") return CLIENT_NAME_FALLBACK;
  const cleaned = name.replace(STRIP_NAME_RE, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return CLIENT_NAME_FALLBACK;
  const chars = Array.from(cleaned); // don't split surrogate pairs
  const truncated = chars.length > CLIENT_NAME_MAX ? chars.slice(0, CLIENT_NAME_MAX).join("").trim() : cleaned;
  return truncated || CLIENT_NAME_FALLBACK;
}

function connectionNameFor(clientName: unknown): string {
  return Array.from(`${sanitizeClientName(clientName)}${CONNECTION_NAME_SUFFIX}`)
    .slice(0, CONNECTION_NAME_MAX)
    .join("");
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export function oauthCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-protocol-version",
    "Access-Control-Max-Age": "86400",
  };
}

export function oauthError(error: string, description: string, status = 400): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...oauthCorsHeaders(),
    },
  });
}

// ─── Consent gates ────────────────────────────────────────────────────────────

function isPlatformAdminRole(platformRole: string | null | undefined): boolean {
  return platformRole === "super_admin" || platformRole === "admin";
}

function isOwnerOrManager(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

type BusinessGateRow = {
  id: string;
  name: string;
  tier: string;
  status: string;
  featureOverrides: unknown;
};

/** Business-level gates shared by listing + consent (no profile). Returns a Hebrew reason or null. */
async function businessGateError(
  session: FullSession,
  business: BusinessGateRow | null | undefined,
  isPlatformAdmin: boolean
): Promise<{ error: string; status: number } | null> {
  if (!business) return { error: "העסק לא נמצא", status: 404 };
  if (business.status === "suspended") return { error: "העסק מושהה", status: 403 };
  if (business.status === "closed") return { error: "העסק סגור", status: 403 };

  // Server-side paywall — mirrors POST /api/mcp/connections exactly.
  const isInternalQa = isInternalTestEmail(session.user.email);
  if (
    !isPlatformAdmin &&
    !isInternalQa &&
    !hasFeatureWithOverrides(
      business.tier,
      "ai_assistant",
      (business.featureOverrides as Record<string, boolean> | null) ?? null
    )
  ) {
    return { error: "עוזר AI זמין במנוי פרו ומעלה. שדרג כדי לחבר.", status: 403 };
  }

  if (!(await isMcpAllowedBusiness(business.id))) {
    return { error: "העסק הזה אינו בבטא של עוזרי AI", status: 403 };
  }
  return null;
}

function activeConnectionWhere(businessId: string, now: Date) {
  return {
    businessId,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

/**
 * The user's own active OAuth connections in the business, least-recently-used first
 * (lastUsedAt ?? createdAt). Candidates for auto-revocation under limit #9.
 */
async function ownOAuthConnectionsLru(businessId: string, userId: string, now: Date) {
  const rows = await prisma.mcpConnection.findMany({
    where: {
      ...activeConnectionWhere(businessId, now),
      createdByUserId: userId,
      oauthClientId: { not: null },
    },
    select: { id: true, lastUsedAt: true, createdAt: true },
  });
  return rows.sort(
    (a, b) => (a.lastUsedAt ?? a.createdAt).getTime() - (b.lastUsedAt ?? b.createdAt).getTime()
  );
}

/** Limit #9 check without side effects: can a new connection be created (possibly by revoking an own OAuth one)? */
async function connectionLimitError(businessId: string, userId: string, now: Date): Promise<string | null> {
  const activeCount = await prisma.mcpConnection.count({ where: activeConnectionWhere(businessId, now) });
  if (activeCount < MAX_ACTIVE_CONNECTIONS) return null;
  const needed = activeCount - MAX_ACTIVE_CONNECTIONS + 1;
  const own = await ownOAuthConnectionsLru(businessId, userId, now);
  return own.length >= needed ? null : LIMIT_ERROR;
}

/** Resolve the session's relationship to a business: membership role, or platform-admin impersonation. */
function resolveGrantAccess(
  session: FullSession,
  businessId: string
): { allowed: boolean; membershipRole: string | null; isPlatformAdmin: boolean } {
  const isPlatformAdmin = isPlatformAdminRole(session.user.platformRole);
  const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
  const membershipRole = membership?.role ?? null;
  const viaImpersonation = isPlatformAdmin && session.impersonatedBusinessId === businessId;
  return { allowed: !!membership || viaImpersonation, membershipRole, isPlatformAdmin };
}

/**
 * Businesses the user may grant (active memberships with owner|manager role; platform admin:
 * all active memberships + impersonated business). Each with name + role + eligibility reason.
 *
 * Uses FullSession fields: `user.{id,email,platformRole,isActive}`, `memberships[].{businessId,role,isActive}`
 * (SessionMembership), `impersonatedBusinessId`.
 */
export async function listGrantableBusinesses(
  session: FullSession
): Promise<Array<{ businessId: string; name: string; role: string; eligible: boolean; reason?: string }>> {
  const isPlatformAdmin = isPlatformAdminRole(session.user.platformRole);

  const entries: Array<{ businessId: string; role: string }> = [];
  const seen = new Set<string>();
  for (const m of session.memberships) {
    if (!m.isActive || seen.has(m.businessId)) continue;
    seen.add(m.businessId);
    entries.push({ businessId: m.businessId, role: m.role });
  }
  if (isPlatformAdmin && session.impersonatedBusinessId && !seen.has(session.impersonatedBusinessId)) {
    seen.add(session.impersonatedBusinessId);
    // A platform admin is owner-level in an impersonated business (mirrors validateMcpToken).
    entries.push({ businessId: session.impersonatedBusinessId, role: "owner" });
  }
  if (entries.length === 0) return [];

  // Business names + gate fields in ONE query.
  const businesses = await prisma.business.findMany({
    where: { id: { in: entries.map((e) => e.businessId) } },
    select: { id: true, name: true, tier: true, status: true, featureOverrides: true },
  });
  const byId = new Map(businesses.map((b) => [b.id, b]));

  const userAllowed = session.user.isActive && isMcpAllowedUser(session.user.email, session.user.platformRole);
  const now = new Date();

  const results = await Promise.all(
    entries.map(async (e) => {
      const biz = byId.get(e.businessId);
      const base = { businessId: e.businessId, name: biz?.name ?? "", role: e.role };
      if (!userAllowed) {
        return { ...base, eligible: false, reason: "החשבון שלך אינו בבטא של עוזרי AI" };
      }
      if (!isPlatformAdmin && !isOwnerOrManager(e.role)) {
        return { ...base, eligible: false, reason: "רק בעלים או מנהל יכולים לחבר עוזר AI" };
      }
      const gate = await businessGateError(session, biz as BusinessGateRow | undefined, isPlatformAdmin);
      if (gate) return { ...base, eligible: false, reason: gate.error };
      const limit = await connectionLimitError(e.businessId, session.user.id, now);
      if (limit) return { ...base, eligible: false, reason: limit };
      return { ...base, eligible: true };
    })
  );
  return results;
}

/**
 * Runs ALL consent gates for one business (mirrors POST /api/mcp/connections):
 * isMcpAllowedUser, owner/manager (or platform admin), paywall ai_assistant (exempt platform
 * admin + internal QA), isMcpAllowedBusiness, capScopesForRole, connection limit #9.
 * Returns capped scopes or a Hebrew error.
 */
export async function checkConsentGates(
  session: FullSession,
  businessId: string,
  profile: string
): Promise<{ ok: true; scopes: string[]; role: string } | { ok: false; error: string; status: number }> {
  if (!session.user.isActive) return { ok: false, error: "החשבון מושבת", status: 403 };
  if (!isMcpAllowedUser(session.user.email, session.user.platformRole)) {
    return { ok: false, error: "החשבון שלך אינו בבטא של עוזרי AI", status: 403 };
  }
  if (typeof businessId !== "string" || !businessId) {
    return { ok: false, error: "יש לבחור עסק", status: 400 };
  }

  const { allowed, membershipRole, isPlatformAdmin } = resolveGrantAccess(session, businessId);
  if (!allowed) return { ok: false, error: "אין לך גישה לעסק הזה", status: 403 };
  if (!isPlatformAdmin && !isOwnerOrManager(membershipRole)) {
    return { ok: false, error: "אין לך הרשאה ליצור חיבור AI", status: 403 };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, tier: true, status: true, featureOverrides: true },
  });
  const gate = await businessGateError(session, business as BusinessGateRow | null, isPlatformAdmin);
  if (gate) return { ok: false, ...gate };

  if (
    typeof profile !== "string" ||
    !Object.prototype.hasOwnProperty.call(MCP_PROFILES, profile) ||
    !Array.isArray(MCP_PROFILES[profile])
  ) {
    return { ok: false, error: "פרופיל גישה לא תקין", status: 400 };
  }
  const scopes = capScopesForRole(MCP_PROFILES[profile], membershipRole, isPlatformAdmin);

  const limit = await connectionLimitError(businessId, session.user.id, new Date());
  if (limit) return { ok: false, error: limit, status: 400 };

  // Same createdByRole rule as POST /api/mcp/connections.
  return { ok: true, scopes, role: membershipRole ?? "owner" };
}

// ─── Authorization codes ──────────────────────────────────────────────────────

/** Persists a single-use code (SHA-256 at rest, 10 min TTL). Returns the raw code. */
export async function issueAuthCode(input: {
  clientId: string;
  userId: string;
  businessId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  profile: string;
  role: string;
  resource?: string | null;
}): Promise<string> {
  const { raw, hash } = generateAuthCode();
  const now = Date.now();
  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: hash,
      clientId: input.clientId,
      userId: input.userId,
      businessId: input.businessId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scopes: input.scopes,
      profile: input.profile,
      role: input.role,
      resource: input.resource ?? null,
      expiresAt: new Date(now + OAUTH_CODE_TTL_SEC * 1000),
    },
  });

  // Best-effort housekeeping: drop codes that expired more than a day ago.
  await prisma.oAuthAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date(now - DAY_MS) } } })
    .catch(() => {});

  return raw;
}

/**
 * Re-verify the grant holder at exchange/refresh time: user active + MCP-allowed, still an
 * active owner/manager member (or platform admin), business still active and MCP-allowed.
 */
async function verifyGrantHolder(
  userId: string,
  businessId: string
): Promise<{ role: string | null; isPlatformAdmin: boolean }> {
  const user = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: { isActive: true, platformRole: true, email: true },
  });
  if (!user || !user.isActive) throw new OAuthGrantError("invalid_grant", "המשתמש אינו פעיל");
  const isPlatformAdmin = isPlatformAdminRole(user.platformRole);
  if (!isMcpAllowedUser(user.email, user.platformRole)) {
    throw new OAuthGrantError("invalid_grant", "החשבון אינו בבטא של עוזרי AI");
  }

  const membership = await prisma.businessUser.findFirst({
    where: { businessId, userId, isActive: true },
    select: { role: true },
  });
  if (!isPlatformAdmin && (!membership || !isOwnerOrManager(membership.role))) {
    throw new OAuthGrantError("invalid_grant", "אין הרשאת בעלים/מנהל בעסק");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { status: true },
  });
  if (!business || business.status === "suspended" || business.status === "closed") {
    throw new OAuthGrantError("invalid_grant", "העסק אינו פעיל");
  }
  if (!(await isMcpAllowedBusiness(businessId))) {
    throw new OAuthGrantError("invalid_grant", "העסק אינו בבטא של עוזרי AI");
  }

  return { role: isPlatformAdmin ? "owner" : membership?.role ?? null, isPlatformAdmin };
}

/** Enforce limit #9 at creation: revoke the user's own LRU OAuth connections as needed. */
async function makeRoomForConnection(businessId: string, userId: string, now: Date): Promise<void> {
  const activeCount = await prisma.mcpConnection.count({ where: activeConnectionWhere(businessId, now) });
  if (activeCount < MAX_ACTIVE_CONNECTIONS) return;
  const needed = activeCount - MAX_ACTIVE_CONNECTIONS + 1;
  const own = await ownOAuthConnectionsLru(businessId, userId, now);
  if (own.length < needed) throw new OAuthGrantError("access_denied", LIMIT_ERROR);
  for (const c of own.slice(0, needed)) {
    await prisma.mcpConnection.updateMany({
      where: { id: c.id, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

function normalizeResource(r: string | null | undefined): string | null {
  if (r === null || r === undefined || r === "") return null;
  return stripOneTrailingSlash(r);
}

/** Exchange code → creates McpConnection (enforcing limit #9) and returns token response JSON. Throws OAuthGrantError on failure. */
export async function exchangeAuthCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource?: string | null;
}): Promise<TokenResponse> {
  const { code, clientId, redirectUri, codeVerifier } = input;
  if (typeof code !== "string" || !code) throw new OAuthGrantError("invalid_request", "חסר code");
  if (typeof clientId !== "string" || !clientId) throw new OAuthGrantError("invalid_request", "חסר client_id");
  if (typeof redirectUri !== "string" || !redirectUri) throw new OAuthGrantError("invalid_request", "חסר redirect_uri");
  if (typeof codeVerifier !== "string" || !codeVerifier) throw new OAuthGrantError("invalid_request", "חסר code_verifier");
  if (!AUTH_CODE_RE.test(code)) throw new OAuthGrantError("invalid_grant", "קוד ההרשאה אינו תקף");

  const codeHash = sha256Hex(code);
  const now = new Date();

  // Atomic single-use consumption (no $transaction — PgBouncer).
  const consumed = await prisma.oAuthAuthCode.updateMany({
    where: { codeHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    throw new OAuthGrantError("invalid_grant", "קוד ההרשאה אינו תקף, פג תוקפו או שכבר נוצל");
  }

  const row = await prisma.oAuthAuthCode.findUnique({
    where: { codeHash },
    include: { client: { select: { id: true, clientName: true } } },
  });
  if (!row) throw new OAuthGrantError("invalid_grant", "קוד ההרשאה אינו תקף");

  // Binding checks (the code is already burned — a failed attempt cannot be retried).
  if (!timingSafeEqualStr(row.clientId, clientId)) {
    throw new OAuthGrantError("invalid_grant", "הקוד הונפק ללקוח אחר");
  }
  if (!timingSafeEqualStr(row.redirectUri, redirectUri)) {
    throw new OAuthGrantError("invalid_grant", "redirect_uri אינו תואם");
  }
  if (!verifyPkceS256(codeVerifier, row.codeChallenge)) {
    throw new OAuthGrantError("invalid_grant", "אימות PKCE נכשל");
  }
  const presentedResource = normalizeResource(input.resource);
  const boundResource = normalizeResource(row.resource);
  if (presentedResource && boundResource && presentedResource !== boundResource) {
    throw new OAuthGrantError("invalid_grant", "resource אינו תואם");
  }

  // Re-verify the grantor NOW (membership may have changed since consent).
  const holder = await verifyGrantHolder(row.userId, row.businessId);
  const scopes = capScopesForRole(row.scopes, holder.role, holder.isPlatformAdmin);

  await makeRoomForConnection(row.businessId, row.userId, now);

  const access = generateMcpToken();
  const refresh = generateRefreshToken();
  await prisma.mcpConnection.create({
    data: {
      businessId: row.businessId,
      name: connectionNameFor(row.client?.clientName),
      tokenHash: access.hash,
      refreshTokenHash: refresh.hash,
      scopes,
      profile: row.profile,
      createdByUserId: row.userId,
      createdByRole: row.role ?? holder.role,
      expiresAt: new Date(now.getTime() + OAUTH_REFRESH_TTL_DAYS * DAY_MS),
      accessExpiresAt: new Date(now.getTime() + OAUTH_ACCESS_TOKEN_TTL_SEC * 1000),
      oauthClientId: row.clientId,
    },
    select: { id: true },
  });

  await prisma.oAuthClient
    .update({ where: { id: row.clientId }, data: { lastUsedAt: now } })
    .catch(() => {});

  return {
    access_token: access.raw,
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TOKEN_TTL_SEC,
    refresh_token: refresh.raw,
    scope: scopes.join(" "),
  };
}

// ─── Refresh / revoke ─────────────────────────────────────────────────────────

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  resource?: string | null;
}): Promise<TokenResponse> {
  const { refreshToken, clientId } = input;
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new OAuthGrantError("invalid_request", "חסר refresh_token");
  }
  if (typeof clientId !== "string" || !clientId) throw new OAuthGrantError("invalid_request", "חסר client_id");
  if (!REFRESH_TOKEN_RE.test(refreshToken)) throw new OAuthGrantError("invalid_grant", "refresh_token אינו תקף");

  const presentedHash = sha256Hex(refreshToken);
  const now = new Date();

  const conn = await prisma.mcpConnection.findUnique({
    where: { refreshTokenHash: presentedHash },
    select: {
      id: true,
      businessId: true,
      scopes: true,
      oauthClientId: true,
      createdByUserId: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!conn) {
    // Reuse detection: a rotated-out refresh token presented again → the token family
    // is compromised; revoke the live connection.
    const reused = await prisma.mcpConnection.findFirst({
      where: { prevRefreshTokenHash: presentedHash, revokedAt: null },
      select: { id: true },
    });
    if (reused) {
      await prisma.mcpConnection.updateMany({
        where: { id: reused.id, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    throw new OAuthGrantError("invalid_grant", "refresh_token אינו תקף");
  }

  if (conn.revokedAt) throw new OAuthGrantError("invalid_grant", "החיבור בוטל");
  if (!conn.oauthClientId || !timingSafeEqualStr(conn.oauthClientId, clientId)) {
    throw new OAuthGrantError("invalid_grant", "refresh_token הונפק ללקוח אחר");
  }
  if (conn.expiresAt && conn.expiresAt.getTime() <= now.getTime()) {
    throw new OAuthGrantError("invalid_grant", "פג תוקף החיבור — יש להתחבר מחדש");
  }
  if (!conn.createdByUserId) throw new OAuthGrantError("invalid_grant", "refresh_token אינו תקף");

  const holder = await verifyGrantHolder(conn.createdByUserId, conn.businessId);
  const scopes = capScopesForRole(conn.scopes, holder.role, holder.isPlatformAdmin);

  const access = generateMcpToken();
  const refresh = generateRefreshToken();
  // Atomic rotation (no $transaction): only succeeds if the presented token is still current.
  const rotated = await prisma.mcpConnection.updateMany({
    where: { id: conn.id, refreshTokenHash: presentedHash, revokedAt: null },
    data: {
      tokenHash: access.hash,
      refreshTokenHash: refresh.hash,
      prevRefreshTokenHash: presentedHash,
      accessExpiresAt: new Date(now.getTime() + OAUTH_ACCESS_TOKEN_TTL_SEC * 1000),
      expiresAt: new Date(now.getTime() + OAUTH_REFRESH_TTL_DAYS * DAY_MS),
    },
  });
  if (rotated.count !== 1) throw new OAuthGrantError("invalid_grant", "refresh_token אינו תקף");

  await prisma.oAuthClient
    .update({ where: { id: conn.oauthClientId }, data: { lastUsedAt: now } })
    .catch(() => {});

  return {
    access_token: access.raw,
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TOKEN_TTL_SEC,
    refresh_token: refresh.raw,
    scope: scopes.join(" "),
  };
}

/** RFC 7009: access or refresh token → revokedAt=now; unknown/malformed token = no-op. */
export async function revokeToken(token: string): Promise<void> {
  if (typeof token !== "string" || !token) return;
  const now = new Date();
  if (REFRESH_TOKEN_RE.test(token)) {
    await prisma.mcpConnection.updateMany({
      where: { refreshTokenHash: sha256Hex(token), revokedAt: null },
      data: { revokedAt: now },
    });
    return;
  }
  if (token.startsWith(ACCESS_TOKEN_PREFIX) && ACCESS_TOKEN_RE.test(token)) {
    await prisma.mcpConnection.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
