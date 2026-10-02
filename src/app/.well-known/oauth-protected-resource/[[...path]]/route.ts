export const dynamic = "force-dynamic";

/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata for the Petra MCP endpoint.
 *
 * Served at both `/.well-known/oauth-protected-resource` and the path-suffixed
 * form `/.well-known/oauth-protected-resource/api/mcp` (the URL advertised in
 * the `resource_metadata` parameter of `/api/mcp`'s 401 WWW-Authenticate).
 * Public (middleware allowlist) — no secrets, no DB.
 */
import { NextRequest } from "next/server";
import { getOAuthOrigin, protectedResourceMetadata, oauthCorsHeaders, oauthError } from "@/lib/mcp-oauth";

// Only one protected resource exists: /api/mcp. Anything else is not ours.
function isKnownResourcePath(path: string[] | undefined): boolean {
  const joined = (path ?? []).join("/");
  return joined === "" || joined === "api/mcp";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
): Promise<Response> {
  if (!isKnownResourcePath(params.path)) {
    return oauthError("not_found", "Unknown protected resource", 404);
  }
  const origin = getOAuthOrigin(request);
  return new Response(JSON.stringify(protectedResourceMetadata(origin)), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...oauthCorsHeaders(),
    },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
