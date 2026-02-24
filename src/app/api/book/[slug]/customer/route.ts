import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/book/[slug]/customer?phone=050...
export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
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

    // Normalize phone (remove spaces/dashes for lookup)
    const phoneNorm = phone.replace(/[\s\-().+]/g, "")

    // Find customer by normalized phone within this business
    const customer = await prisma.customer.findFirst({
        where: { businessId: business.id, phoneNorm },
        include: {
            pets: {
                select: {
                    id: true,
                    name: true,
                    breed: true,
                    gender: true,
                }
            }
        }
    })

    if (!customer) {
        return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
        exists: true,
        name: customer.name,
        dogs: customer.pets,
    })
}
