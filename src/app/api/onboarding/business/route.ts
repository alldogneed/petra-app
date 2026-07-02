export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateIsraeliPhone, sanitizeName } from "@/lib/validation";
import { VALID_LEGAL_ENTITY_TYPES, isVatExempt } from "@/lib/legal-entity";

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { name, phone, address, vatNumber, timezone, legalEntityType } = body;

        if (!name || typeof name !== "string") {
            return NextResponse.json({ error: "Business name is required" }, { status: 400 });
        }
        const safeName = sanitizeName(name);
        if (!safeName || safeName.length < 2) {
            return NextResponse.json({ error: "שם עסק לא תקין — נא להזין לפחות 2 תווים" }, { status: 400 });
        }
        if (safeName.length > 200) {
            return NextResponse.json({ error: "שם עסק ארוך מדי (עד 200 תווים)" }, { status: 400 });
        }
        if (phone && typeof phone === "string") {
            const phoneErr = validateIsraeliPhone(phone);
            if (phoneErr) return NextResponse.json({ error: phoneErr }, { status: 400 });
        }
        if (address && (typeof address !== "string" || address.length > 500)) {
            return NextResponse.json({ error: "כתובת ארוכה מדי (עד 500 תווים)" }, { status: 400 });
        }
        if (vatNumber && (typeof vatNumber !== "string" || vatNumber.length > 50)) {
            return NextResponse.json({ error: "מספר עוסק לא תקין" }, { status: 400 });
        }
        if (legalEntityType && (typeof legalEntityType !== "string" || !VALID_LEGAL_ENTITY_TYPES.includes(legalEntityType))) {
            return NextResponse.json({ error: "סוג עוסק לא תקין" }, { status: 400 });
        }

        // Same coupling as updateBusinessSettings (src/services/business.ts):
        // עוסק פטור → vatEnabled=false; other entity types → vatEnabled=true.
        const legalEntityData = legalEntityType
            ? { legalEntityType, vatEnabled: !isVatExempt(legalEntityType) }
            : {};

        // SECURITY: Only allow updating businesses the user OWNS (not just any membership)
        const userDb = await prisma.platformUser.findUnique({
            where: { id: currentUser.id },
            include: { businessMemberships: { where: { role: "owner" } } },
        });

        let businessId = userDb?.businessMemberships?.[0]?.businessId;

        if (businessId) {
            // Update existing
            await prisma.business.update({
                where: { id: businessId },
                data: {
                    name: safeName,
                    phone,
                    address,
                    vatNumber,
                    timezone: timezone || "Asia/Jerusalem",
                    ...legalEntityData,
                },
            });
        } else {
            // Create new business and membership
            const newBusiness = await prisma.business.create({
                data: {
                    name: safeName,
                    phone,
                    address,
                    vatNumber,
                    timezone: timezone || "Asia/Jerusalem",
                    status: "active",
                    tier: "basic",
                    ...legalEntityData,
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
