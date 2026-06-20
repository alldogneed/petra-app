export const dynamic = "force-dynamic";

/**
 * Petra MCP Server — path-based token variant.
 *
 * Identical to `/api/mcp` but reads the bearer token from the URL path instead
 * of the Authorization header. This exists so non-technical users can connect
 * via Claude Desktop's "Add custom connector" UI, which only accepts a URL
 * (no header field). They paste a single URL:
 *
 *   https://petra-app.com/api/mcp/u/petra_mcp_<token>
 *
 * Auth, rate limiting, isolation and audit logging are all handled by the shared
 * `handleMcpRequest` — this file only forwards the path token.
 *
 * NOTE: a token in the URL is captured by access logs. The header flow (/api/mcp)
 * remains the more secure, recommended option for technical integrations.
 */

import { NextRequest } from "next/server";
import { handleMcpRequest } from "../../route";

function handler(request: NextRequest, { params }: { params: { token: string } }): Promise<Response> {
  return handleMcpRequest(request, params.token);
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
