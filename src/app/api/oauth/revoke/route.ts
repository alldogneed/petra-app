export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/revoke — RFC 7009 token revocation (public clients).
 *
 * `token` may be an access token (petra_mcp_…) or refresh token (petra_mcpr_…);
 * either revokes the whole grant (McpConnection.revokedAt). Unknown/invalid
 * tokens still get 200 (RFC 7009 §2.2) so the endpoint can't be used as an
 * oracle. `token_type_hint` is accepted and ignored. Rate limited per IP (60/min).
 */
import { NextRequest } from "next/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { revokeToken, oauthCorsHeaders, oauthError } from "@/lib/mcp-oauth";

const MAX_BODY_BYTES = 10 * 1024;
const REVOKE_RATE_LIMIT = { max: 60, windowMs: 60_000 }; // 60/min per IP

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

/** Extract `token` from a form-urlencoded or JSON body. */
function extractToken(contentType: string, text: string): string | null | "bad_request" {
  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(text) as unknown;
      if (!body || typeof body !== "object" || Array.isArray(body)) return "bad_request";
      const t = (body as Record<string, unknown>).token;
      return typeof t === "string" && t ? t : null;
    } catch {
      return "bad_request";
    }
  }
  if (contentType === "" || contentType.includes("application/x-www-form-urlencoded")) {
    const sp = new URLSearchParams(text);
    if (sp.getAll("token").length > 1) return "bad_request";
    return sp.get("token") || null;
  }
  return "bad_request";
}

function ok(): Response {
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache", ...oauthCorsHeaders() },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync("oauth:revoke", ip, REVOKE_RATE_LIMIT);
  if (!limited.allowed) {
    const res = oauthError("too_many_requests", "Too many revocation requests from this IP. Try again later.", 429);
    res.headers.set("Retry-After", String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))));
    return res;
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const text = await readBoundedText(request, MAX_BODY_BYTES);
  if (text === null) return oauthError("invalid_request", "Request body too large (max 10KB)", 413);

  const token = extractToken(contentType, text);
  if (token === "bad_request") return oauthError("invalid_request", "Malformed revocation request");
  if (!token) return oauthError("invalid_request", "Missing token");

  try {
    await revokeToken(token);
  } catch (err) {
    // Never log the token itself.
    console.error("[oauth/revoke] failed:", err instanceof Error ? err.message : "unknown");
    return oauthError("temporarily_unavailable", "Revocation failed, please retry", 503);
  }
  return ok();
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
