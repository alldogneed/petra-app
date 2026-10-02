export const dynamic = "force-dynamic";

/**
 * Some MCP clients probe OpenID Connect discovery before RFC 8414. Petra is a
 * plain OAuth 2.1 AS (no id_token), so this serves the same RFC 8414 document.
 */
import { NextRequest } from "next/server";
import { getOAuthOrigin, authorizationServerMetadata, oauthCorsHeaders } from "@/lib/mcp-oauth";

export async function GET(request: NextRequest): Promise<Response> {
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
