import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        service: true,
        customer: true,
      },
    });

    return NextResponse.json(booking);
  } catch (error) {
    console.error("PATCH booking error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הזמנה" }, { status: 500 });
  }
}
