export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { convertLeadToCustomer } from "@/services/lead-meetings";
import { ServiceError } from "@/services/types";

/**
 * POST /api/leads/[id]/convert
 *
 * Converts a lead to a customer (won flow):
 * 1. Finds the "won" stage for this business
 * 2. Creates or reuses an existing Customer with the lead's data
 * 3. Marks the lead as won (wonAt, stage=wonStage) and links it to the new customer
 * 4. Returns the new customer so the frontend can navigate to /customers/[id]
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authResult = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
        if (isGuardError(authResult)) return authResult;
        const { businessId } = authResult;

        // Single implementation shared with the lead-meeting "התקיימה" outcome.
        const result = await convertLeadToCustomer(businessId, prisma, params.id, authResult.session.user.id);
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof ServiceError && error.code === "NOT_FOUND") {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }
        console.error("Error converting lead to customer:", error);
        return NextResponse.json(
            { error: "Failed to convert lead" },
            { status: 500 }
        );
    }
}
