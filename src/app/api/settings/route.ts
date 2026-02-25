import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

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
      logo,
      vatNumber,
      businessRegNumber,
      vatEnabled,
      vatRate,
      boardingCalcMode,
      boardingMinNights,
      boardingCheckInTime,
      boardingCheckOutTime,
      boardingPricePerNight,
    } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (address !== undefined) data.address = address;
    if (logo !== undefined) data.logo = logo;
    if (vatNumber !== undefined) data.vatNumber = vatNumber;
    if (businessRegNumber !== undefined) data.businessRegNumber = businessRegNumber;
    if (vatEnabled !== undefined) data.vatEnabled = vatEnabled;
    if (vatRate !== undefined) data.vatRate = vatRate;
    if (boardingCalcMode !== undefined) data.boardingCalcMode = boardingCalcMode;
    if (boardingMinNights !== undefined) data.boardingMinNights = boardingMinNights;
    if (boardingCheckInTime !== undefined) data.boardingCheckInTime = boardingCheckInTime;
    if (boardingCheckOutTime !== undefined) data.boardingCheckOutTime = boardingCheckOutTime;
    if (boardingPricePerNight !== undefined) data.boardingPricePerNight = boardingPricePerNight;

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

    logCurrentUserActivity("UPDATE_SETTINGS");
    return NextResponse.json(business);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
