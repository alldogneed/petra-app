/**
 * Support tickets — client-safe definitions (statuses, event types, SLA rule).
 * DB logic lives in src/services/support-tickets.ts.
 */

export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  resolved: "נסגר",
};

export function isSupportTicketStatus(v: unknown): v is SupportTicketStatus {
  return typeof v === "string" && (SUPPORT_TICKET_STATUSES as readonly string[]).includes(v);
}

export const SUPPORT_EVENT_TYPES = [
  "created",
  "customer_reply",
  "staff_reply",
  "internal_note",
  "status_change",
] as const;
export type SupportEventType = (typeof SUPPORT_EVENT_TYPES)[number];

/** Events the customer may see — internal notes stay with the Petra team. */
export function isCustomerVisibleEvent(type: string): boolean {
  return type !== "internal_note";
}

/** A ticket nobody answered for this long is "overdue" (red in /owner/support, cron alert). */
export const SUPPORT_SLA_HOURS = 4;

export const SUPPORT_REPLY_MAX = 5000;
export const SUPPORT_REPLY_MIN = 2;

export interface WaitingInput {
  status: string;
  lastCustomerMessageAt: Date | string | null;
  lastStaffReplyAt: Date | string | null;
  createdAt: Date | string;
}

const toMs = (d: Date | string | null) => (d == null ? null : new Date(d).getTime());

/**
 * When the customer started waiting for us, or null when the ball is in their court
 * (resolved, or our last reply is newer than their last message).
 */
export function waitingSince(t: WaitingInput): Date | null {
  if (t.status === "resolved") return null;
  const customer = toMs(t.lastCustomerMessageAt) ?? toMs(t.createdAt)!;
  const staff = toMs(t.lastStaffReplyAt);
  if (staff != null && staff >= customer) return null;
  return new Date(customer);
}

export function isOverdue(t: WaitingInput, now: Date = new Date()): boolean {
  const since = waitingSince(t);
  return since != null && now.getTime() - since.getTime() >= SUPPORT_SLA_HOURS * 3_600_000;
}

/** "לפני 5 דק׳" / "לפני 3 שעות" / "לפני 2 ימים" — compact waiting label. */
export function waitingLabel(since: Date, now: Date = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (min < 60) return `${min} דק׳`;
  const h = Math.floor(min / 60);
  if (h < 48) return h === 1 ? "שעה" : `${h} שעות`;
  return `${Math.floor(h / 24)} ימים`;
}

/** Validate a reply / note body. Returns the trimmed text or an error message. */
export function validateSupportReply(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "חסר תוכן להודעה" };
  const body = raw.trim();
  if (body.length < SUPPORT_REPLY_MIN) return { ok: false, error: "ההודעה קצרה מדי" };
  if (body.length > SUPPORT_REPLY_MAX) return { ok: false, error: `ההודעה ארוכה מדי (מקסימום ${SUPPORT_REPLY_MAX} תווים)` };
  return { ok: true, body };
}
