import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const tokenHash = crypto.createHash("sha256").update(params.token).digest("hex");

    const form = await prisma.intakeForm.findUnique({
      where: { tokenHash },
      include: {
        business: {
          select: { name: true },
        },
        customer: {
          select: { name: true, phone: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    if (form.expiresAt < new Date()) {
      return NextResponse.json({ error: "הטופס פג תוקף" }, { status: 410 });
    }

    if (form.status === "SUBMITTED") {
      return NextResponse.json({ error: "הטופס כבר מולא" }, { status: 409 });
    }

    // Mark as opened
    if (form.status === "SENT") {
      await prisma.intakeForm.update({
        where: { id: form.id },
        data: { status: "OPENED", openedAt: new Date() },
      });
    }

    return NextResponse.json({
      id: form.id,
      businessName: form.business.name,
      customerName: form.customer?.name || null,
      customerPhone: form.customer?.phone || null,
      status: form.status,
    });
  } catch (error) {
    console.error("GET intake form error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת טופס" }, { status: 500 });
  }
}
