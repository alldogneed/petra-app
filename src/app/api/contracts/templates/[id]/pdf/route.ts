export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { fileUrl: true },
    });

    if (!template) {
      return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });
    }

    // SSRF guard: only fetch from Vercel Blob storage
    try {
      const fileHost = new URL(template.fileUrl).hostname;
      if (!fileHost.endsWith("vercel-storage.com") && !fileHost.endsWith("blob.vercel.app")) {
        return NextResponse.json({ error: "כתובת קובץ לא תקינה" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "כתובת קובץ לא תקינה" }, { status: 400 });
    }

    const pdfResponse = await fetch(template.fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: "לא ניתן לטעון PDF" }, { status: 502 });
    }

    const pdfBytes = await pdfResponse.arrayBuffer();

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("GET template/pdf error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
