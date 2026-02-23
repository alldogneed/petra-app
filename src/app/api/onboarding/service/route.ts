import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || !currentUser.businessId) {
            return NextResponse.json({ error: "Unauthorized or no business" }, { status: 401 });
        }

        const body = await request.json();
        const { name, duration, price, type } = body;

        if (!name || price === undefined) {
            return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
        }

        const service = await prisma.service.create({
            data: {
                businessId: currentUser.businessId,
                name,
                type: type || "אילוף",
                duration: parseInt(duration) || 60,
                price: parseFloat(price) || 0,
                isActive: true,
            },
        });

        return NextResponse.json({ success: true, service });
    } catch (error) {
        console.error("Failed to create first service:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
