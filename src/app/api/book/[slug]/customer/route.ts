export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

// GET /api/book/[slug]/customer?phone=050...
export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1"
        // SECURITY: Tight rate limit to prevent phone enumeration attacks
        const rl = rateLimit("public_customer_lookup", ip, { max: 5, windowMs: 60 * 1000 })
        if (!rl.allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 })
        }

        const { searchParams } = new URL(req.url)
        const phone = searchParams.get('phone')

        if (!phone) {
            return NextResponse.json({ error: "phone is required" }, { status: 400 })
        }

        // Find business by slug
        const business = await prisma.business.findUnique({
            where: { slug: params.slug },
            select: { id: true, status: true },
        })

        if (!business || business.status !== "active") {
            return NextResponse.json({ error: "Business not found" }, { status: 404 })
        }

        // Normalize phone: strip non-digits, convert Israeli local (05x) → international (972x)
        const phoneNorm = (() => {
            const digits = phone.replace(/\D/g, "")
            if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1)
            return digits
        })()

        // Find customer by normalized phone; fall back to raw phone for manually-created customers
        const petInclude = {
            pets: {
                select: { id: true, name: true, breed: true, gender: true }
            }
        }
        let customer = await prisma.customer.findFirst({
            where: { businessId: business.id, phoneNorm },
            include: petInclude,
        })
        // Fallback: manually-created customers may have no phoneNorm
        if (!customer) {
            customer = await prisma.customer.findFirst({
                where: { businessId: business.id, phone },
                include: petInclude,
            })
        }

        if (!customer) {
            return NextResponse.json({ exists: false })
        }

        // SECURITY: Return only first name initial + pet names for booking UX
        // Avoids full PII exposure through phone enumeration
        const maskedName = customer.name
            ? customer.name.split(" ")[0] + (customer.name.includes(" ") ? " " + customer.name.split(" ").slice(1).map((w: string) => w[0] + ".").join(" ") : "")
            : "";

        return NextResponse.json({
            exists: true,
            name: maskedName,
            dogs: customer.pets?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) ?? [],
        })
    } catch (error) {
        console.error("GET book/[slug]/customer error:", error)
        return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 })
    }
}
