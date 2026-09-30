export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/token — OAuth 2.1 token endpoint (public clients, RFC 6749 §3.2).
 *
 * grant_type=authorization_code  → code + redirect_uri + client_id + code_verifier (PKCE S256)
 * grant_type=refresh_token       → refresh_token + client_id (rotating refresh tokens)
 * Optional `resource` (RFC 8707) must name this server's /api/mcp.
 *
 * Accepts application/x-www-form-urlencoded (standard) and application/json.
 * Body ≤ 10KB. Rate limited per IP (60/min). Errors per RFC 6749 §5.2.
 * Tokens/codes/verifiers are never logged.
 */
import { NextRequest } from "next/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  exchangeAuthCode,
  refreshAccessToken,
  OAuthGrantError,
  oauthCorsHeaders,
  oauthError,
} from "@/lib/mcp-oauth";

const MAX_BODY_BYTES = 10 * 1024;
const TOKEN_RATE_LIMIT = { max: 60, windowMs: 60_000 }; // 60/min per IP

/** Same IP extraction as getClientIp in src/app/api/mcp/route.ts (platform headers first). */
function getClientIp(request: NextRequest): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Read the request body as text, refusing anything over `max` bytes. null = too large / unreadable. */
async function readBoundedText(request: NextRequest, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

type ParsedParams = { ok: true; params: Map<string, string> } | { ok: false; description: string };

/** Parse form-urlencoded or JSON body into flat string params. Repeated params are rejected (RFC 6749 §3.2). */
function parseParams(contentType: string, text: string): ParsedParams {
  const params = new Map<string, string>();
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, description: "Request body is not valid JSON" };
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, description: "Request body must be a JSON object" };
    }
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      if (typeof v !== "string") return { ok: false, description: `Parameter ${k} must be a string` };
      params.set(k, v);
    }
    return { ok: true, params };
  }
  if (contentType === "" || contentType.includes("application/x-www-form-urlencoded")) {
    const sp = new URLSearchParams(text);
    for (const [k, v] of Array.from(sp.entries())) {
      if (params.has(k)) return { ok: false, description: `Parameter ${k} must not be repeated` };
      params.set(k, v);
    }
    return { ok: true, params };
  }
  return { ok: false, description: "Content-Type must be application/x-www-form-urlencoded or application/json" };
}

/** Public clients may still send client_id via HTTP Basic (empty secret) — accept it as the identifier only. */
function clientIdFromBasic(request: NextRequest): string | undefined {
  const auth = request.headers.get("authorization");
  if (!auth || !/^basic\s+/i.test(auth)) return undefined;
  try {
    const decoded = atob(auth.replace(/^basic\s+/i, "").trim());
    const idx = decoded.indexOf(":");
    const id = decodeURIComponent(idx >= 0 ? decoded.slice(0, idx) : decoded);
    return id || undefined;
  } catch {
    return undefined;
  }
}

function noCache(res: Response): Response {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  return res;
}

function tokenError(error: string, description: string, status = 400): Response {
  return noCache(oauthError(error, description, status));
}

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync("oauth:token", ip, TOKEN_RATE_LIMIT);
  if (!limited.allowed) {
    const res = tokenError("too_many_requests", "Too many token requests from this IP. Try again later.", 429);
    res.headers.set("Retry-After", String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))));
    return res;
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const text = await readBoundedText(request, MAX_BODY_BYTES);
  if (text === null) return tokenError("invalid_request", "Request body too large (max 10KB)", 413);

  const parsed = parseParams(contentType, text);
  if (!parsed.ok) return tokenError("invalid_request", parsed.description);
  const p = parsed.params;

  const grantType = p.get("grant_type");
  if (!grantType) return tokenError("invalid_request", "Missing grant_type");

  const clientId = p.get("client_id") || clientIdFromBasic(request);
  const resource = p.get("resource") ?? null;

  try {
    let tokens;
    if (grantType === "authorization_code") {
      const code = p.get("code");
      const redirectUri = p.get("redirect_uri");
      const codeVerifier = p.get("code_verifier");
      if (!code) return tokenError("invalid_request", "Missing code");
      if (!redirectUri) return tokenError("invalid_request", "Missing redirect_uri");
      if (!codeVerifier) return tokenError("invalid_request", "Missing code_verifier (PKCE is required)");
      if (!clientId) return tokenError("invalid_client", "Missing client_id", 401);
      tokens = await exchangeAuthCode({ code, clientId, redirectUri, codeVerifier, resource });
    } else if (grantType === "refresh_token") {
      const refreshToken = p.get("refresh_token");
      if (!refreshToken) return tokenError("invalid_request", "Missing refresh_token");
      if (!clientId) return tokenError("invalid_client", "Missing client_id", 401);
      tokens = await refreshAccessToken({ refreshToken, clientId, resource });
    } else {
      return tokenError("unsupported_grant_type", "Supported grant types: authorization_code, refresh_token");
    }

    return new Response(JSON.stringify(tokens), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        ...oauthCorsHeaders(),
      },
    });
  } catch (err) {
    if (err instanceof OAuthGrantError) {
      return tokenError(err.code, err.message, err.code === "invalid_client" ? 401 : 400);
    }
    // Never log request params (codes / verifiers / refresh tokens).
    console.error(`[oauth/token] ${grantType} failed:`, err instanceof Error ? err.message : "unknown");
    return tokenError("server_error", "Token request failed", 500);
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
