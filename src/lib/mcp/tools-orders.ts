/**
 * Petra MCP — order tools. Registered from /api/mcp/route.ts (registerOrderTools).
 *
 * Tools:
 *   create_order  (write:orders) — several items, optional pet, optional link to ONE appointment or
 *                                  boarding stay (Order.relatedEntityType "Appointment" | "BoardingStay",
 *                                  same keys the balance code reads: outstanding-balances.ts) so payments
 *                                  of that appointment / stay close against the order.
 *   update_order  (write:orders) — replace items (draft, or confirmed with nothing paid / pending /
 *                                  invoiced), notes, start/end.
 *
 * Every write tool supports idempotency_key (retry-safe) and dry_run (preview, no DB write).
 * Tenant isolation: every query is scoped by ctx.businessId (never from args).
 * No owner-grantable capability gates order create/edit in the UI routes (POST /api/orders,
 * PATCH /api/orders/[id] without cancel) — so scope only, like the old create_order.
 * Pure rules: src/lib/mcp/orders-rules.ts (tests: src/lib/__tests__/mcp-orders-rules.test.ts).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createOrder, updateOrder } from "@/services/orders";
import { ServiceError } from "@/services/types";
import { calcOrder } from "@/lib/order-calc";
import { getMaxOrders, normalizeTier } from "@/lib/feature-flags";
import {
  textResult,
  errorResult,
  safeField,
  findIdempotentReplay,
  replayResult,
  dryRunResult,
  auditLog,
  type ToolCtx,
} from "@/lib/mcp/helpers";
import {
  MAX_ORDER_ITEMS,
  ORDER_ITEM_UNITS,
  OrderRuleError,
  normalizeOrderItems,
  decideOrderLink,
  resolveOrderPet,
  canReplaceOrderLines,
  parseLocalDateTimeArg,
  type LinkTarget,
  type NormalizedLine,
  type PriceItemInfo,
} from "@/lib/mcp/orders-rules";

const ORDER_STATUS_HE: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושרת",
  in_progress: "בביצוע",
  completed: "הושלמה",
  cancelled: "בוטלה",
  paid: "שולמה",
};
const UNIT_HE: Record<string, string> = {
  per_session: "לאימון",
  per_hour: "לשעה",
  per_day: "ליום",
  per_night: "ללילה",
  per_unit: "ליחידה",
  package: "חבילה",
};

function ils(n: number): string {
  return `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
}
function statusHe(s: string): string {
  return ORDER_STATUS_HE[s] ?? safeField(s, 20);
}
function dateTimeHe(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });
}
function lineText(l: { name: string; quantity: number; unitPrice: number; unit: string }): string {
  return `  • ${safeField(l.name, 100)} × ${l.quantity} ${UNIT_HE[l.unit] ?? ""} × ${ils(l.unitPrice)} = ${ils(Math.round(l.quantity * l.unitPrice * 100) / 100)}`;
}
function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ServiceError || e instanceof OrderRuleError) return e.message;
  return fallback;
}

type BusinessCalc = { vatEnabled: boolean; vatRate: number; legalEntityType: string | null; timezone: string | null; tier: string | null };

async function loadBusiness(businessId: string): Promise<BusinessCalc> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { vatEnabled: true, vatRate: true, legalEntityType: true, timezone: true, tier: true },
  });
  if (!b) throw new ServiceError("העסק לא נמצא", "NOT_FOUND");
  return b;
}

/** Same calc the service runs (VAT-inclusive prices) — for previews. */
function previewTotal(b: BusinessCalc, lines: NormalizedLine[], discountType = "none", discountValue = 0): number {
  return calcOrder({
    lines: lines.map((l) => ({
      name: l.name,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxMode: (l.taxMode || "taxable") as "inherit" | "taxable" | "exempt",
    })),
    discountType: discountType as "none" | "percent" | "fixed",
    discountValue,
    vatEnabled: b.legalEntityType === "עוסק פטור" ? false : b.vatEnabled,
    vatRate: b.vatRate,
  }).total;
}

async function loadPriceItems(businessId: string, items: Array<{ price_list_item_id?: string | null }>): Promise<Map<string, PriceItemInfo>> {
  const ids = Array.from(new Set(items.map((i) => i.price_list_item_id).filter((x): x is string => !!x)));
  if (ids.length === 0) return new Map();
  const rows = await prisma.priceListItem.findMany({
    where: { id: { in: ids }, businessId },
    select: { id: true, name: true, unit: true, basePrice: true, taxMode: true, isActive: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

const itemSchema = z.object({
  name: z.string().max(160).optional().describe("Line name (optional when price_list_item_id is given — the price-list name is used)"),
  quantity: z.number().positive().max(1000).optional().describe("Quantity (default 1). For boarding: number of nights / days"),
  unit_price: z.number().min(0).max(1_000_000).optional().describe("Price per unit in ILS, VAT-inclusive (optional when price_list_item_id is given — its base price is used)"),
  unit: z.enum(ORDER_ITEM_UNITS).optional().describe("per_session | per_hour | per_day | per_night | per_unit | package (default: the price-list unit, else per_unit)"),
  price_list_item_id: z.string().max(64).optional().describe("Price-list item id (from list_services) — must belong to this business"),
});

export function registerOrderTools(server: McpServer, ctx: ToolCtx): void {
  const { businessId, connectionId, hasScope, denyScope } = ctx;

  // ── create_order ──────────────────────────────────────────────────────────
  server.tool(
    "create_order",
    "Create a financial order (sale) for a client with one or more items, so payments close against it and the customer balance is right. " +
      "Optionally link it to ONE appointment (appointment_id) or ONE boarding stay (boarding_stay_id) of the same client: the order then takes its dates " +
      "(a stay also sets order type 'boarding'), and payments recorded on that appointment / stay count toward this order. " +
      "Only one active order per appointment / stay — a second one is refused with the existing order id (use update_order) unless force=true. " +
      "Prices are always explicit items, so a day-care stay with 0 nights is charged by passing e.g. {name:'פנסיון יום', quantity:1, unit:'per_day', unit_price:…}; " +
      "use quote_boarding_price to get the nightly price. Status defaults to 'confirmed' (only confirmed orders count in the customer balance; 'draft' does not). " +
      "No WhatsApp / payment request is sent. Use list_clients for the customer id, list_services for price_list_item_id.",
    {
      customer_id: z.string().max(64).describe("Customer ID (from list_clients)"),
      items: z.array(itemSchema).min(1).max(MAX_ORDER_ITEMS).describe(`Order lines (1–${MAX_ORDER_ITEMS})`),
      pet_id: z.string().max(64).optional().describe("Pet of this customer (default: the pet of the linked appointment / stay)"),
      boarding_stay_id: z.string().max(64).optional().describe("Boarding stay this order charges for (same customer). Not together with appointment_id"),
      appointment_id: z.string().max(64).optional().describe("Appointment this order charges for (same customer). Not together with boarding_stay_id"),
      order_type: z.enum(["sale", "boarding", "grooming"]).optional().describe("Order type (default 'sale'; a boarding_stay_id always makes it 'boarding')"),
      notes: z.string().max(2000).optional().describe("Optional notes on the order"),
      status: z.enum(["draft", "confirmed"]).optional().describe("Initial status (default: confirmed)"),
      force: z.boolean().optional().describe("Create even if the appointment / stay already has an active order, or is canceled (e.g. a cancellation fee)"),
      idempotency_key: z.string().max(100).optional().describe("Client-generated key; a retry with the same key returns the original result instead of creating a duplicate"),
      dry_run: z.boolean().optional().describe("If true, only preview the order (lines, total, link) without creating it"),
    },
    async (args) => {
      if (!hasScope("write:orders")) return denyScope("create_order", "write:orders");
      const { customer_id, items, pet_id, boarding_stay_id, appointment_id, order_type, notes, status, force, idempotency_key, dry_run } = args;
      const params = {
        customer_id, items_count: items?.length ?? 0, pet_id, boarding_stay_id, appointment_id, order_type,
        notes, status, force, idempotency_key, dry_run,
      };
      try {
        const replay = await findIdempotentReplay(connectionId, "create_order", idempotency_key);
        if (replay) return replayResult(replay);
        if (boarding_stay_id && appointment_id) {
          throw new OrderRuleError("אפשר לקשר הזמנה לתור אחד או לשהייה אחת — לא לשניהם");
        }

        const customer = await prisma.customer.findFirst({ where: { id: customer_id, businessId }, select: { id: true, name: true } });
        if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");
        const biz = await loadBusiness(businessId);

        // Link target (loaded with businessId in the where → another tenant's id = not found)
        let target: LinkTarget = { kind: "none" };
        let existingOrderId: string | null = null;
        if (boarding_stay_id) {
          const stay = await prisma.boardingStay.findFirst({
            where: { id: boarding_stay_id, businessId },
            select: { id: true, customerId: true, petId: true, checkIn: true, checkOut: true, status: true },
          });
          target = { kind: "stay", entity: stay };
        } else if (appointment_id) {
          const appt = await prisma.appointment.findFirst({
            where: { id: appointment_id, businessId },
            select: { id: true, customerId: true, petId: true, date: true, startTime: true, endTime: true, status: true },
          });
          target = { kind: "appointment", entity: appt };
        }
        if (target.kind !== "none" && target.entity) {
          const existing = await prisma.order.findFirst({
            where: {
              businessId,
              relatedEntityType: target.kind === "stay" ? "BoardingStay" : "Appointment",
              relatedEntityId: target.entity.id,
              status: { not: "cancelled" },
            },
            select: { id: true },
            orderBy: { createdAt: "desc" },
          });
          existingOrderId = existing?.id ?? null;
        }
        const link = decideOrderLink(target, customer.id, existingOrderId, !!force, biz.timezone || "Asia/Jerusalem");

        // Pet: must be this customer's (or a standalone pet of the business)
        if (pet_id) {
          const pet = await prisma.pet.findFirst({
            where: {
              id: pet_id,
              OR: [
                { customerId: customer.id, customer: { businessId } },
                { customerId: null, businessId },
              ],
            },
            select: { id: true },
          });
          if (!pet) throw new OrderRuleError("חיית המחמד לא נמצאה אצל לקוח זה");
        }
        const petId = resolveOrderPet(pet_id, link.linkPetId);

        const priceItems = await loadPriceItems(businessId, items);
        const lines = normalizeOrderItems(items, priceItems, petId);
        const total = previewTotal(biz, lines);
        const orderType = link.orderType ?? order_type ?? "sale";
        const finalStatus = status ?? "confirmed";

        const linkText = link.relatedEntityType === "BoardingStay"
          ? `שהיית פנסיון (id: ${link.relatedEntityId})`
          : link.relatedEntityType === "Appointment"
            ? `תור (id: ${link.relatedEntityId})`
            : null;
        const detail = [
          `לקוח: ${safeField(customer.name)} (id: ${customer.id})`,
          `פריטים:\n${lines.map(lineText).join("\n")}`,
          `סה"כ: ${ils(total)} | סטטוס: ${statusHe(finalStatus)} | סוג: ${orderType}`,
          ...(linkText ? [`מקושרת ל: ${linkText}`] : []),
          ...(link.startAt ? [`תאריכים: ${dateTimeHe(link.startAt)} – ${dateTimeHe(link.endAt)}`] : []),
          ...(existingOrderId ? [`⚠️ כבר קיימת הזמנה פעילה לאותו תור / שהייה (id: ${existingOrderId}) — force=true`] : []),
          ...(notes ? [`הערות: ${safeField(notes, 200)}`] : []),
        ].join("\n");

        if (dry_run) return dryRunResult(`תיווצר הזמנה:\n${detail}`);

        const result = await createOrder(
          businessId,
          prisma,
          {
            customerId: customer.id,
            orderType,
            status: finalStatus,
            notes: notes ?? null,
            startAt: link.startAt ? link.startAt.toISOString() : null,
            endAt: link.endAt ? link.endAt.toISOString() : null,
            petId,
            relatedEntityType: link.relatedEntityType,
            relatedEntityId: link.relatedEntityId,
            lines,
          },
          { maxOrders: getMaxOrders(normalizeTier(biz.tier)) }
        );
        const order = result.order;
        const summary = `✅ הזמנה נוצרה (id: ${order.id})\n${detail.replace(/^⚠️.*$/m, "").trim()}\nסה"כ שנשמר: ${ils(order.total)}`;
        await auditLog(connectionId, "create_order", params, "success", `created order ${order.id} total ${order.total}`);
        return textResult(summary);
      } catch (e) {
        const msg = errMsg(e, "שגיאה ביצירת הזמנה");
        await auditLog(connectionId, "create_order", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── update_order ──────────────────────────────────────────────────────────
  server.tool(
    "update_order",
    "Edit an existing order: replace ALL its items (allowed for a draft, or for a confirmed order with no paid / pending payment and no invoice document — " +
      "otherwise cancel / refund the payment first or create a separate order for the difference), change notes, or change start / end (Israel local, " +
      "'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'; not for an order linked to an appointment — its times follow the appointment). The total is recalculated " +
      "server-side (existing discount kept). Status changes: use update_order_status / cancel_order. Use list_orders / get_order for the id.",
    {
      order_id: z.string().max(64).describe("Order ID"),
      items: z.array(itemSchema).min(1).max(MAX_ORDER_ITEMS).optional().describe(`Full replacement of the order lines (1–${MAX_ORDER_ITEMS})`),
      notes: z.string().max(2000).nullable().optional().describe("New notes (empty string or null clears)"),
      start_at: z.string().max(20).nullable().optional().describe("New start, 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' Israel time (null clears)"),
      end_at: z.string().max(20).nullable().optional().describe("New end, 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' Israel time (null clears)"),
      idempotency_key: z.string().max(100).optional().describe("Client-generated key; a retry with the same key returns the original result instead of applying the update twice"),
      dry_run: z.boolean().optional().describe("If true, only preview the change (before → after total)"),
    },
    async (args) => {
      if (!hasScope("write:orders")) return denyScope("update_order", "write:orders");
      const { order_id, items, notes, start_at, end_at, idempotency_key, dry_run } = args;
      const params = { order_id, items_count: items?.length, notes, start_at, end_at, idempotency_key, dry_run };
      try {
        const replay = await findIdempotentReplay(connectionId, "update_order", idempotency_key);
        if (replay) return replayResult(replay);
        if (items === undefined && notes === undefined && start_at === undefined && end_at === undefined) {
          throw new OrderRuleError("לא נשלח שום שינוי (items / notes / start_at / end_at)");
        }

        const order = await prisma.order.findFirst({
          where: { id: order_id, businessId },
          select: {
            id: true, status: true, total: true, notes: true, startAt: true, endAt: true,
            discountType: true, discountValue: true, relatedEntityType: true,
            customer: { select: { name: true } },
            lines: { select: { name: true, quantity: true, unitPrice: true, unit: true, metadata: true }, orderBy: { createdAt: "asc" } },
            payments: { select: { status: true } },
            invoiceDocuments: { select: { status: true } },
          },
        });
        if (!order) throw new ServiceError("הזמנה לא נמצאה", "NOT_FOUND");
        if (order.status === "cancelled") throw new OrderRuleError("ההזמנה בוטלה — לא ניתן לערוך אותה");

        const startArg = start_at === undefined ? undefined : start_at === null || start_at === "" ? null : parseLocalDateTimeArg(start_at, "start_at");
        const endArg = end_at === undefined ? undefined : end_at === null || end_at === "" ? null : parseLocalDateTimeArg(end_at, "end_at");
        if ((startArg !== undefined || endArg !== undefined) && order.relatedEntityType === "Appointment") {
          throw new OrderRuleError("ההזמנה מקושרת לתור — התאריכים שלה נגזרים מהתור. עדכן את התור (update_appointment / reschedule_appointment)");
        }

        const biz = await loadBusiness(businessId);
        let lines: NormalizedLine[] | undefined;
        if (items !== undefined) {
          const check = canReplaceOrderLines(order);
          if (!check.ok) throw new OrderRuleError(check.reason);
          // Keep the pet(s) recorded on the current lines.
          const petIds = new Set<string>();
          for (const l of order.lines) {
            try {
              const m = JSON.parse(l.metadata || "{}");
              if (Array.isArray(m?.petIds)) for (const p of m.petIds) if (typeof p === "string") petIds.add(p);
            } catch { /* legacy metadata */ }
          }
          const priceItems = await loadPriceItems(businessId, items);
          lines = normalizeOrderItems(items, priceItems).map((l) => ({ ...l, metadata: { petIds: Array.from(petIds) } }));
        }

        const after = lines ? previewTotal(biz, lines, order.discountType, order.discountValue) : order.total;
        const changes: string[] = [];
        if (lines) {
          changes.push(`פריטים לפני:\n${order.lines.map(lineText).join("\n") || "  —"}`);
          changes.push(`פריטים אחרי:\n${lines.map(lineText).join("\n")}`);
        }
        changes.push(`סה"כ: ${ils(order.total)} → ${ils(after)}`);
        if (notes !== undefined) changes.push(`הערות: ${notes ? safeField(notes, 200) : "(ריק)"}`);
        if (startArg !== undefined) changes.push(`התחלה: ${dateTimeHe(order.startAt)} → ${startArg ?? "(ריק)"}`);
        if (endArg !== undefined) changes.push(`סיום: ${dateTimeHe(order.endAt)} → ${endArg ?? "(ריק)"}`);
        const head = `הזמנה של ${safeField(order.customer?.name) || "לקוח"} (id: ${order.id}) | סטטוס: ${statusHe(order.status)}`;

        if (dry_run) return dryRunResult(`${head}\n${changes.join("\n")}`);

        const updated = await updateOrder(
          businessId,
          prisma,
          order.id,
          {
            ...(lines ? { lines } : {}),
            ...(notes !== undefined ? { notes: notes || null } : {}),
            ...(startArg !== undefined ? { startAt: startArg } : {}),
            ...(endArg !== undefined ? { endAt: endArg } : {}),
          },
          { allowUnpaidLineEdit: true }
        );
        await auditLog(connectionId, "update_order", params, "success", `updated order ${order.id} total ${order.total} -> ${updated.total}`);
        return textResult(`✅ ההזמנה עודכנה\n${head}\n${changes.join("\n").replace(`→ ${ils(after)}`, `→ ${ils(updated.total)}`)}`);
      } catch (e) {
        const msg = errMsg(e, "שגיאה בעדכון הזמנה");
        await auditLog(connectionId, "update_order", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );
}
