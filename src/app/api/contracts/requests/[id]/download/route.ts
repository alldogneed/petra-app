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
    const contractRequest = await prisma.contractRequest.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: {
        signedFileUrl: true,
        status: true,
        template: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    if (!contractRequest) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    if (contractRequest.status !== "SIGNED" || !contractRequest.signedFileUrl) {
      return NextResponse.json({ error: "החוזה טרם נחתם" }, { status: 409 });
    }

    const pdfResponse = await fetch(contractRequest.signedFileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: "לא ניתן לטעון את הקובץ" }, { status: 502 });
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const filename = `חוזה-חתום-${contractRequest.customer.name}-${contractRequest.template.name}.pdf`
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, "-");

    // ?inline=1 → display in browser (for viewer modal); default → force download
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const disposition = inline
      ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("GET contract download error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
