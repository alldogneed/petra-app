/**
 * MCP — working hours.
 *  - get_working_hours          → business weekly hours + breaks + each service's own online-booking hours
 *  - set_working_hours          → update the business weekly hours (widen or narrow — unlike block_time)
 *  - set_service_booking_hours  → a price-list item's own online-booking hours (or back to business hours)
 * Logic: src/services/booking-hours.ts. Writes need AVAILABILITY_MANAGE (same as the UI routes).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TENANT_PERMS } from "@/lib/permissions";
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
import { DAY_NAMES_HE, formatWeeklyHours, normalizeBookingHours, BookingHoursError } from "@/lib/booking-hours";
import {
  findBusinessPriceItem,
  getWorkingHoursOverview,
  setBusinessWeeklyHours,
  setItemBookingHours,
  validateBusinessDays,
} from "@/services/booking-hours";
import { ServiceError } from "@/services/types";

const dayShape = z.object({
  day_of_week: z.number().int().min(0).max(6).describe("0 = Sunday (ראשון) … 6 = Saturday (שבת)"),
  is_open: z.boolean().describe("false = closed that day"),
  open_time: z.string().optional().describe("HH:MM (Israel time) — required when is_open"),
  close_time: z.string().optional().describe("HH:MM — required when is_open, after open_time"),
});
type DayArg = z.infer<typeof dayShape>;

const toDayInput = (d: DayArg) => ({
  dayOfWeek: d.day_of_week,
  isOpen: d.is_open,
  openTime: d.open_time,
  closeTime: d.close_time,
});

const dayLines = (days: Array<{ dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }>) =>
  days.map((d) => `  ${DAY_NAMES_HE[d.dayOfWeek]}: ${d.isOpen ? `${d.openTime}–${d.closeTime}` : "סגור"}`).join("\n");

export function registerHoursTools(server: McpServer, ctx: ToolCtx): void {
  const { businessId, connectionId } = ctx;

  // ── get_working_hours ─────────────────────────────────────────────────────
  server.tool(
    "get_working_hours",
    "Show the business weekly working hours (used by online booking and find_free_slots), the daily breaks, and every price-list service with its own online-booking hours (or 'business hours'). Use the service ids with set_service_booking_hours.",
    {},
    async () => {
      if (!ctx.hasScope("read:appointments")) return ctx.denyScope("get_working_hours", "read:appointments");
      try {
        const o = await getWorkingHoursOverview(businessId);
        const breaks = o.breaks.length
          ? o.breaks
              .map((b) => `  ${b.dayOfWeek === -1 ? "כל יום" : DAY_NAMES_HE[b.dayOfWeek] ?? "?"} ${b.startTime}–${b.endTime}${b.label ? ` (${safeField(b.label, 40)})` : ""}`)
              .join("\n")
          : "  אין";
        const items = o.items.length
          ? o.items
              .map(
                (i) =>
                  `• ${safeField(i.name, 80)}${i.durationMinutes ? ` (${i.durationMinutes} דק')` : ""}${i.isBookableOnline ? "" : " [לא מוצג בהזמנה אונליין]"} — ${i.hours ? `שעות מיוחדות: ${formatWeeklyHours(i.hours)}` : "לפי שעות העסק"} (id: ${i.id})`
              )
              .join("\n")
          : "אין שירותים פעילים במחירון.";
        await auditLog(connectionId, "get_working_hours", {}, "success", `${o.items.length} items`);
        return textResult(
          `שעות פעילות של העסק${o.configured ? "" : " (ברירת מחדל — לא נשמרו שעות)"}:\n${dayLines(o.business)}\n\nהפסקות קבועות:\n${breaks}\n\nשעות להזמנה אונליין לפי שירות במחירון:\n${items}`
        );
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בטעינת שעות הפעילות";
        await auditLog(connectionId, "get_working_hours", {}, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── set_working_hours ─────────────────────────────────────────────────────
  server.tool(
    "set_working_hours",
    "Update the business weekly working hours — can widen or narrow them (block_time only removes time on one date). Pass only the days to change; other days stay as they are. Applies to every service that follows the business hours. For hours of one service use set_service_booking_hours.",
    {
      days: z.array(dayShape).min(1).max(7).describe("Days to change"),
      idempotency_key: z.string().max(100).optional().describe("Client-generated key; a repeated call with the same key replays the first result"),
      dry_run: z.boolean().optional().describe("Preview only — nothing is saved"),
    },
    async (args) => {
      if (!ctx.hasScope("write:appointments")) return ctx.denyScope("set_working_hours", "write:appointments");
      if (!ctx.hasPermission(TENANT_PERMS.AVAILABILITY_MANAGE)) return ctx.denyPermission("set_working_hours", TENANT_PERMS.AVAILABILITY_MANAGE);
      const params = { ...args };
      try {
        const replay = await findIdempotentReplay(connectionId, "set_working_hours", args.idempotency_key);
        if (replay) return replayResult(replay);

        const valid = validateBusinessDays(args.days.map(toDayInput));
        if (args.dry_run) {
          const before = await getWorkingHoursOverview(businessId);
          const changes = valid
            .map((d) => {
              const b = before.business[d.dayOfWeek];
              const was = b.isOpen ? `${b.openTime}–${b.closeTime}` : "סגור";
              const now = d.isOpen ? `${d.openTime}–${d.closeTime}` : "סגור";
              return `  ${DAY_NAMES_HE[d.dayOfWeek]}: ${was} → ${now}`;
            })
            .join("\n");
          return dryRunResult(`שעות הפעילות יעודכנו:\n${changes}`);
        }

        const after = await setBusinessWeeklyHours(businessId, args.days.map(toDayInput));
        await auditLog(connectionId, "set_working_hours", params, "success", `updated ${valid.length} days`);
        return textResult(`✅ שעות הפעילות עודכנו:\n${dayLines(after)}`);
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בעדכון שעות הפעילות";
        await auditLog(connectionId, "set_working_hours", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );

  // ── set_service_booking_hours ─────────────────────────────────────────────
  server.tool(
    "set_service_booking_hours",
    "Set the online-booking hours of ONE price-list service (id from get_working_hours). These hours replace the business hours for that service only — wider or narrower. Days not listed are closed for this service. use_business_hours=true removes the special hours. Blocks, breaks and existing bookings still apply.",
    {
      price_list_item_id: z.string().describe("Service id from get_working_hours"),
      days: z.array(dayShape).max(7).optional().describe("The service's weekly hours; unlisted days = closed"),
      use_business_hours: z.boolean().optional().describe("true = follow the business hours again (clears special hours)"),
      idempotency_key: z.string().max(100).optional().describe("Client-generated key; a repeated call with the same key replays the first result"),
      dry_run: z.boolean().optional().describe("Preview only — nothing is saved"),
    },
    async (args) => {
      if (!ctx.hasScope("write:services")) return ctx.denyScope("set_service_booking_hours", "write:services");
      if (!ctx.hasPermission(TENANT_PERMS.AVAILABILITY_MANAGE)) return ctx.denyPermission("set_service_booking_hours", TENANT_PERMS.AVAILABILITY_MANAGE);
      const params = { ...args };
      try {
        const replay = await findIdempotentReplay(connectionId, "set_service_booking_hours", args.idempotency_key);
        if (replay) return replayResult(replay);

        if (args.use_business_hours && args.days?.length) {
          throw new ServiceError("יש לבחור days או use_business_hours, לא את שניהם", "VALIDATION");
        }
        if (!args.use_business_hours && !args.days?.length) {
          throw new ServiceError("יש לציין days, או use_business_hours=true", "VALIDATION");
        }
        const input = args.use_business_hours
          ? null
          : (args.days ?? []).map((d) => ({ dayOfWeek: d.day_of_week, isOpen: d.is_open, openTime: d.open_time, closeTime: d.close_time }));

        const item = await findBusinessPriceItem(businessId, args.price_list_item_id);
        const notOnline = item.isBookableOnline ? "" : "\nℹ️ השירות לא מסומן \"זמין לתיאום תור אונליין\" במחירון — השעות ישמשו כשיופעל.";

        if (args.dry_run) {
          let preview: string;
          try {
            const h = normalizeBookingHours(input);
            preview = h ? `שעות מיוחדות: ${formatWeeklyHours(h)}` : "חזרה לשעות העסק";
          } catch (e) {
            if (e instanceof BookingHoursError) throw new ServiceError(e.message, "VALIDATION");
            throw e;
          }
          return dryRunResult(`"${safeField(item.name, 80)}" — ${preview}${notOnline}`);
        }

        const res = await setItemBookingHours(businessId, args.price_list_item_id, input);
        await auditLog(connectionId, "set_service_booking_hours", params, "success", `item ${res.id} ${res.hours ? "custom" : "business"} hours`);
        return textResult(
          `✅ "${safeField(res.name, 80)}" — ${res.hours ? `שעות להזמנה אונליין: ${formatWeeklyHours(res.hours)}` : "חוזר לשעות העסק"}${notOnline}`
        );
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : "שגיאה בעדכון שעות השירות";
        await auditLog(connectionId, "set_service_booking_hours", params, "error", undefined, msg);
        return errorResult(msg);
      }
    }
  );
}
