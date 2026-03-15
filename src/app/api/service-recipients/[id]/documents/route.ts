export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const recipient = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, attachments: true },
    });
    if (!recipient) return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = (formData.get("name") as string | null)?.trim() || "";
    const docType = (formData.get("docType") as string | null) || "OTHER";

    if (!file) return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "שם המסמך חסר" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `קובץ גדול מדי – מקסימום 10MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileId = crypto.randomBytes(16).toString("hex");
    const blobPath = `service-recipients/${params.id}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    let docs: unknown[] = [];
    try { docs = JSON.parse((recipient.attachments as string) || "[]"); } catch { docs = []; }

    const contactPersonId = (formData.get("contactPersonId") as string | null) || undefined;

    const newDoc = {
      id: fileId,
      name,
      url: blob.url,
      docType,
      uploadedAt: new Date().toISOString(),
      isFile: true,
      fileName: file.name,
      fileSize: file.size,
      ...(contactPersonId && { contactPersonId }),
    };
    docs = [newDoc, ...docs];

    await prisma.serviceDogRecipient.update({
      where: { id: params.id },
      data: { attachments: JSON.stringify(docs) },
    });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error) {
    console.error("POST service-recipient document error:", error);
    return NextResponse.json({ error: "שגיאה בהעלאת המסמך" }, { status: 500 });
  }
}
