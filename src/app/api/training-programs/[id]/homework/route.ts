export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createProgramHomework, updateProgramHomework, deleteProgramHomework, ServiceError } from "@/services/training";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { title, description, dueDate } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (typeof title !== "string" || title.length > 300) {
      return NextResponse.json({ error: "title too long (max 300)" }, { status: 400 });
    }
    if (description !== undefined && description !== null &&
        (typeof description !== "string" || description.length > 2000)) {
      return NextResponse.json({ error: "description too long (max 2000)" }, { status: 400 });
    }

    let item;
    try {
      item = await createProgramHomework(authResult.businessId, prisma, params.id, {
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/homework error:", error);
    return NextResponse.json({ error: "Failed to create homework" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { homeworkId, isCompleted, customerNotes } = body;

    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }
    if (customerNotes !== undefined && customerNotes !== null && (typeof customerNotes !== "string" || customerNotes.length > 5000)) {
      return NextResponse.json({ error: "הערות ארוכות מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }

    let item;
    try {
      item = await updateProgramHomework(authResult.businessId, prisma, homeworkId, {
        isCompleted,
        customerNotes,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Homework not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("PATCH /api/training-programs/[id]/homework error:", error);
    return NextResponse.json({ error: "Failed to update homework" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(req.url);
    const homeworkId = searchParams.get("homeworkId");
    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }

    try {
      await deleteProgramHomework(authResult.businessId, prisma, homeworkId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Homework not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-programs/[id]/homework error:", error);
    return NextResponse.json({ error: "Failed to delete homework" }, { status: 500 });
  }
}
