export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

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
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "סוג קובץ לא מורשה" }, { status: 400 });
    }

    const profile = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, documents: true },
    });
    if (!profile) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    // Upload to Vercel Blob
    const fileId = crypto.randomBytes(16).toString("hex");
    const blobPath = `service-dogs/${params.id}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    // Append to documents JSON
    let docs: unknown[] = [];
    try { docs = JSON.parse((profile.documents as string) || "[]"); } catch { docs = []; }

    const newDoc = {
      id: fileId,
      name,
      url: blob.url,
      docType,
      uploadedAt: new Date().toISOString(),
      isFile: true,
      fileName: file.name,
      fileSize: file.size,
    };
    docs = [newDoc, ...docs];

    await prisma.serviceDogProfile.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: { documents: JSON.stringify(docs) },
    });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error) {
    console.error("POST service-dog document error:", error);
    return NextResponse.json({ error: "שגיאה בהעלאת המסמך" }, { status: 500 });
  }
}
