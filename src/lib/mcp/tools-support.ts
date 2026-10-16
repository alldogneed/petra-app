/**
 * Petra MCP — support tickets (the member ↔ Petra team, not the business's own customers).
 * Registered from /api/mcp/route.ts.
 *
 * The ticket belongs to the PlatformUser who minted the connection (ctx.userId):
 * the same visibility rule as "הפניות שלי" (src/lib/support-access.ts) — own tickets,
 * the business owner sees all of the business. Legacy tokens (no minter) are refused.
 *
 * No data scope: these tools never touch the business's data, only the member's own
 * conversation with Petra support — so a read-only connection may open a ticket too.
 * Writes are rate-limited (RATE_LIMITS.SUPPORT_WRITE) because every one alerts the
 * platform owner. All logic is in src/services/support-tickets.ts.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { SUPPORT_REPLY_MAX, SUPPORT_STATUS_LABELS, validateSupportReply, isSupportTicketStatus } from "@/lib/support-tickets";
import {
  createSupportTicket,
  listCustomerTickets,
  getCustomerTicket,
  addCustomerReply,
  type CustomerScope,
  ServiceError,
} from "@/services/support-tickets";
import {
  textResult,
  errorResult,
  safeField,
  heDate,
  findIdempotentReplay,
  replayResult,
  dryRunResult,
  auditLog,
  type ToolCtx,
} from "@/lib/mcp/helpers";

/** Ticket opened from an AI client — shown to the Petra team instead of a page URL. */
export const MCP_SUPPORT_SOURCE = "עוזר AI (MCP)";

const statusHe = (s: string) => (isSupportTicketStatus(s) ? SUPPORT_STATUS_LABELS[s] : s);
const when = (d: Date | string) => heDate(d, { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export function registerSupportTools(server: McpServer, ctx: ToolCtx) {
  const { businessId, connectionId, userId } = ctx;

  async function scopeOrNull(): Promise<(CustomerScope & { name: string | null; email: string }) | null> {
    if (!userId) return null;
    const user = await prisma.platformUser.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    if (!user) return null;
    return {
      businessId,
      userId,
      seesAllOfBusiness: ctx.minterRole == null || ctx.minterRole === "owner",
      name: user.name,
      email: user.email,
    };
  }
  const LEGACY_MSG = "החיבור הזה ישן ולא משויך למשתמש — צרו חיבור חדש בהגדרות ← עוזרי AI כדי לפתוח פניות.";

  async function rateLimited(tool: string, params: Record<string, unknown>) {
    const rl = await rateLimitAsync("support:mcp", userId ?? connectionId, RATE_LIMITS.SUPPORT_WRITE);
    if (rl.allowed) return null;
    await auditLog(connectionId, tool, params, "error", undefined, "rate limited");
    return errorResult("נשלחו כמה הודעות לתמיכה בזמן קצר. נסו שוב בעוד דקה.");
  }

  // ── create_support_ticket ────────────────────────────────────────────────
  server.tool(
    "create_support_ticket",
    "Open a support ticket with the Petra team (a bug, a question about the system, a feature request) on behalf of the connected user. The answer arrives by email, in the app under \"הפניות שלי\", and via get_support_ticket. Not for the business's own customers.",
    {
      title: z.string().min(3).max(200).describe("One-line subject, in Hebrew if the user writes Hebrew"),
      description: z.string().min(10).max(5000).describe("What happened, what was expected, which screen/record (no passwords or card numbers)"),
      idempotency_key: z.string().max(100).optional(),
      dry_run: z.boolean().optional(),
    },
    async ({ title, description, idempotency_key, dry_run }) => {
      const params = { title_len: title.length, description_len: description.length, idempotency_key, dry_run };
      const scope = await scopeOrNull();
      if (!scope) return errorResult(LEGACY_MSG);
      const replay = await findIdempotentReplay(connectionId, "create_support_ticket", idempotency_key);
      if (replay) return replayResult(replay);
      if (dry_run) return dryRunResult(`פנייה לצוות פטרה: "${safeField(title, 200)}" (${description.trim().length} תווים), בשם ${safeField(scope.name ?? scope.email, 60)}`);
      const limited = await rateLimited("create_support_ticket", params);
      if (limited) return limited;
      try {
        const ticket = await createSupportTicket({
          businessId,
          actor: { userId: scope.userId, name: scope.name, email: scope.email },
          title: title.trim(),
          description: description.trim(),
          pageUrl: MCP_SUPPORT_SOURCE,
        });
        const summary = `✅ הפנייה נפתחה (id: ${ticket.id}). צוות פטרה קיבל התראה; התשובה תגיע במייל, ב"הפניות שלי" במערכת, ואפשר לבדוק אותה עם get_support_ticket.`;
        await auditLog(connectionId, "create_support_ticket", params, "success", summary);
        return textResult(summary);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בפתיחת הפנייה";
        await auditLog(connectionId, "create_support_ticket", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── list_support_tickets ─────────────────────────────────────────────────
  server.tool(
    "list_support_tickets",
    "List the connected user's support tickets with the Petra team (the business owner sees all tickets of the business): status and whether a new answer is waiting.",
    {
      status: z.enum(["open", "in_progress", "resolved"]).optional().describe("Filter by status"),
    },
    async ({ status }) => {
      const params = { status };
      const scope = await scopeOrNull();
      if (!scope) return errorResult(LEGACY_MSG);
      try {
        const { tickets } = await listCustomerTickets(scope);
        const rows = status ? tickets.filter((t) => t.status === status) : tickets;
        await auditLog(connectionId, "list_support_tickets", params, "success", `returned ${rows.length} tickets`);
        if (rows.length === 0) return textResult("אין פניות לתמיכה.");
        const lines = rows.slice(0, 50).map((t) => {
          const unread = t.customerUnread && t.openedByMe ? " · 🔔 תשובה חדשה" : "";
          const who = t.openedByMe ? "" : ` · נפתחה ע״י ${safeField(t.openedBy ?? "חבר צוות", 40)}`;
          return `• ${safeField(t.title, 100)} [${statusHe(t.status)}] · ${when(t.createdAt)}${who}${unread} (id: ${t.id})`;
        });
        return textResult(`${rows.length} פניות:\n${lines.join("\n")}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת הפניות";
        await auditLog(connectionId, "list_support_tickets", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── get_support_ticket ───────────────────────────────────────────────────
  server.tool(
    "get_support_ticket",
    "Read one support ticket with its full handling history: the original message, the Petra team's answers and status changes. Opening it marks a new answer as read.",
    { ticket_id: z.string().min(1).max(64) },
    async ({ ticket_id }) => {
      const params = { ticket_id };
      const scope = await scopeOrNull();
      if (!scope) return errorResult(LEGACY_MSG);
      try {
        const t = await getCustomerTicket(scope, ticket_id);
        const history = t.events
          .filter((e) => e.type !== "created")
          .map((e) => {
            if (e.type === "status_change") return `  ↺ ${when(e.createdAt)} — סטטוס: ${statusHe(e.fromStatus ?? "")} → ${statusHe(e.toStatus ?? "")}`;
            const who = e.authorType === "staff" ? "צוות פטרה" : t.openedByMe ? "את/ה" : safeField(e.authorName ?? "לקוח", 40);
            return `  💬 ${when(e.createdAt)} — ${who}: ${safeField(e.body, 2000)}`;
          });
        await auditLog(connectionId, "get_support_ticket", params, "success", `ticket ${t.id}, ${t.events.length} events`);
        return textResult(
          [
            `🛟 ${safeField(t.title, 200)} [${statusHe(t.status)}] (id: ${t.id})`,
            `נפתחה: ${when(t.createdAt)}${t.openedByMe ? "" : ` ע״י ${safeField(t.openedBy ?? "חבר צוות", 40)}`}`,
            `פנייה: ${safeField(t.description, 2000)}`,
            history.length ? `היסטוריית טיפול:\n${history.join("\n")}` : "עוד אין תשובה מצוות פטרה.",
            t.status === "resolved" ? "הפנייה סגורה — תגובה עם reply_support_ticket תפתח אותה מחדש." : "",
          ].filter(Boolean).join("\n")
        );
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת הפנייה";
        await auditLog(connectionId, "get_support_ticket", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── reply_support_ticket ─────────────────────────────────────────────────
  server.tool(
    "reply_support_ticket",
    "Reply in an existing support ticket (add details, answer the Petra team's question, or say it still doesn't work). Replying to a resolved ticket reopens it.",
    {
      ticket_id: z.string().min(1).max(64),
      message: z.string().min(2).max(SUPPORT_REPLY_MAX),
      idempotency_key: z.string().max(100).optional(),
      dry_run: z.boolean().optional(),
    },
    async ({ ticket_id, message, idempotency_key, dry_run }) => {
      const params = { ticket_id, message_len: message.length, idempotency_key, dry_run };
      const scope = await scopeOrNull();
      if (!scope) return errorResult(LEGACY_MSG);
      const v = validateSupportReply(message);
      if (!v.ok) return errorResult(v.error);
      const replay = await findIdempotentReplay(connectionId, "reply_support_ticket", idempotency_key);
      if (replay) return replayResult(replay);
      try {
        if (dry_run) {
          const t = await prisma.supportTicket.findFirst({
            where: scope.seesAllOfBusiness ? { id: ticket_id, businessId } : { id: ticket_id, businessId, userId: scope.userId },
            select: { title: true, status: true },
          });
          if (!t) return errorResult("הפנייה לא נמצאה");
          return dryRunResult(`תגובה בפנייה "${safeField(t.title, 120)}" (${v.body.length} תווים)${t.status === "resolved" ? " — הפנייה תיפתח מחדש" : ""}`);
        }
        const limited = await rateLimited("reply_support_ticket", params);
        if (limited) return limited;
        const r = await addCustomerReply(scope, ticket_id, { userId: scope.userId, name: scope.name, email: scope.email }, v.body);
        const summary = `✅ התגובה נשלחה לצוות פטרה (ticket ${ticket_id})${r.reopened ? " — הפנייה נפתחה מחדש" : ""}.`;
        await auditLog(connectionId, "reply_support_ticket", params, "success", summary);
        return textResult(summary);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בשליחת התגובה";
        await auditLog(connectionId, "reply_support_ticket", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );
}
