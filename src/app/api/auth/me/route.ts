export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSessionToken, validateSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getSessionToken();
    if (!token) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    const session = await validateSession(token);
    if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "שם לא תקין" }, { status: 400 });
    }

    await prisma.platformUser.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH auth/me error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון השם" }, { status: 500 });
  }
}
