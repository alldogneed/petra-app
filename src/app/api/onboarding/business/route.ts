import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { name, phone, address, vatNumber, timezone } = body;

        if (!name) {
            return NextResponse.json({ error: "Business name is required" }, { status: 400 });
        }

        // Since a user can have memberships, checking if they exist
        const userDb = await prisma.platformUser.findUnique({
            where: { id: currentUser.id },
            include: { businessMemberships: true },
        });

        let businessId = userDb?.businessMemberships?.[0]?.businessId;

        if (businessId) {
            // Update existing
            await prisma.business.update({
                where: { id: businessId },
                data: {
                    name,
                    phone,
                    address,
                    vatNumber,
                    timezone: timezone || "Asia/Jerusalem",
                },
            });
        } else {
            // Create new business and membership
            const newBusiness = await prisma.business.create({
                data: {
                    name,
                    phone,
                    address,
                    vatNumber,
                    timezone: timezone || "Asia/Jerusalem",
                    status: "active",
                    tier: "basic",
                },
            });
            businessId = newBusiness.id;

            await prisma.businessUser.create({
                data: {
                    businessId,
                    userId: currentUser.id,
                    role: "owner",
                },
            });
        }

        return NextResponse.json({ success: true, businessId });
    } catch (error) {
        console.error("Failed to update business details:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
