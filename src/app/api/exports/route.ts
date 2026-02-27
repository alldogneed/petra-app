export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

// GET /api/exports – list export jobs
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const exports = await prisma.exportJob.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(exports);
  } catch (error) {
    console.error("GET exports error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת ייצואים" }, { status: 500 });
  }
}

// POST /api/exports – create a new export job
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { exportType, format, outputMode, filterFromDate, filterToDate } = body;

    if (!exportType) {
      return NextResponse.json({ error: "exportType is required" }, { status: 400 });
    }

    const exportJob = await prisma.exportJob.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        userId: currentUser.id,
        exportType,
        format: format || "xlsx",
        outputMode: outputMode || "separate",
        status: "pending",
        filterFromDate: filterFromDate ? new Date(filterFromDate) : null,
        filterToDate: filterToDate ? new Date(filterToDate) : null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    // In a real app, this would trigger a background job
    // For demo, mark as completed immediately
    const updated = await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "completed",
        fileName: `${exportType}_export_${new Date().toISOString().slice(0, 10)}.${format || "xlsx"}`,
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("POST export error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת ייצוא" }, { status: 500 });
  }
}
