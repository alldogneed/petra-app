export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || !currentUser.businessId) {
            return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
        }

        const body = await request.json();
        const { name, duration, price, type } = body;

        if (!name || price === undefined) {
            return NextResponse.json({ error: "שם ומחיר הם שדות חובה" }, { status: 400 });
        }

        // Input validation
        if (typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
            return NextResponse.json({ error: "שם שירות לא תקין (2-200 תווים)" }, { status: 400 });
        }
        if (type && (typeof type !== "string" || type.length > 100)) {
            return NextResponse.json({ error: "סוג שירות לא תקין" }, { status: 400 });
        }
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000) {
            return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });
        }
        const parsedDuration = parseInt(duration) || 60;
        if (parsedDuration < 1 || parsedDuration > 1440) {
            return NextResponse.json({ error: "משך שירות לא תקין" }, { status: 400 });
        }

        const service = await prisma.service.create({
            data: {
                businessId: currentUser.businessId,
                name: name.trim(),
                type: type ? String(type).trim().slice(0, 100) : "אילוף",
                duration: parsedDuration,
                price: parsedPrice,
                isActive: true,
            },
        });

        return NextResponse.json({ success: true, service });
    } catch (error) {
        console.error("Failed to create first service:", error);
        return NextResponse.json({ error: "שגיאה ביצירת שירות" }, { status: 500 });
    }
}
