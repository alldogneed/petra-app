export const dynamic = "force-dynamic";

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
 *
 * Served at `/.well-known/oauth-authorization-server` and, for clients that
 * apply RFC 8414 path insertion to the MCP resource URL, at
 * `/.well-known/oauth-authorization-server/api/mcp`. Public, no DB.
 */
import { NextRequest } from "next/server";
import { getOAuthOrigin, authorizationServerMetadata, oauthCorsHeaders, oauthError } from "@/lib/mcp-oauth";

function isKnownPath(path: string[] | undefined): boolean {
  const joined = (path ?? []).join("/");
  return joined === "" || joined === "api/mcp";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
): Promise<Response> {
  if (!isKnownPath(params.path)) {
    return oauthError("not_found", "Unknown authorization server", 404);
  }
  const origin = getOAuthOrigin(request);
  return new Response(JSON.stringify(authorizationServerMetadata(origin)), {
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
