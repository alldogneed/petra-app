export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("sign:pdf", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(params.token).digest("hex");

    const contractRequest = await prisma.contractRequest.findUnique({
      where: { tokenHash },
      select: {
        status: true,
        expiresAt: true,
        template: { select: { fileUrl: true } },
      },
    });

    if (!contractRequest) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    if (contractRequest.status === "SIGNED") {
      return NextResponse.json({ error: "החוזה כבר נחתם" }, { status: 409 });
    }

    if (contractRequest.expiresAt < new Date()) {
      return NextResponse.json({ error: "הקישור פג תוקף" }, { status: 410 });
    }

    // Proxy the PDF from Vercel Blob
    const pdfResponse = await fetch(contractRequest.template.fileUrl);
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
    console.error("GET sign/pdf error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
