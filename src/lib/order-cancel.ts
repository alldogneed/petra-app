/**
 * Can this order be cancelled? Shared by the order page, the orders list and
 * updateOrder() so the button and the server never disagree.
 *
 * draft / confirmed → always. completed / in_progress → only when nothing was paid
 * on it: a "completed" order whose meeting never happened stayed as a debt with no
 * way out (support ticket 2026-10-19). Money already taken must be cancelled or
 * refunded on the payment first — cancelling the order alone would hide it.
 */
export function canCancelOrder(status: string, paidAmount: number): boolean {
  if (status === "draft" || status === "confirmed") return true;
  if (status === "completed" || status === "in_progress") return paidAmount <= 0;
  return false;
}

export const CANCEL_PAID_ORDER_ERROR = "בהזמנה יש תשלום ששולם — בטלו או החזירו את התשלום לפני ביטול ההזמנה";
