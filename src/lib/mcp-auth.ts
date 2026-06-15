/**
 * MCP authentication helpers — token generation, validation, audit logging.
 * Server-side only. Never import from client components.
 */
import crypto from "crypto";
import prisma from "@/lib/prisma";

const TOKEN_PREFIX = "petra_mcp_";
const TOKEN_BYTES = 32;

/** Generate a new MCP bearer token. Returns the raw token (shown once) and its hash. */
export function generateMcpToken(): { raw: string; hash: string } {
  const raw = TOKEN_PREFIX + crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface McpAuthResult {
  connectionId: string;
  businessId: string;
  scopes: string[];
}

/**
 * Validate a bearer token from an MCP request.
 * Returns the auth result, or null if invalid/revoked.
 */
export async function validateMcpToken(raw: string): Promise<McpAuthResult | null> {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;

  const hash = hashToken(raw);
  const conn = await prisma.mcpConnection.findFirst({
    where: { tokenHash: hash, revokedAt: null },
    select: { id: true, businessId: true, scopes: true },
  });

  if (!conn) return null;

  // Update lastUsedAt without awaiting — fire and forget
  prisma.mcpConnection.update({
    where: { id: conn.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    connectionId: conn.id,
    businessId: conn.businessId,
    scopes: conn.scopes,
  };
}

/** Write an audit log entry. Swallows errors so tool failures don't cascade. */
export async function auditLog(
  connectionId: string,
  toolName: string,
  params: Record<string, unknown>,
  status: "success" | "error" | "denied" | "rate_limited",
  resultSummary?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.mcpAuditLog.create({
      data: {
        connectionId,
        toolName,
        params: params as any,
        status,
        resultSummary: resultSummary ?? null,
        errorMessage: errorMessage ?? null,
      },
    });
  } catch {
    // Never throw from audit logging
  }
}

/** Extract bearer token from Authorization header. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
