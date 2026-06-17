export const dynamic = "force-dynamic";

/**
 * Petra MCP Server — Streamable HTTP endpoint
 *
 * Implements Model Context Protocol over HTTP using the Web Standard transport.
 * Stateless: each request creates a fresh server instance (Vercel serverless compatible).
 *
 * Auth: Bearer token validated against McpConnection.tokenHash on every request.
 * Isolation: businessId is derived exclusively from the token — never from the request.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { validateMcpToken, extractBearerToken, auditLog } from "@/lib/mcp-auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { listCustomers } from "@/services/clients";
import { addCustomerNote } from "@/services/clients";
import { listAppointments, createAppointment } from "@/services/appointments";
import { getBusinessOverview } from "@/services/business";
import { ServiceError } from "@/services/types";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// ─── Tool helper ─────────────────────────────────────────────────────────────

type ToolFn = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `❌ שגיאה: ${message}` }], isError: true };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

function buildServer(businessId: string, connectionId: string): McpServer {
  const server = new McpServer({
    name: "petra",
    version: "1.0.0",
  });

  // ── list_clients ──────────────────────────────────────────────────────────
  server.tool(
    "list_clients",
    "List clients of the business. Returns name, phone, email, tags and last activity.",
    {
      search: z.string().optional().describe("Search by name or phone"),
      limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
    },
    async ({ search, limit }) => {
      const params = { search: search ?? undefined, take: limit ?? 20 };
      try {
        const result = await listCustomers(businessId, prisma, params);
        const customers = result.customers ?? [];
        await auditLog(connectionId, "list_clients", { search, limit }, "success", `returned ${customers.length} clients`);
        if (customers.length === 0) return textResult("לא נמצאו לקוחות.");
        const lines = customers.map((c) =>
          `• ${c.name}${c.phone ? ` | ${c.phone}` : ""}${c.email ? ` | ${c.email}` : ""}${c.tags?.length ? ` [${c.tags.join(", ")}]` : ""}`
        );
        return textResult(`נמצאו ${customers.length} לקוחות:\n${lines.join("\n")}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת לקוחות";
        await auditLog(connectionId, "list_clients", { search, limit }, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── list_upcoming_appointments ────────────────────────────────────────────
  server.tool(
    "list_upcoming_appointments",
    "List upcoming appointments. Returns date, time, client name, service, and status.",
    {
      days_ahead: z.number().int().min(1).max(90).optional().describe("How many days ahead to look (default 30)"),
    },
    async ({ days_ahead }) => {
      const daysAhead = days_ahead ?? 30;
      const from = new Date().toISOString();
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + daysAhead);
      const to = toDate.toISOString();
      try {
        const appts = await listAppointments(businessId, prisma, { from, to });
        await auditLog(connectionId, "list_upcoming_appointments", { days_ahead }, "success", `returned ${appts.length} appointments`);
        if (appts.length === 0) return textResult(`אין תורים ב-${daysAhead} הימים הקרובים.`);
        const lines = appts.map((a) => {
          const dateStr = new Date(a.date).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
          const timeStr = a.startTime ?? "";
          return `• ${dateStr} ${timeStr} — ${(a as any).customer?.name ?? "לא ידוע"} | ${(a as any).service?.name ?? ""} [${a.status}]`;
        });
        return textResult(`${appts.length} תורים קרובים:\n${lines.join("\n")}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת תורים";
        await auditLog(connectionId, "list_upcoming_appointments", { days_ahead }, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── get_business_stats ────────────────────────────────────────────────────
  server.tool(
    "get_business_stats",
    "Get business statistics: total clients, today's appointments, and this month's revenue.",
    {},
    async () => {
      try {
        const stats = await getBusinessOverview(businessId, prisma);
        await auditLog(connectionId, "get_business_stats", {}, "success", "returned stats");
        const text = [
          `📊 סטטיסטיקות עסק:`,
          `👥 לקוחות: ${stats.customerCount}`,
          `📅 תורים היום: ${stats.todayAppts}`,
          `💰 הכנסות החודש: ₪${stats.monthlyRevenue.toLocaleString("he-IL")}`,
          `👨‍💼 חברי צוות: ${stats.teamCount}`,
        ].join("\n");
        return textResult(text);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת נתונים";
        await auditLog(connectionId, "get_business_stats", {}, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── create_appointment ────────────────────────────────────────────────────
  server.tool(
    "create_appointment",
    "Create a new appointment. Requires customer ID and service ID. Use list_clients to find customer IDs.",
    {
      customer_id: z.string().describe("Customer ID (from list_clients)"),
      service_id: z.string().describe("Service ID"),
      date: z.string().describe("Date in YYYY-MM-DD format"),
      start_time: z.string().describe("Start time in HH:MM format"),
      duration: z.number().int().min(5).max(480).optional().describe("Duration in minutes (default 60)"),
      notes: z.string().max(2000).optional().describe("Optional notes"),
    },
    async ({ customer_id, service_id, date, start_time, duration, notes }) => {
      const params = { customer_id, service_id, date, start_time, duration, notes };
      try {
        // Compute endTime from startTime + duration
        const durationMins = duration ?? 60;
        const [h, m] = start_time.split(":").map(Number);
        const totalMins = (h * 60 + m + durationMins) % (24 * 60);
        const endTime = `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;

        const appt = await createAppointment(businessId, prisma, {
          customerId: customer_id,
          serviceId: service_id,
          date,
          startTime: start_time,
          endTime,
          notes: notes ?? null,
        });
        await auditLog(connectionId, "create_appointment", params, "success", `created appointment ${appt.id}`);
        return textResult(`✅ נקבע תור בהצלחה!\nמזהה: ${appt.id}\nתאריך: ${date} בשעה ${start_time}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה ביצירת תור";
        await auditLog(connectionId, "create_appointment", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── add_client_note ───────────────────────────────────────────────────────
  server.tool(
    "add_client_note",
    "Add a note to a client's timeline. Use list_clients to find the client ID.",
    {
      client_id: z.string().describe("Customer ID (from list_clients)"),
      note: z.string().min(1).max(2000).describe("The note to add"),
    },
    async ({ client_id, note }) => {
      const params = { client_id, note };
      try {
        await addCustomerNote(businessId, prisma, client_id, note);
        await auditLog(connectionId, "add_client_note", params, "success", `added note to customer ${client_id}`);
        return textResult(`✅ ההערה נוספה ללקוח בהצלחה.`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בהוספת הערה";
        await auditLog(connectionId, "add_client_note", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── send_reminder ─────────────────────────────────────────────────────────
  server.tool(
    "send_reminder",
    "Send a WhatsApp reminder to a customer about their upcoming appointment. Requires the business to have WhatsApp reminders enabled (Pro plan).",
    {
      appointment_id: z.string().describe("Appointment ID"),
    },
    async ({ appointment_id }) => {
      const params = { appointment_id };
      try {
        const [appt, biz] = await Promise.all([
          prisma.appointment.findFirst({
            where: { id: appointment_id, businessId },
            include: {
              customer: { select: { name: true, phone: true } },
              service: { select: { name: true } },
            },
          }),
          prisma.business.findUnique({
            where: { id: businessId },
            select: { phone: true, name: true, tier: true },
          }),
        ]);

        if (!appt) {
          await auditLog(connectionId, "send_reminder", params, "error", undefined, "appointment not found");
          return errorResult("תור לא נמצא");
        }
        if (!appt.customer?.phone) {
          await auditLog(connectionId, "send_reminder", params, "error", undefined, "customer has no phone");
          return errorResult("ללקוח אין מספר טלפון");
        }

        const phone = appt.customer.phone.replace(/\D/g, "");
        const to = phone.startsWith("0") ? "972" + phone.slice(1) : phone.startsWith("972") ? phone : phone;
        const dateStr = new Date(appt.date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
        const body = `שלום ${appt.customer.name}! 👋\nתזכורת: יש לך תור ל${appt.service?.name ?? "טיפול"} ב${dateStr}${appt.startTime ? ` בשעה ${appt.startTime}` : ""}.\n— ${biz?.name ?? "העסק שלך"}`;

        const result = await sendWhatsAppMessage({ to, body });
        if (!result.success) {
          await auditLog(connectionId, "send_reminder", params, "error", undefined, result.error ?? "WhatsApp error");
          return errorResult("שגיאה בשליחת הודעת WhatsApp");
        }

        await auditLog(connectionId, "send_reminder", params, "success", `sent reminder to ${appt.customer.name}`);
        return textResult(`✅ תזכורת נשלחה ל${appt.customer.name} (${appt.customer.phone})`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בשליחת תזכורת";
        await auditLog(connectionId, "send_reminder", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  return server;
}

// ─── Rate limiting config ─────────────────────────────────────────────────────
// Tunable here so limits can be adjusted without touching the handler logic.
// Per-token throttle protects against a leaked/abusive token overloading the
// server; per-IP failed-auth throttle protects against brute-force token guessing.
const MCP_RATE_LIMIT_TOKEN = { max: 100, windowMs: 60_000 }; // 100 calls/min per connection
const MCP_RATE_LIMIT_AUTH_FAIL = { max: 10, windowMs: 60_000 }; // 10 failed auths/min per IP

/** Extract the client IP from x-forwarded-for (same pattern as auth/booking routes). */
function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Build a 429 response with Retry-After header and JSON body. */
function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(
    JSON.stringify({ error: "rate_limit_exceeded", retry_after_seconds: retryAfterSeconds }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

// ─── Next.js route handlers ───────────────────────────────────────────────────

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  // Emergency kill switch. Set MCP_ENABLED=false in env to disable MCP globally.
  // Default behavior (unset, or any value other than 'false'): MCP is active.
  // This is a fail-open emergency override - the primary gate is Bearer token auth.
  if (process.env.MCP_ENABLED === "false") {
    return new Response(
      JSON.stringify({
        error: "mcp_service_unavailable",
        message: "MCP service is temporarily unavailable",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip = getClientIp(request);

  // Validate bearer token
  const token = extractBearerToken(request.headers.get("authorization"));
  const auth = token ? await validateMcpToken(token) : null;

  if (!auth) {
    // Brute-force protection: rate-limit failed auth attempts per IP.
    // Only failed attempts hit this counter — valid tokens are throttled separately below.
    const fail = await rateLimitAsync("mcp:auth-fail", ip, MCP_RATE_LIMIT_AUTH_FAIL);
    if (!fail.allowed) {
      return rateLimitResponse(fail.retryAfterMs);
    }
    return new Response(
      JSON.stringify({ error: "Unauthorized", message: "Invalid or missing MCP token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Per-token throttle for authenticated requests.
  const limited = await rateLimitAsync("mcp:token", auth.connectionId, MCP_RATE_LIMIT_TOKEN);
  if (!limited.allowed) {
    await auditLog(
      auth.connectionId,
      "_rate_limit",
      {},
      "rate_limited",
      undefined,
      "per-token rate limit exceeded"
    );
    return rateLimitResponse(limited.retryAfterMs);
  }

  const server = buildServer(auth.businessId, auth.connectionId);

  // Stateless transport: no session state, no in-memory sharing between requests
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  const response = await transport.handleRequest(request);

  // Wrap the response body so we close the server only after the stream ends.
  // Closing immediately (setTimeout 0) races with async tool handlers (DB queries)
  // and truncates the SSE response before the result is written.
  if (response.body) {
    const reader = response.body.getReader();
    const wrappedBody = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          server.close().catch(() => {});
        } else {
          controller.enqueue(value);
        }
      },
      cancel() {
        server.close().catch(() => {});
      },
    });
    return new Response(wrappedBody, { status: response.status, headers: response.headers });
  }

  server.close().catch(() => {});
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}
