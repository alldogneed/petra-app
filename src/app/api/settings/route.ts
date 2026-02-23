import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const business = await prisma.business.findUnique({
      where: { id: DEMO_BUSINESS_ID },
      include: {
        _count: {
          select: {
            customers: true,
            appointments: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const existing = await prisma.business.findUnique({
      where: { id: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const {
      name,
      phone,
      email,
      address,
      website,
      logoUrl,
      openingHours,
      description,
    } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (address !== undefined) data.address = address;
    if (website !== undefined) data.website = website;
    if (logoUrl !== undefined) data.logoUrl = logoUrl;
    if (openingHours !== undefined) data.openingHours = openingHours;
    if (description !== undefined) data.description = description;

    const business = await prisma.business.update({
      where: { id: DEMO_BUSINESS_ID },
      data,
      include: {
        _count: {
          select: {
            customers: true,
            appointments: true,
          },
        },
      },
    });

    return NextResponse.json(business);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
