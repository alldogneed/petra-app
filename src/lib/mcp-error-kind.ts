/**
 * MCP audit "error" rows come in two kinds:
 * - expected answers: the tool worked and refused for a business reason (record not
 *   found / deleted, room full, duplicate phone, missing field, time conflict…);
 * - system errors: something in Petra failed.
 * Only system errors are counted as "שגיאות" in /owner and /owner/mcp.
 * Client-safe (no prisma import).
 */
export const EXPECTED_MCP_ERROR_PATTERNS: readonly string[] = [
  "not found",
  "לא נמצא", // also "לא נמצאה"
  "החדר מלא",
  "כבר קיים",
  "שדה חובה",
  "לא תקין",
  "לא צוין",
  "מתנגש",
];

export function isExpectedMcpError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return EXPECTED_MCP_ERROR_PATTERNS.some((p) => m.includes(p));
}

/** Prisma `where` for McpAuditLog rows that are real system errors. */
export function mcpSystemErrorWhere() {
  return {
    status: "error",
    NOT: {
      OR: EXPECTED_MCP_ERROR_PATTERNS.map((p) => ({
        errorMessage: { contains: p, mode: "insensitive" as const },
      })),
    },
  };
}
