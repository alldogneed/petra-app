export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess } from "@/lib/customer-access";
import { getCustomerSalesHistory } from "@/services/clients";

/**
 * GET /api/customers/[id]/sales-history
 * Every lead linked to the customer (won / lost / open) with its full sales journal.
 * Shape: CustomerSalesHistory (src/lib/lead-sales-history.ts). businessId from session only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Same CUSTOMERS_PII gate as GET /api/customers/[id] (overrides honoured).
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;

    const history = await getCustomerSalesHistory(authResult.businessId, prisma, params.id);
    if (!history) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(history);
  } catch (error) {
    console.error("Customer sales-history GET error:", error);
    return NextResponse.json({ error: "Failed to fetch sales history" }, { status: 500 });
  }
}
