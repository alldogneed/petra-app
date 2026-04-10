export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { put, del } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_FILE_EXTENSIONS = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp",
  "doc", "docx", "xls", "xlsx", "csv",
  "txt", "rtf", "heic", "heif",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pet = await prisma.pet.findFirst({
      where: { id: params.petId, customer: { businessId: authResult.businessId } },
      select: { attachments: true },
    });
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    let docs = [];
    try { docs = JSON.parse(pet.attachments || "[]"); } catch { docs = []; }

    return NextResponse.json(docs);
  } catch (error) {
    console.error("GET documents error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `קובץ גדול מדי – גודל מקסימלי 10MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const pet = await prisma.pet.findFirst({
      where: { id: params.petId, customer: { businessId: authResult.businessId } },
      select: { attachments: true },
    });
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    if (!(ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { error: `סוג קובץ לא נתמך (${ext}). סוגי קבצים מותרים: ${ALLOWED_FILE_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const fileId = crypto.randomBytes(16).toString("hex");
    const blobPath = `pets/${params.petId}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    const newDoc = {
      id: fileId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: blob.url,
      createdAt: new Date().toISOString(),
    };

    let docs = [];
    try { docs = JSON.parse(pet.attachments || "[]"); } catch { docs = []; }
    docs.push(newDoc);

    await prisma.pet.update({
      where: { id: params.petId },
      data: { attachments: JSON.stringify(docs) },
    });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error) {
    console.error("POST document error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    const pet = await prisma.pet.findFirst({
      where: { id: params.petId, customer: { businessId: authResult.businessId } },
      select: { attachments: true },
    });
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    let docs: { id: string; url: string }[] = [];
    try { docs = JSON.parse(pet.attachments || "[]"); } catch { docs = []; }

    const docToDelete = docs.find((d) => d.id === docId);
    if (docToDelete?.url?.includes("vercel-storage.com")) {
      try { await del(docToDelete.url); } catch { /* ignore */ }
    }

    const filtered = docs.filter((d: { id: string }) => d.id !== docId);

    await prisma.pet.update({
      where: { id: params.petId },
      data: { attachments: JSON.stringify(filtered) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE document error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
