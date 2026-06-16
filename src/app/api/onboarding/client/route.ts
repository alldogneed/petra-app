export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeName, validateIsraeliPhone, normalizeIsraeliPhone } from "@/lib/validation";

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

        // Input validation
        const safeName = sanitizeName(clientName);
        if (!safeName || safeName.length < 2) {
            return NextResponse.json({ error: "שם לא תקין — נא להזין לפחות 2 תווים" }, { status: 400 });
        }
        const phoneErr = validateIsraeliPhone(clientPhone);
        if (phoneErr) {
            return NextResponse.json({ error: phoneErr }, { status: 400 });
        }
        const normalizedPhone = normalizeIsraeliPhone(clientPhone);

        const safeDogName = dogName ? sanitizeName(dogName) : null;
        if (dogName && (!safeDogName || safeDogName.length < 1)) {
            return NextResponse.json({ error: "שם כלב לא תקין" }, { status: 400 });
        }
        if (dogBreed && typeof dogBreed === "string" && dogBreed.length > 200) {
            return NextResponse.json({ error: "שם גזע ארוך מדי" }, { status: 400 });
        }

        // Create Customer
        const customer = await prisma.customer.create({
            data: {
                businessId: currentUser.businessId,
                name: safeName,
                phone: normalizedPhone,
                source: "onboarding",
            },
        });

        // Create Pet if dog name provided
        if (safeDogName) {
            await prisma.pet.create({
                data: {
                    customerId: customer.id,
                    name: safeDogName,
                    breed: dogBreed ? String(dogBreed).slice(0, 200) : null,
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
