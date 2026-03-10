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
        const { clientName, clientPhone, dogName, dogBreed } = body;

        if (!clientName || !clientPhone) {
            return NextResponse.json({ error: "שם וטלפון הם שדות חובה" }, { status: 400 });
        }

        // Create Customer
        const customer = await prisma.customer.create({
            data: {
                businessId: currentUser.businessId,
                name: clientName,
                phone: clientPhone,
                source: "onboarding",
            },
        });

        // Create Pet if dog name provided
        if (dogName) {
            await prisma.pet.create({
                data: {
                    customerId: customer.id,
                    name: dogName,
                    breed: dogBreed || null,
                    species: "dog",
                },
            });
        }

        return NextResponse.json({ success: true, customerId: customer.id });
    } catch (error) {
        console.error("Failed to create first client:", error);
        return NextResponse.json({ error: "שגיאה ביצירת לקוח" }, { status: 500 });
    }
}
