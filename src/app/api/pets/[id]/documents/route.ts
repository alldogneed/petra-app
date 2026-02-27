export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pet = await prisma.pet.findUnique({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const pet = await prisma.pet.findUnique({
      where: { id: params.id },
      select: { attachments: true },
    });
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileId = crypto.randomBytes(16).toString("hex");
    const filename = `${fileId}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "pets", params.id);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    // Build document metadata
    const newDoc = {
      id: fileId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: `/uploads/pets/${params.id}/${filename}`,
      createdAt: new Date().toISOString(),
    };

    // Update pet attachments
    let docs = [];
    try { docs = JSON.parse(pet.attachments || "[]"); } catch { docs = []; }
    docs.push(newDoc);

    await prisma.pet.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    const pet = await prisma.pet.findUnique({
      where: { id: params.id },
      select: { attachments: true },
    });
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    let docs = [];
    try { docs = JSON.parse(pet.attachments || "[]"); } catch { docs = []; }
    const filtered = docs.filter((d: { id: string }) => d.id !== docId);

    await prisma.pet.update({
      where: { id: params.id },
      data: { attachments: JSON.stringify(filtered) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE document error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
