/**
 * Boarding stays of ONE customer — shared by the customer card section
 * (GET /api/customers/[id]/boarding) and MCP get_client. Read-only.
 * Support ticket גבעת הכלבים 17/11/2026: stays were visible only on the boarding board.
 */
import prisma from "@/lib/prisma";
import { ServiceError } from "./types";

export const CUSTOMER_STAYS_MAX = 100;

export interface CustomerStayRow {
  id: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
  notes: string | null;
  pet: { id: string; name: string };
  room: { id: string; name: string } | null;
  /** Paid payments linked to the stay (ILS). */
  paidAmount: number;
}

export interface CustomerStaysResult {
  stays: CustomerStayRow[];
  total: number;
  /** Stays that are not canceled and not checked out yet. */
  activeCount: number;
}

/**
 * Newest first. `businessId` comes from the session / MCP token — the customer is
 * re-checked against it (404 for another business's customer).
 */
export async function listCustomerStays(
  businessId: string,
  customerId: string,
  opts: { limit?: number; includeCanceled?: boolean } = {}
): Promise<CustomerStaysResult> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } });
  if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), CUSTOMER_STAYS_MAX);
  const where = {
    businessId,
    customerId,
    ...(opts.includeCanceled === false ? { status: { not: "canceled" } } : {}),
  };
  const [rows, total, activeCount] = await Promise.all([
    prisma.boardingStay.findMany({
      where,
      orderBy: { checkIn: "desc" },
      take: limit,
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true,
        notes: true,
        pet: { select: { id: true, name: true } },
        room: { select: { id: true, name: true } },
        payments: { where: { status: "paid" }, select: { amount: true } },
      },
    }),
    prisma.boardingStay.count({ where }),
    prisma.boardingStay.count({ where: { businessId, customerId, status: { in: ["reserved", "checked_in"] } } }),
  ]);

  return {
    stays: rows.map(({ payments, ...r }) => ({
      ...r,
      paidAmount: payments.reduce((sum, p) => sum + (p.amount ?? 0), 0),
    })),
    total,
    activeCount,
  };
}
