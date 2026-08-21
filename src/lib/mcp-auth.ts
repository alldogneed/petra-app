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
  "admin:destructive",
];

/**
 * Irreversible operations (hard deletes, forced cancellation of paid orders, deleting
 * calendar blocks). Owner-only — managers get "pending approval" in the UI, so their
 * MCP tokens simply don't carry this scope.
 */
export const ADMIN_SCOPE = "admin:destructive";

/** Read-only subset — granted for profile "read" (or legacy readOnly=true). */
export const READ_ONLY_MCP_SCOPES = DEFAULT_MCP_SCOPES.filter((s) => s.startsWith("read:"));

/** Access profiles offered in the connections UI. "full" = everything the minter's role allows. */
export const MCP_PROFILES: Record<string, string[]> = {
  read: READ_ONLY_MCP_SCOPES,
  intake: ["read:clients", "read:leads", "read:tasks", "read:services", "read:pets", "write:clients", "write:leads", "write:tasks", "write:notes"],
  calendar: ["read:clients", "read:appointments", "read:services", "read:training", "read:boarding", "read:tasks", "write:appointments", "write:reminders"],
  boarding: ["read:clients", "read:pets", "read:boarding", "read:appointments", "write:boarding", "write:notes"],
  full: DEFAULT_MCP_SCOPES,
};
export const MCP_PROFILE_LABELS: Record<string, string> = {
  read: "קריאה בלבד",
  intake: "קבלה — לידים, משימות, לקוחות",
  calendar: "יומן — תורים וזמינות",
  boarding: "פנסיון",
  full: "מלא",
};

/** Scopes a manager-minted token can never carry (mirrors TENANT_PERMS: no FINANCE_SUMMARY, no CRITICAL_DELETE). */
export const MANAGER_DENIED_SCOPES = ["read:analytics", "write:payments", ADMIN_SCOPE];

/**
 * Cap a scope list by the minter's tenant role. owner / platform admin → unchanged;
 * manager → minus MANAGER_DENIED_SCOPES; anything else (staff/volunteer/unknown) → read-only.
 * Applied at mint time AND at every token validation (so a demoted user's token shrinks).
 */
export function capScopesForRole(scopes: string[], role: string | null | undefined, isPlatformAdmin = false): string[] {
  if (isPlatformAdmin || role === "owner") return scopes;
  if (role === "manager") return scopes.filter((s) => !MANAGER_DENIED_SCOPES.includes(s));
  return scopes.filter((s) => s.startsWith("read:"));
}

/** Default token lifetime for new connections. */
export const MCP_TOKEN_TTL_DAYS = 180;

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
  /** PlatformUser who minted the token (null for legacy connections). */
  createdByUserId: string | null;
  /** Current tenant role of the minter (null when unknown/legacy → treated as owner-level). */
  minterRole: string | null;
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
    select: { id: true, businessId: true, scopes: true, createdByUserId: true, expiresAt: true },
  });

  if (!conn) return null;

  // Expiry (new tokens default to MCP_TOKEN_TTL_DAYS; legacy rows have null = no expiry).
  if (conn.expiresAt && conn.expiresAt.getTime() < Date.now()) return null;

  // Private beta gate: tokens of non-allowlisted businesses are inert.
  if (!(await isMcpAllowedBusiness(conn.businessId))) return null;

  // Governance: a token is tied to the person who minted it. If that member was
  // removed/deactivated from the business the token dies; if their role changed
  // the scopes are re-capped to the CURRENT role on every request.
  let minterRole: string | null = null;
  if (conn.createdByUserId) {
    const membership = await prisma.businessUser.findFirst({
      where: { businessId: conn.businessId, userId: conn.createdByUserId, isActive: true },
      select: { role: true, user: { select: { isActive: true, platformRole: true } } },
    });
    if (!membership || !membership.user.isActive) return null;
    minterRole = membership.role;
    const isPlatformAdmin = membership.user.platformRole === "super_admin" || membership.user.platformRole === "admin";
    conn.scopes = capScopesForRole(conn.scopes, minterRole, isPlatformAdmin);
  }

  // lastUsedAt feeds the stale-token review in the connections UI. Callers that
  // rate-limit should pass touch:false and call touchMcpConnection() after the
  // limiter, so an over-limit token doesn't cost a write per request.
  if (opts.touch !== false) await touchMcpConnection(conn.id);

  return {
    connectionId: conn.id,
    businessId: conn.businessId,
    scopes: conn.scopes,
    createdByUserId: conn.createdByUserId ?? null,
    minterRole,
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
const PII_PARAM_KEYS = new Set(["name", "phone", "email", "address", "notes", "note", "reason", "search", "item_name", "requested_service", "city", "tags", "title", "description", "pet_name", "pet_notes", "checkin_notes", "checkout_notes", "medical_notes", "food_notes", "behavior_notes", "allergies", "medical_conditions", "microchip", "homework", "practice_items", "next_session_goals", "trainer_name", "invoice_number"]);

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
