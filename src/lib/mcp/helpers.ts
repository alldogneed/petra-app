/**
 * Shared helpers for Petra MCP tool modules (server-side only).
 *
 * Every tool module receives a ToolCtx built by /api/mcp/route.ts and registers
 * its tools on the McpServer. Keep all customer-controlled strings inside
 * safeField() and all dates inside heDate() — see route.ts header for why.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@/lib/prisma";
import { auditLog } from "@/lib/mcp-auth";

export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text" as const, text: `❌ שגיאה: ${message}` }], isError: true };
}

// Newlines, tabs, C0 control chars and DEL — built without literal escapes so the
// source file stays free of raw control bytes.
const CONTROL_CHARS = new RegExp(
  "[\\r\\n\\t" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) +
    // Unicode line/paragraph separators, bidi overrides/isolates, zero-width & BOM —
    // these render as breaks or visually reorder RTL text, so a hostile lead value
    // can't smuggle a fake "instructions" line past the newline strip.
    "\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\u200b-\\u200f\\ufeff]+",
  "g"
);

/**
 * Sanitize a customer/lead-controlled string before interpolating it into tool
 * output. Names, notes and requested services can be created by third parties
 * (e.g. leads via the public webhook) — stripping newlines/control chars keeps
 * a hostile value from injecting fake "instructions" lines into the AI client.
 */
export function safeField(value: unknown, maxLen = 120): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(CONTROL_CHARS, " ").slice(0, maxLen).trim();
}

/** YYYY-MM-DD of "now" in Israel time. */
export function israelTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/** Start of the current day in Israel time, as a Date (UTC midnight of that YMD — matches how Appointment.date is stored). */
export function israelStartOfToday(): Date {
  return new Date(`${israelTodayYmd()}T00:00:00.000Z`);
}

/** Format a date for tool output in Israel time. */
export function heDate(d: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(d).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", ...opts });
}

/** Israel-local YYYY-MM-DD of a timestamp (for day-equality filters). */
export function israelYmd(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/** Strict YYYY-MM-DD validation (returns null if invalid). */
export function parseYmd(s: string | undefined | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  // Reject impossible dates (e.g. 2026-02-30 silently rolls over to March 2)
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export interface ToolCtx {
  businessId: string;
  connectionId: string;
  hasScope: (scope: string) => boolean;
  /** Deny a tool call whose connection lacks the required scope (audited). */
  denyScope: (tool: string, scope: string) => Promise<ToolResult>;
}

/**
 * Idempotency for write tools — no schema change: we look up a prior
 * successful audit row of the same connection+tool whose params carried the
 * same idempotency_key and replay its resultSummary. Write tools MUST put
 * `idempotency_key` into the params they pass to auditLog and MUST put the
 * created entity id in resultSummary.
 */
export async function findIdempotentReplay(
  connectionId: string,
  toolName: string,
  key: string | undefined | null
): Promise<string | null> {
  if (!key) return null;
  const prior = await prisma.mcpAuditLog.findFirst({
    where: {
      connectionId,
      toolName,
      status: "success",
      params: { path: ["idempotency_key"], equals: key },
    },
    orderBy: { createdAt: "desc" },
    select: { resultSummary: true },
  });
  return prior?.resultSummary ?? null;
}

/** Standard reply when an idempotent replay is detected. */
export function replayResult(summary: string): ToolResult {
  return textResult(`♻️ הפעולה כבר בוצעה קודם (idempotency_key זהה) — לא נוצר כפיל.\n${summary}`);
}

/** Standard dry-run preview reply. */
export function dryRunResult(preview: string): ToolResult {
  return textResult(`🔍 תצוגה מקדימה (dry_run — לא בוצע שינוי):\n${preview}\n\nכדי לבצע, קרא שוב עם dry_run=false.`);
}

export type RegisterFn = (server: McpServer, ctx: ToolCtx) => void;
export { auditLog };
