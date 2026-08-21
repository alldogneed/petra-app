/**
 * MCP authentication helpers — token generation, validation, audit logging.
 * Server-side only. Never import from client components.
 */
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { isMcpAllowedBusiness } from "@/lib/mcp-allowlist";

const TOKEN_PREFIX = "petra_mcp_";
const TOKEN_BYTES = 32;

/** Canonical scope set granted to new MCP connections. */
export const DEFAULT_MCP_SCOPES = [
  "read:clients",
  "read:appointments",
  "read:stats",
  "read:services",
  "read:leads",
  "read:orders",
  "read:pets",
  "read:boarding",
  "read:training",
  "read:tasks",
  "read:analytics",
  "read:payments",
  "write:appointments",
  "write:notes",
  "write:reminders",
  "write:clients",
  "write:leads",
  "write:orders",
  "write:tasks",
  "write:boarding",
  "write:pets",
  "write:services",
  "write:payments",
  "write:training",
];

/** Read-only subset — granted when a connection is created with readOnly=true. */
export const READ_ONLY_MCP_SCOPES = DEFAULT_MCP_SCOPES.filter((s) => s.startsWith("read:"));

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
export async function validateMcpToken(raw: string, opts: { touch?: boolean } = {}): Promise<McpAuthResult | null> {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;

  const hash = hashToken(raw);
  const conn = await prisma.mcpConnection.findFirst({
    where: { tokenHash: hash, revokedAt: null },
    select: { id: true, businessId: true, scopes: true },
  });

  if (!conn) return null;

  // Private beta gate: tokens of non-allowlisted businesses are inert.
  if (!(await isMcpAllowedBusiness(conn.businessId))) return null;

  // lastUsedAt feeds the stale-token review in the connections UI. Callers that
  // rate-limit should pass touch:false and call touchMcpConnection() after the
  // limiter, so an over-limit token doesn't cost a write per request.
  if (opts.touch !== false) await touchMcpConnection(conn.id);

  return {
    connectionId: conn.id,
    businessId: conn.businessId,
    scopes: conn.scopes,
  };
}

/** Record that a connection was used (awaited — Vercel kills stray promises). */
export async function touchMcpConnection(connectionId: string): Promise<void> {
  await prisma.mcpConnection.update({
    where: { id: connectionId },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});
}

/**
 * PII keys redacted from audit-log params. The log keeps the key (so the call
 * shape is auditable) but masks the value — full names/phones/notes of
 * customers must not accumulate in McpAuditLog.
 */
const PII_PARAM_KEYS = new Set(["name", "phone", "email", "address", "notes", "note", "reason", "search", "item_name", "requested_service", "city", "tags", "title", "description", "pet_name", "pet_notes", "checkin_notes", "checkout_notes"]);

function redactParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (PII_PARAM_KEYS.has(key) && typeof value === "string" && value.length > 0) {
      out[key] = `${value.slice(0, 2)}***`;
    } else if (typeof value === "string" && value.length > 200) {
      out[key] = value.slice(0, 200) + "…";
    } else {
      out[key] = value;
    }
  }
  return out;
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
        params: redactParams(params) as any,
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
