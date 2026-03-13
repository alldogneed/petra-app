export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

interface ContractField {
  id: string;
  type: "customer_name" | "id_number" | "address" | "phone" | "signature";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("sign:view", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(params.token).digest("hex");

    const contractRequest = await prisma.contractRequest.findUnique({
      where: { tokenHash },
      include: {
        template: {
          select: {
            name: true,
            fileUrl: true,
            signaturePage: true,
            signatureX: true,
            signatureY: true,
            signatureWidth: true,
            signatureHeight: true,
            fields: true,
          },
        },
        business: { select: { name: true } },
        customer: { select: { name: true, phone: true, idNumber: true, address: true } },
      },
    });

    if (!contractRequest) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    if (contractRequest.status === "SIGNED") {
      return NextResponse.json({ error: "החוזה כבר נחתם", status: "SIGNED" }, { status: 409 });
    }

    if (contractRequest.expiresAt < new Date()) {
      return NextResponse.json({ error: "הקישור פג תוקף", status: "EXPIRED" }, { status: 410 });
    }

    // Mark as opened
    if (contractRequest.status === "PENDING") {
      await prisma.contractRequest.updateMany({
        where: { id: contractRequest.id, status: "PENDING" },
        data: { status: "PENDING", openedAt: new Date() },
      });
    }

    let fields: ContractField[] = [];
    try {
      fields = JSON.parse(contractRequest.template.fields || "[]");
    } catch {
      fields = [];
    }

    return NextResponse.json({
      customerName: contractRequest.customer.name,
      businessName: contractRequest.business.name,
      templateName: contractRequest.template.name,
      pdfUrl: contractRequest.template.fileUrl,
      signaturePage: contractRequest.template.signaturePage,
      signatureX: contractRequest.template.signatureX,
      signatureY: contractRequest.template.signatureY,
      signatureWidth: contractRequest.template.signatureWidth,
      signatureHeight: contractRequest.template.signatureHeight,
      status: contractRequest.status,
      // New: multi-field support
      fields,
      customerData: {
        customer_name: contractRequest.customer.name,
        phone: contractRequest.customer.phone ?? "",
        id_number: contractRequest.customer.idNumber ?? "",
        address: contractRequest.customer.address ?? "",
      },
    });
  } catch (error) {
    console.error("GET sign error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("sign:submit", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(params.token).digest("hex");

    const contractRequest = await prisma.contractRequest.findUnique({
      where: { tokenHash },
      include: {
        template: true,
        customer: { select: { id: true, businessId: true, documents: true, name: true, phone: true, idNumber: true, address: true } },
        business: { select: { id: true } },
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

    const body = await request.json();
    const { signatureBase64 } = body;

    if (!signatureBase64 || typeof signatureBase64 !== "string") {
      return NextResponse.json({ error: "חתימה חסרה" }, { status: 400 });
    }

    // Load original PDF
    const pdfResponse = await fetch(contractRequest.template.fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: "לא ניתן לטעון את קובץ ה-PDF" }, { status: 500 });
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

    // Embed fields into PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Strip data URL prefix if present
    const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, "");
    const sigBytes = Buffer.from(base64Data, "base64");
    const sigImage = await pdfDoc.embedPng(sigBytes);

    // Build customer data map
    const customerDataMap: Record<string, string> = {
      customer_name: contractRequest.customer.name,
      phone: contractRequest.customer.phone ?? "",
      id_number: contractRequest.customer.idNumber ?? "",
      address: contractRequest.customer.address ?? "",
    };

    // Try to parse multi-field layout
    let fields: ContractField[] = [];
    try {
      fields = JSON.parse(contractRequest.template.fields || "[]");
    } catch {
      fields = [];
    }

    if (fields.length > 0) {
      // New multi-field mode — embed each field
      // Load Hebrew font
      let heeboFont;
      try {
        const fontBytes = readFileSync(join(process.cwd(), "public/fonts/Heebo-Regular.ttf"));
        heeboFont = await pdfDoc.embedFont(fontBytes);
      } catch {
        // Font unavailable — skip text fields, still embed signature
      }

      for (const field of fields) {
        const pageIndex = Math.min(field.page - 1, pages.length - 1);
        const page = pages[pageIndex];
        const { width: pw, height: ph } = page.getSize();

        const fx = field.x * pw;
        const fw = field.width * pw;
        const fh = field.height * ph;
        // PDF y-origin is bottom-left — convert from top-based fraction
        const fy = ph - (field.y + field.height) * ph;

        if (field.type === "signature") {
          page.drawImage(sigImage, { x: fx, y: fy, width: fw, height: fh });
        } else if (heeboFont) {
          const text = customerDataMap[field.type] ?? "";
          if (text) {
            const fontSize = Math.max(8, Math.min(Math.round(fh * 0.55), 14));
            page.drawText(text, {
              x: fx,
              y: fy + fh * 0.2,
              font: heeboFont,
              size: fontSize,
            });
          }
        }
      }
    } else {
      // Legacy single-signature mode
      const pageIndex = Math.min(contractRequest.template.signaturePage - 1, pages.length - 1);
      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      const sigX = contractRequest.template.signatureX * pageWidth;
      const sigW = contractRequest.template.signatureWidth * pageWidth;
      const sigH = contractRequest.template.signatureHeight * pageHeight;
      const sigY = pageHeight - (contractRequest.template.signatureY + contractRequest.template.signatureHeight) * pageHeight;

      page.drawImage(sigImage, { x: sigX, y: sigY, width: sigW, height: sigH });
    }

    const signedPdfBytes = await pdfDoc.save();
    const signedPdfBuffer = Buffer.from(signedPdfBytes);

    // Upload signed PDF to Blob
    const blobPath = `contracts/${contractRequest.businessId}/${contractRequest.id}-signed.pdf`;
    const blob = await put(blobPath, signedPdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    });

    // Capture user agent for audit trail
    const userAgent = request.headers.get("user-agent") ?? null;

    // Update ContractRequest
    await prisma.contractRequest.update({
      where: { id: contractRequest.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signedFileUrl: blob.url,
        ipAddress: ip,
        userAgent,
      },
    });

    // Add signed PDF to customer documents
    const docId = crypto.randomBytes(16).toString("hex");
    const newDoc = {
      id: docId,
      name: `חוזה חתום — ${contractRequest.template.name}`,
      originalName: `contract-signed-${contractRequest.id}.pdf`,
      mimeType: "application/pdf",
      size: signedPdfBuffer.byteLength,
      url: blob.url,
      category: "contract",
      createdAt: new Date().toISOString(),
    };

    let docs: unknown[] = [];
    try {
      docs = JSON.parse(contractRequest.customer.documents || "[]");
    } catch {
      docs = [];
    }
    docs.push(newDoc);

    // Ensure business isolation — only update customer if businessId matches
    await prisma.customer.updateMany({
      where: {
        id: contractRequest.customerId,
        businessId: contractRequest.businessId,
      },
      data: { documents: JSON.stringify(docs) },
    });

    return NextResponse.json({ ok: true, signedFileUrl: blob.url });
  } catch (error) {
    console.error("POST sign error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
