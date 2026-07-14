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
import { listCustomers, addCustomerNote, createCustomer, listLeads, createLead } from "@/services/clients";
import { listAppointments, createAppointment, updateAppointment, deleteAppointment } from "@/services/appointments";
import { listOrders, createOrder } from "@/services/orders";
import { getBusinessOverview } from "@/services/business";
import { ServiceError } from "@/services/types";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { scheduleAppointmentReminder, rescheduleAppointmentReminder, cancelAppointmentReminders } from "@/lib/reminder-service";

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
        const lines = customers.map((c) => {
          let tagsStr = "";
          try {
            const parsed = JSON.parse(c.tags ?? "[]");
            if (Array.isArray(parsed) && parsed.length) tagsStr = ` [${parsed.join(", ")}]`;
          } catch { /* ignore malformed tags */ }
          return `• ${c.name}${c.phone ? ` | ${c.phone}` : ""}${c.email ? ` | ${c.email}` : ""}${tagsStr} (id: ${c.id})`;
        });
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
          return `• ${dateStr} ${timeStr} — ${(a as any).customer?.name ?? "לא ידוע"} | ${(a as any).service?.name ?? ""} [${a.status}] (id: ${a.id})`;
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

  // ── list_services ─────────────────────────────────────────────────────────
  server.tool(
    "list_services",
    "List the business's active services. Returns each service's name, duration, price and ID. Use the ID as service_id when creating an appointment.",
    {},
    async () => {
      try {
        const services = await prisma.service.findMany({
          where: { businessId, isActive: true },
          select: { id: true, name: true, duration: true, price: true },
          orderBy: { name: "asc" },
        });
        await auditLog(connectionId, "list_services", {}, "success", `returned ${services.length} services`);
        if (services.length === 0) return textResult("לא הוגדרו שירותים פעילים.");
        const lines = services.map((s) => `• ${s.name} — ${s.duration} דק' — ₪${s.price.toLocaleString("he-IL")} (id: ${s.id})`);
        return textResult(`נמצאו ${services.length} שירותים:\n${lines.join("\n")}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת שירותים";
        await auditLog(connectionId, "list_services", {}, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── create_appointment ────────────────────────────────────────────────────
  server.tool(
    "create_appointment",
    "Create a new appointment. Requires customer ID and service ID. Use list_clients to find customer IDs and list_services to find service IDs.",
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
        // Schedule the WhatsApp reminder like the UI route does (awaited — Vercel kills stray promises)
        await scheduleAppointmentReminder({
          id: appt.id,
          businessId,
          customerId: appt.customerId,
          date: appt.date,
          startTime: appt.startTime,
          service: { name: appt.service?.name ?? "תור" },
          customer: { name: appt.customer?.name ?? "לקוח" },
          pet: appt.pet ? { name: appt.pet.name } : null,
        }).catch((err) => console.error("MCP create_appointment reminder scheduling failed:", err));

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

  // ── create_client ─────────────────────────────────────────────────────────
  server.tool(
    "create_client",
    "Create a new client in the business. Returns the new client ID.",
    {
      name: z.string().min(2).describe("Full name of the client"),
      phone: z.string().describe("Israeli phone number (e.g. 050-1234567)"),
      email: z.string().email().optional().describe("Email address"),
      address: z.string().max(500).optional().describe("Home address"),
      notes: z.string().max(5000).optional().describe("Internal notes"),
      tags: z.string().optional().describe("Comma-separated tags (e.g. VIP,dog-owner)"),
      source: z.string().optional().describe("Lead source (e.g. google, referral, instagram)"),
    },
    async ({ name, phone, email, address, notes, tags, source }) => {
      const params = { name, phone, email, address, notes, tags, source };
      try {
        const customer = await createCustomer(businessId, prisma, {
          name, phone, email: email ?? null, address: address ?? null,
          notes: notes ?? null,
          tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)) : undefined,
          source: source ?? "mcp",
        });
        await auditLog(connectionId, "create_client", params, "success", `created customer ${customer.id}`);
        return textResult(`✅ לקוח חדש נוצר בהצלחה!\nשם: ${customer.name}\nטלפון: ${customer.phone}\nמזהה: ${customer.id}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה ביצירת לקוח";
        await auditLog(connectionId, "create_client", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── list_leads ────────────────────────────────────────────────────────────
  server.tool(
    "list_leads",
    "List leads (potential clients). Optionally filter by follow-up date to see who needs to be contacted on a given day. Returns name, phone, stage, requested service, and follow-up date.",
    {
      follow_up_on: z.string().optional().describe("Filter to leads whose follow-up date is exactly this day, format YYYY-MM-DD (e.g. tomorrow's date)"),
      follow_up_until: z.string().optional().describe("Filter to leads whose follow-up date is on or before this day, format YYYY-MM-DD (e.g. overdue + due-today)"),
    },
    async (args: { follow_up_on?: string; follow_up_until?: string }) => {
      try {
        const leads = await listLeads(businessId, prisma);
        const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

        let filtered = leads;
        let header = `נמצאו ${leads.length} לידים`;
        if (args.follow_up_on) {
          filtered = leads.filter((l) => l.nextFollowUpAt && isoDay(l.nextFollowUpAt) === args.follow_up_on);
          header = `נמצאו ${filtered.length} לידים לחזרה בתאריך ${args.follow_up_on}`;
        } else if (args.follow_up_until) {
          filtered = leads.filter((l) => l.nextFollowUpAt && isoDay(l.nextFollowUpAt) <= args.follow_up_until!);
          header = `נמצאו ${filtered.length} לידים לחזרה עד ${args.follow_up_until} (כולל באיחור)`;
        }

        await auditLog(connectionId, "list_leads", args, "success", `returned ${filtered.length}/${leads.length} leads`);
        if (filtered.length === 0) return textResult(args.follow_up_on || args.follow_up_until ? `${header}.` : "אין לידים במערכת.");

        const lines = filtered.slice(0, 50).map((l) => {
          const fu = l.nextFollowUpAt ? `חזרה: ${new Date(l.nextFollowUpAt).toLocaleDateString("he-IL")}` : `נוצר: ${new Date(l.createdAt).toLocaleDateString("he-IL")}`;
          return `• ${l.name}${l.phone ? ` | ${l.phone}` : ""}${l.requestedService ? ` | ${l.requestedService}` : ""} [${l.stage ?? "חדש"}, ${fu}]`;
        });
        const suffix = filtered.length > 50 ? `\n...ועוד ${filtered.length - 50} לידים` : "";
        return textResult(`${header}:\n${lines.join("\n")}${suffix}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת לידים";
        await auditLog(connectionId, "list_leads", args, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── create_lead ───────────────────────────────────────────────────────────
  server.tool(
    "create_lead",
    "Create a new lead (potential client) in the CRM pipeline.",
    {
      name: z.string().min(2).describe("Full name of the lead"),
      phone: z.string().optional().describe("Israeli phone number"),
      email: z.string().email().optional().describe("Email address"),
      requested_service: z.string().optional().describe("What service they are interested in"),
      source: z.string().optional().describe("Lead source (e.g. google, facebook, referral)"),
      city: z.string().optional().describe("City of the lead"),
      notes: z.string().max(5000).optional().describe("Internal notes"),
    },
    async ({ name, phone, email, requested_service, source, city, notes }) => {
      const params = { name, phone, email, requested_service, source, city, notes };
      try {
        const result = await createLead(businessId, prisma, {
          name, phone: phone ?? null, email: email ?? null,
          requestedService: requested_service ?? null,
          source: source ?? "mcp",
          city: city ?? null,
          notes: notes ?? null,
        });
        const lead = result.lead;
        await auditLog(connectionId, "create_lead", params, "success", `created lead ${lead.id}`);
        return textResult(`✅ ליד חדש נוצר בהצלחה!\nשם: ${lead.name}${lead.phone ? `\nטלפון: ${lead.phone}` : ""}\nמזהה: ${lead.id}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה ביצירת ליד";
        await auditLog(connectionId, "create_lead", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── list_orders ───────────────────────────────────────────────────────────
  server.tool(
    "list_orders",
    "List orders for the business. Returns order ID, client name, status, total amount and date.",
    {
      status: z.enum(["draft", "pending", "paid", "cancelled"]).optional().describe("Filter by order status"),
      customer_id: z.string().optional().describe("Filter by customer ID"),
      limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
    },
    async ({ status, customer_id, limit }) => {
      const params = { status, customer_id, limit };
      try {
        const orders = await listOrders(businessId, prisma, {
          status: status ?? undefined,
          customerId: customer_id ?? undefined,
        });
        const slice = orders.slice(0, limit ?? 20);
        await auditLog(connectionId, "list_orders", params, "success", `returned ${slice.length} orders`);
        if (slice.length === 0) return textResult("לא נמצאו הזמנות.");
        const lines = slice.map((o: any) => {
          const date = new Date(o.createdAt).toLocaleDateString("he-IL");
          const total = (o.totalAmount ?? 0).toLocaleString("he-IL");
          return `• ${o.id.slice(0, 8)} | ${o.customer?.name ?? "לא ידוע"} | ₪${total} | ${o.status} | ${date}`;
        });
        return textResult(`נמצאו ${orders.length} הזמנות:\n${lines.join("\n")}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת הזמנות";
        await auditLog(connectionId, "list_orders", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── create_order ──────────────────────────────────────────────────────────
  server.tool(
    "create_order",
    "Create a new order (invoice/sale) for a client. Use list_clients to find the customer ID.",
    {
      customer_id: z.string().describe("Customer ID (from list_clients)"),
      item_name: z.string().describe("Name of the service or product"),
      quantity: z.number().int().min(1).optional().describe("Quantity (default 1)"),
      unit_price: z.number().min(0).describe("Price per unit in ILS"),
      notes: z.string().max(2000).optional().describe("Optional notes on the order"),
      status: z.enum(["draft", "pending"]).optional().describe("Initial status (default: draft)"),
    },
    async ({ customer_id, item_name, quantity, unit_price, notes, status }) => {
      const params = { customer_id, item_name, quantity, unit_price, notes, status };
      try {
        const result = await createOrder(businessId, prisma, {
          customerId: customer_id,
          status: status ?? "draft",
          notes: notes ?? null,
          lines: [{
            name: item_name,
            unit: "יחידה",
            quantity: quantity ?? 1,
            unitPrice: unit_price,
          }],
        });
        const order = result.order;
        const total = ((quantity ?? 1) * unit_price).toLocaleString("he-IL");
        await auditLog(connectionId, "create_order", params, "success", `created order ${order.id}`);
        return textResult(`✅ הזמנה נוצרה בהצלחה!\nמזהה: ${order.id}\nסכום: ₪${total}\nסטטוס: ${order.status}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה ביצירת הזמנה";
        await auditLog(connectionId, "create_order", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── update_appointment ────────────────────────────────────────────────────
  server.tool(
    "update_appointment",
    "Update an existing appointment — change date, time, status or notes. Use list_upcoming_appointments to find appointment IDs.",
    {
      appointment_id: z.string().describe("Appointment ID"),
      date: z.string().optional().describe("New date in YYYY-MM-DD format"),
      start_time: z.string().optional().describe("New start time in HH:MM format"),
      end_time: z.string().optional().describe("New end time in HH:MM format"),
      status: z.enum(["scheduled", "completed", "canceled"]).optional().describe("New status"),
      notes: z.string().max(2000).optional().describe("Updated notes"),
    },
    async ({ appointment_id, date, start_time, end_time, status, notes }) => {
      const params = { appointment_id, date, start_time, end_time, status, notes };
      try {
        const appt = await updateAppointment(businessId, prisma, appointment_id, {
          date: date ?? undefined,
          startTime: start_time ?? undefined,
          endTime: end_time ?? undefined,
          status: status ?? undefined,
          notes: notes !== undefined ? notes : undefined,
        });
        // Keep the WhatsApp reminder in sync (awaited — Vercel kills stray promises)
        if (status === "canceled") {
          await cancelAppointmentReminders(appt.id).catch((err) =>
            console.error("MCP update_appointment reminder cancel failed:", err)
          );
        } else if (date !== undefined || start_time !== undefined) {
          await rescheduleAppointmentReminder({
            id: appt.id,
            businessId,
            customerId: appt.customerId,
            date: appt.date,
            startTime: appt.startTime,
            service: { name: appt.service?.name ?? "תור" },
            customer: { name: appt.customer?.name ?? "לקוח" },
            pet: appt.pet ? { name: appt.pet.name } : null,
          }).catch((err) => console.error("MCP update_appointment reminder reschedule failed:", err));
        }

        await auditLog(connectionId, "update_appointment", params, "success", `updated appointment ${appointment_id}`);
        return textResult(`✅ תור עודכן בהצלחה!\nמזהה: ${appt.id}\nתאריך: ${appt.date}${appt.startTime ? ` בשעה ${appt.startTime}` : ""}\nסטטוס: ${appt.status}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בעדכון תור";
        await auditLog(connectionId, "update_appointment", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── cancel_appointment ────────────────────────────────────────────────────
  server.tool(
    "cancel_appointment",
    "Cancel an existing appointment. Use list_upcoming_appointments to find appointment IDs.",
    {
      appointment_id: z.string().describe("Appointment ID to cancel"),
      reason: z.string().max(500).optional().describe("Reason for cancellation"),
    },
    async ({ appointment_id, reason }) => {
      const params = { appointment_id, reason };
      try {
        await updateAppointment(businessId, prisma, appointment_id, {
          status: "canceled",
          cancellationNote: reason ?? null,
        });
        await cancelAppointmentReminders(appointment_id).catch((err) =>
          console.error("MCP cancel_appointment reminder cancel failed:", err)
        );
        await auditLog(connectionId, "cancel_appointment", params, "success", `cancelled appointment ${appointment_id}`);
        return textResult(`✅ תור בוטל בהצלחה.${reason ? `\nסיבה: ${reason}` : ""}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בביטול תור";
        await auditLog(connectionId, "cancel_appointment", params, "error", undefined, msg);
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

/**
 * Core MCP request handler. Exported so the path-based token route
 * (`/api/mcp/u/[token]`) can reuse the exact same auth + rate-limit + dispatch
 * logic, passing the token from the URL path instead of the Authorization header.
 *
 * @param tokenFromPath - when set, used as the bearer token instead of the header.
 *   Lets non-technical users paste a single URL into Claude Desktop's connector UI,
 *   which has no header field. Header auth remains the recommended path.
 */
export async function handleMcpRequest(request: NextRequest, tokenFromPath?: string): Promise<Response> {
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

  // Validate bearer token. Path-based token (URL connector flow) takes precedence,
  // otherwise fall back to the Authorization header (recommended flow).
  const token = tokenFromPath ?? extractBearerToken(request.headers.get("authorization"));
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
