import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const messages = await prisma.systemMessage.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("System messages API error:", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const message = await prisma.systemMessage.create({
      data: {
        ...body,
        businessId: DEMO_BUSINESS_ID,
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
