export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/exports – list export jobs
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const exports = await prisma.exportJob.findMany({
      where: { businessId },
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const body = await request.json();
    const { exportType, format, outputMode, filterFromDate, filterToDate } = body;

    if (!exportType) {
      return NextResponse.json({ error: "exportType is required" }, { status: 400 });
    }

    const exportJob = await prisma.exportJob.create({
      data: {
        businessId,
        userId: session.user.id,
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
