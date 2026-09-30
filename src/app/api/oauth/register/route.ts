export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/register — RFC 7591 Dynamic Client Registration (public).
 *
 * Public clients only: every client is registered with
 * `token_endpoint_auth_method: "none"` and never receives a client_secret
 * (a client that asks for another auth method gets "none" back — RFC 7591 §3.2.1
 * lets the server substitute values). Security rests on PKCE S256 + exact
 * redirect_uri matching at /oauth/authorize, plus the consent screen.
 *
 * Rate limited per IP (200/hour — claude.ai registers from shared backend IPs) plus a global
 * cap (2000/hour). Body ≤ 10KB, ≤ 10 redirect_uris. After a successful registration, stale
 * never-connected clients (> 30 days) are cleaned up (best effort, bounded).
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  oauthCorsHeaders,
  oauthError,
  sanitizeClientName,
  validateRedirectUriForRegistration,
  cleanupStaleOAuthClients,
} from "@/lib/mcp-oauth";

const MAX_BODY_BYTES = 10 * 1024;
const MAX_REDIRECT_URIS = 10;
const REGISTER_RATE_LIMIT = { max: 200, windowMs: 60 * 60 * 1000 }; // 200/hour per IP
const REGISTER_GLOBAL_LIMIT = { max: 2000, windowMs: 60 * 60 * 1000 }; // 2000/hour across all IPs
const SUPPORTED_GRANT_TYPES = ["authorization_code", "refresh_token"];
const SUPPORTED_RESPONSE_TYPES = ["code"];

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

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync("oauth:register", ip, REGISTER_RATE_LIMIT);
  if (!limited.allowed) {
    const res = oauthError("too_many_requests", "Too many client registrations from this IP. Try again later.", 429);
    res.headers.set("Retry-After", String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))));
    return res;
  }
  const globalLimited = await rateLimitAsync("oauth:register:global", "global", REGISTER_GLOBAL_LIMIT);
  if (!globalLimited.allowed) {
    const res = oauthError("too_many_requests", "Too many client registrations. Try again later.", 429);
    res.headers.set("Retry-After", String(Math.max(1, Math.ceil(globalLimited.retryAfterMs / 1000))));
    return res;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return oauthError("invalid_client_metadata", "Content-Type must be application/json");
  }

  const text = await readBoundedText(request, MAX_BODY_BYTES);
  if (text === null) {
    return oauthError("invalid_client_metadata", "Request body too large (max 10KB)", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return oauthError("invalid_client_metadata", "Request body is not valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return oauthError("invalid_client_metadata", "Request body must be a JSON object");
  }
  const meta = body as Record<string, unknown>;

  // redirect_uris — required, non-empty, bounded, each individually validated.
  const rawUris = meta.redirect_uris;
  if (!isStringArray(rawUris) || rawUris.length === 0) {
    return oauthError("invalid_redirect_uri", "redirect_uris must be a non-empty array of strings");
  }
  if (rawUris.length > MAX_REDIRECT_URIS) {
    return oauthError("invalid_redirect_uri", `At most ${MAX_REDIRECT_URIS} redirect_uris are allowed`);
  }
  const redirectUris = Array.from(new Set(rawUris));
  for (const uri of redirectUris) {
    const reason = validateRedirectUriForRegistration(uri);
    if (reason) return oauthError("invalid_redirect_uri", reason);
  }

  // grant_types / response_types — optional, but if present must be supported.
  if (meta.grant_types !== undefined) {
    if (!isStringArray(meta.grant_types) || !meta.grant_types.every((g) => SUPPORTED_GRANT_TYPES.includes(g))) {
      return oauthError(
        "invalid_client_metadata",
        `grant_types must be a subset of: ${SUPPORTED_GRANT_TYPES.join(", ")}`
      );
    }
  }
  if (meta.response_types !== undefined) {
    if (!isStringArray(meta.response_types) || !meta.response_types.every((r) => SUPPORTED_RESPONSE_TYPES.includes(r))) {
      return oauthError(
        "invalid_client_metadata",
        `response_types must be a subset of: ${SUPPORTED_RESPONSE_TYPES.join(", ")}`
      );
    }
  }
  // token_endpoint_auth_method / client_secret: ignored — always a public client ("none").

  const clientName = sanitizeClientName(meta.client_name);

  let client: { id: string; clientName: string; redirectUris: string[]; createdAt: Date };
  try {
    client = await prisma.oAuthClient.create({
      data: { clientName, redirectUris },
      select: { id: true, clientName: true, redirectUris: true, createdAt: true },
    });
  } catch (err) {
    console.error("[oauth/register] failed to store client:", err instanceof Error ? err.message : "unknown");
    return oauthError("server_error", "Could not register client", 500);
  }

  // Best-effort housekeeping (awaited — Vercel kills stray promises; never throws).
  await cleanupStaleOAuthClients().catch(() => 0);

  return new Response(
    JSON.stringify({
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: SUPPORTED_GRANT_TYPES,
      response_types: SUPPORTED_RESPONSE_TYPES,
      token_endpoint_auth_method: "none",
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        ...oauthCorsHeaders(),
      },
    }
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
