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
    const name = ((formData.get("name") as string | null)?.trim() || "").replace(/[<>"'&]/g, "").slice(0, 255);
    const rawDocType = (formData.get("docType") as string | null) || "OTHER";
    // Validate docType against allowlist to prevent arbitrary strings in DB
    const VALID_DOC_TYPES = ["MEDICAL", "TRAINING", "LEGAL", "INSURANCE", "ID", "OTHER"];
    const docType = VALID_DOC_TYPES.includes(rawDocType) ? rawDocType : "OTHER";

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
      fileName: file.name.replace(/[<>"'&]/g, "").slice(0, 255),
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

/**
 * PATCH /api/service-dogs/[id]/documents
 * Rename a document and/or change its type. Body: { docId, name?, docType? }
 *
 * Deliberately narrow: only these two fields of one existing entry can change.
 * The file URL is never taken from the client here.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 }); }

    const docId = typeof body.docId === "string" ? body.docId : "";
    if (!docId || docId.length > 100) return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 400 });

    const nameRaw = body.name;
    const typeRaw = body.docType;
    if (nameRaw === undefined && typeRaw === undefined) {
      return NextResponse.json({ error: "אין שינויים לשמור" }, { status: 400 });
    }

    let name: string | undefined;
    if (nameRaw !== undefined) {
      if (typeof nameRaw !== "string") return NextResponse.json({ error: "שם מסמך לא תקין" }, { status: 400 });
      name = nameRaw.replace(/[<>"'&]/g, "").trim().slice(0, 255);
      if (!name) return NextResponse.json({ error: "שם המסמך חסר" }, { status: 400 });
    }

    // Same allowlist as upload — TRAINING_CERT belongs to the tests tab and is not offered here
    const VALID_DOC_TYPES = ["HEALTH_CERT", "ANTIBODIES", "LICENSE", "VACCINATION", "VET_REPORT", "PURCHASE_INVOICE", "VISIT_INVOICE", "MEDICAL", "TRAINING", "LEGAL", "INSURANCE", "ID", "OTHER"];
    let docType: string | undefined;
    if (typeRaw !== undefined) {
      if (typeof typeRaw !== "string" || !VALID_DOC_TYPES.includes(typeRaw)) {
        return NextResponse.json({ error: "סוג מסמך לא תקין" }, { status: 400 });
      }
      docType = typeRaw;
    }

    const profile = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, documents: true },
    });
    if (!profile) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    let docs: Array<Record<string, unknown>> = [];
    const raw = profile.documents as unknown;
    try { docs = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : JSON.parse((raw as string) || "[]"); } catch { docs = []; }

    const idx = docs.findIndex((d) => d && d.id === docId);
    if (idx === -1) return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    if (docs[idx].docType === "TRAINING_CERT") {
      return NextResponse.json({ error: "מסמך מבחן — ניתן לעריכה מלשונית מבחני הסמכה" }, { status: 400 });
    }

    const updatedDoc = { ...docs[idx], ...(name !== undefined && { name }), ...(docType !== undefined && { docType }) };
    docs = docs.map((d, i) => (i === idx ? updatedDoc : d));

    await prisma.serviceDogProfile.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: { documents: JSON.stringify(docs) },
    });

    return NextResponse.json(updatedDoc);
  } catch (error) {
    console.error("PATCH service-dog document error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון המסמך" }, { status: 500 });
  }
}
