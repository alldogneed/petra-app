import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

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
        const authResult = await requireAuth(request);
        if (isGuardError(authResult)) return authResult;

        const { id } = params;
        const businessId = DEMO_BUSINESS_ID;

        // Fetch the lead
        const lead = await prisma.lead.findFirst({
            where: { id, businessId },
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        if (lead.wonAt) {
            // Already converted - return existing customer if present
            if (lead.customerId) {
                const customer = await prisma.customer.findUnique({
                    where: { id: lead.customerId },
                });
                return NextResponse.json({ customer, alreadyConverted: true });
            }
        }

        // Find the "won" stage
        const wonStage = await prisma.leadStage.findFirst({
            where: { businessId, isWon: true },
        });

        if (!wonStage) {
            return NextResponse.json(
                { error: "No won stage configured" },
                { status: 400 }
            );
        }

        // Run in a transaction: create customer + update lead
        const result = await prisma.$transaction(async (tx) => {
            // Check if a customer already exists for this lead (in case customerId is set)
            let customer = lead.customerId
                ? await tx.customer.findUnique({ where: { id: lead.customerId } })
                : null;

            // Create a new customer if one doesn't exist yet
            if (!customer) {
                customer = await tx.customer.create({
                    data: {
                        name: lead.name,
                        phone: lead.phone ?? "",
                        email: lead.email ?? null,
                        notes: lead.notes ?? null,
                        source: lead.source ?? "lead",
                        tags: "[]",
                        businessId,
                    },
                });

                // Create a timeline event for the new customer
                await tx.timelineEvent.create({
                    data: {
                        type: "customer_created",
                        description: `לקוח נוצר מליד: ${customer.name}`,
                        customerId: customer.id,
                        businessId,
                    },
                });
            }

            // Mark lead as won and link to customer
            const updatedLead = await tx.lead.update({
                where: { id },
                data: {
                    stage: wonStage.id,
                    wonAt: new Date(),
                    customerId: customer!.id,
                },
            });

            return { customer, lead: updatedLead };
        });

        return NextResponse.json({
            customer: result.customer,
            lead: result.lead,
            alreadyConverted: false,
        });
    } catch (error) {
        console.error("Error converting lead to customer:", error);
        return NextResponse.json(
            { error: "Failed to convert lead" },
            { status: 500 }
        );
    }
}
