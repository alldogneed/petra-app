export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

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
        const authResult = await requireBusinessAuth(request);
        if (isGuardError(authResult)) return authResult;

        const { id } = params;
        const { businessId } = authResult;

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

        // Find the won stage for this business, auto-create if missing
        let wonStage = await prisma.leadStage.findFirst({
            where: { businessId, isWon: true },
        });
        if (!wonStage) {
            const maxOrder = await prisma.leadStage.count({ where: { businessId } });
            wonStage = await prisma.leadStage.create({
                data: {
                    businessId,
                    name: "נסגר בהצלחה",
                    color: "#10b981",
                    sortOrder: maxOrder + 1,
                    isWon: true,
                    isLost: false,
                },
            });
        }

        // Check if a customer already exists for this lead (in case customerId is set)
        let customer = lead.customerId
            ? await prisma.customer.findUnique({ where: { id: lead.customerId } })
            : null;

        // Create a new customer if one doesn't exist yet
        if (!customer) {
            customer = await prisma.customer.create({
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
            await prisma.timelineEvent.create({
                data: {
                    type: "customer_created",
                    description: `לקוח נוצר מליד: ${customer.name}`,
                    customerId: customer.id,
                    businessId,
                },
            });
        }

        // Mark lead as won and link to customer
        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                stage: wonStage.id,
                wonAt: new Date(),
                customerId: customer!.id,
            },
        });

        const result = { customer, lead: updatedLead };

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
