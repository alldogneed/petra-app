/**
 * Pure rules for the MCP order tools (src/lib/mcp/tools-orders.ts) — no DB, no Prisma.
 *
 * - normalizeOrderItems(): the AI's `items` → service OrderLineInput[] (validation in Hebrew)
 * - decideOrderLink():     may this order be linked to that appointment / boarding stay?
 *                          → relatedEntityType/Id, orderType, startAt/endAt, default pet
 * - resolveOrderPet():     pet_id vs the link's pet
 * - canReplaceOrderLines(): the "draft, or nothing paid" rule of update_order
 * - parseLocalDateTimeArg(): "YYYY-MM-DD" | "YYYY-MM-DDTHH:MM" (Israel local) validation
 */
import { appointmentOrderTimes } from "@/lib/order-time";

export const MAX_ORDER_ITEMS = 50;
export const MAX_ITEM_QUANTITY = 1000;
export const MAX_UNIT_PRICE = 1_000_000;
/** Units the order form uses (ORDER_UNITS in src/lib/constants.ts). */
export const ORDER_ITEM_UNITS = ["per_session", "per_hour", "per_day", "per_night", "per_unit", "package"] as const;
export const DEFAULT_ITEM_UNIT = "per_unit";

export class OrderRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderRuleError";
  }
}

export interface OrderItemArg {
  name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unit?: string | null;
  price_list_item_id?: string | null;
}

/** Price-list row as loaded for this business (only ids that belong to it are in the map). */
export interface PriceItemInfo {
  id: string;
  name: string;
  unit: string;
  basePrice: number;
  taxMode: string;
  isActive?: boolean;
}

export interface NormalizedLine {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxMode?: string;
  priceListItemId: string | null;
  metadata: { petIds: string[] };
}

function hasMax2Decimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Validate + normalise the items. A price_list_item_id must be in `priceItems`
 * (= belongs to the business); it supplies the default name, unit, price and tax mode.
 * Explicit name / unit_price / unit always win (e.g. a day-care stay of 0 nights priced by hand).
 */
export function normalizeOrderItems(
  items: OrderItemArg[] | null | undefined,
  priceItems: Map<string, PriceItemInfo>,
  petId: string | null = null
): NormalizedLine[] {
  if (!Array.isArray(items) || items.length === 0) throw new OrderRuleError("נדרש לפחות פריט אחד בהזמנה");
  if (items.length > MAX_ORDER_ITEMS) throw new OrderRuleError(`מקסימום ${MAX_ORDER_ITEMS} פריטים בהזמנה`);
  return items.map((it, i) => {
    const row = `פריט ${i + 1}`;
    if (!it || typeof it !== "object") throw new OrderRuleError(`${row}: פריט לא תקין`);
    let price: PriceItemInfo | null = null;
    if (it.price_list_item_id) {
      price = priceItems.get(it.price_list_item_id) ?? null;
      if (!price) throw new OrderRuleError(`${row}: פריט המחירון לא נמצא בעסק זה`);
    }
    const name = (it.name ?? "").trim() || price?.name?.trim() || "";
    if (!name) throw new OrderRuleError(`${row}: שם פריט חובה (או price_list_item_id)`);
    if (name.length > 160) throw new OrderRuleError(`${row}: שם הפריט ארוך מדי (מקסימום 160 תווים)`);

    const quantity = it.quantity ?? 1;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_ITEM_QUANTITY) {
      throw new OrderRuleError(`${row}: כמות לא תקינה (גדולה מ-0 ועד ${MAX_ITEM_QUANTITY})`);
    }
    if (!hasMax2Decimals(quantity)) throw new OrderRuleError(`${row}: כמות — מקסימום 2 ספרות אחרי הנקודה`);

    const unitPrice = it.unit_price ?? price?.basePrice;
    if (unitPrice === undefined || unitPrice === null) throw new OrderRuleError(`${row}: חסר מחיר ליחידה (unit_price)`);
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) {
      throw new OrderRuleError(`${row}: מחיר לא תקין (0 עד ₪1,000,000)`);
    }
    if (!hasMax2Decimals(unitPrice)) throw new OrderRuleError(`${row}: מחיר — מקסימום 2 ספרות אחרי הנקודה`);

    const unit = it.unit ?? price?.unit ?? DEFAULT_ITEM_UNIT;
    if (!(ORDER_ITEM_UNITS as readonly string[]).includes(unit) && unit !== price?.unit) {
      throw new OrderRuleError(`${row}: יחידה לא תקינה`);
    }

    return {
      name,
      unit,
      quantity,
      unitPrice,
      ...(price?.taxMode ? { taxMode: price.taxMode === "exempt" ? "exempt" : "taxable" } : {}),
      priceListItemId: price?.id ?? null,
      metadata: { petIds: petId ? [petId] : [] },
    };
  });
}

/** Gross total before any discount (prices are VAT-inclusive, like calcOrder). */
export function itemsGrossTotal(lines: Array<{ quantity: number; unitPrice: number }>): number {
  return round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
}

// ─── Link to an appointment / boarding stay ───────────────────────────────────

export interface LinkAppointment {
  id: string;
  customerId: string | null;
  petId: string | null;
  date: Date;
  startTime: string;
  endTime: string | null;
  status: string;
}

export interface LinkStay {
  id: string;
  customerId: string | null;
  petId: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
}

export type LinkTarget =
  | { kind: "none" }
  | { kind: "appointment"; entity: LinkAppointment | null }
  | { kind: "stay"; entity: LinkStay | null };

export interface LinkDecision {
  relatedEntityType: "Appointment" | "BoardingStay" | null;
  relatedEntityId: string | null;
  /** null = keep the caller's / default order type. */
  orderType: string | null;
  startAt: Date | null;
  endAt: Date | null;
  /** Pet of the appointment / stay (null when none). */
  linkPetId: string | null;
}

/**
 * `entity` = the row loaded with `businessId` in the where (null → not found in this business).
 * `existingOrderId` = a non-cancelled order already linked to it.
 * Refuses: not found, another customer, a canceled appointment/stay, or an existing order —
 * the last two unless `force`.
 */
export function decideOrderLink(
  target: LinkTarget,
  customerId: string,
  existingOrderId: string | null,
  force: boolean,
  timezone = "Asia/Jerusalem"
): LinkDecision {
  if (target.kind === "none") {
    return { relatedEntityType: null, relatedEntityId: null, orderType: null, startAt: null, endAt: null, linkPetId: null };
  }
  const label = target.kind === "appointment" ? "התור" : "שהיית הפנסיון";
  const e = target.entity;
  if (!e) throw new OrderRuleError(`${label} לא נמצא/ה בעסק זה`);
  if (!e.customerId) throw new OrderRuleError(`${label} לא משויך/ת ללקוח — לא ניתן לחייב דרכו/ה`);
  if (e.customerId !== customerId) throw new OrderRuleError(`${label} שייך/ת ללקוח אחר`);
  if (!force && (e.status === "canceled" || e.status === "cancelled")) {
    throw new OrderRuleError(`${label} מבוטל/ת — להזמנה בכל זאת (למשל דמי ביטול) שלח force=true`);
  }
  if (existingOrderId && !force) {
    throw new OrderRuleError(
      `כבר קיימת הזמנה פעילה ${target.kind === "appointment" ? "לתור הזה" : "לשהייה הזו"} (id: ${existingOrderId}) — עדכן אותה עם update_order, או שלח force=true ליצירת הזמנה נוספת`
    );
  }
  if (target.kind === "appointment") {
    const a = target.entity!;
    const { startAt, endAt } = appointmentOrderTimes(a.date, a.startTime, a.endTime, timezone);
    return { relatedEntityType: "Appointment", relatedEntityId: a.id, orderType: null, startAt, endAt, linkPetId: a.petId };
  }
  const s = target.entity!;
  return {
    relatedEntityType: "BoardingStay",
    relatedEntityId: s.id,
    orderType: "boarding",
    startAt: s.checkIn,
    endAt: s.checkOut,
    linkPetId: s.petId,
  };
}

/**
 * The order's pet: pet_id (already verified as this customer's) or the link's pet.
 * A pet_id that differs from the appointment / stay pet is refused.
 */
export function resolveOrderPet(petIdArg: string | null | undefined, linkPetId: string | null): string | null {
  if (petIdArg && linkPetId && petIdArg !== linkPetId) {
    throw new OrderRuleError("pet_id שונה מחיית המחמד של התור / השהייה");
  }
  return petIdArg || linkPetId || null;
}

// ─── update_order ─────────────────────────────────────────────────────────────

/** Statuses whose lines may be replaced when nothing is paid / pending / invoiced. */
export const UNPAID_EDITABLE_STATUSES = ["draft", "confirmed"] as const;

export function canReplaceOrderLines(o: {
  status: string;
  payments: Array<{ status: string }>;
  invoiceDocuments?: Array<{ status: string }>;
}): { ok: true } | { ok: false; reason: string } {
  if (o.status === "draft") return { ok: true };
  if (!(UNPAID_EDITABLE_STATUSES as readonly string[]).includes(o.status)) {
    return { ok: false, reason: "ניתן להחליף פריטים רק בהזמנה בטיוטה או מאושרת שלא שולמה" };
  }
  if (o.payments.some((p) => p.status === "paid" || p.status === "pending")) {
    return { ok: false, reason: "להזמנה יש תשלום (שולם / ממתין) — בטל או החזר אותו קודם, או צור הזמנה נפרדת להפרש" };
  }
  if ((o.invoiceDocuments ?? []).some((d) => d.status !== "cancelled")) {
    return { ok: false, reason: "להזמנה הופק מסמך חשבונאי — לא ניתן להחליף את הפריטים" };
  }
  return { ok: true };
}

/** "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" (Israel local) → the same string, or throws. */
export function parseLocalDateTimeArg(raw: string, field: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T([01]\d|2[0-3]):([0-5]\d))?$/.exec(raw.trim());
  if (!m) throw new OrderRuleError(`${field}: נדרש פורמט YYYY-MM-DD או YYYY-MM-DDTHH:MM`);
  const d = new Date(`${m[1]}T00:00:00.000Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[1]) throw new OrderRuleError(`${field}: תאריך לא תקין`);
  return raw.trim();
}
