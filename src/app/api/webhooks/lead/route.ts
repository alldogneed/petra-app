export const dynamic = 'force-dynamic';
/**
 * POST /api/webhooks/lead
 *
 * Public webhook endpoint for receiving leads from external sources (e.g. Make.com).
 * Secured via x-api-key header matching MAKE_WEBHOOK_SECRET env var.
 *
 * Body (all optional except name or phone):
 *   name     – full name of the lead
 *   phone    – Israeli phone number
 *   email    – email address
 *   source   – lead source label (e.g. "all-dog", "website")
 *   notes    – free-text message / form content
 *   petName  – pet's name (appended to notes)
 *   petBreed – pet's breed (appended to notes)
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("webhook:lead", ip, RATE_LIMITS.WEBHOOK_LEAD);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Auth (constant-time comparison) ─────────────────────────────────────────
  const secret = process.env.MAKE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let authorized = false;
  try {
    const a = Buffer.from(apiKey.padEnd(secret.length, "\0"));
    const b = Buffer.from(secret.padEnd(apiKey.length, "\0"));
    authorized = apiKey.length === secret.length && timingSafeEqual(a, b);
  } catch {
    authorized = false;
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const source = typeof body.source === "string" ? body.source.trim() : "all-dog";
  const businessId =
    typeof body.businessId === "string" ? body.businessId.trim() : undefined;
  const petName = typeof body.petName === "string" ? body.petName.trim() : undefined;
  const petBreed = typeof body.petBreed === "string" ? body.petBreed.trim() : undefined;
  const rawNotes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  if (!name && !phone) {
    return NextResponse.json(
      { error: "At least one of: name, phone is required" },
      { status: 400 }
    );
  }

  if (!businessId) {
    return NextResponse.json(
      { error: "businessId is required in the request body" },
      { status: 400 }
    );
  }

  // Build notes — include pet info if provided
  const notesParts: string[] = [];
  if (rawNotes) notesParts.push(rawNotes);
  if (petName) notesParts.push(`שם כלב: ${petName}`);
  if (petBreed) notesParts.push(`גזע: ${petBreed}`);
  const notes = notesParts.length > 0 ? notesParts.join("\n") : undefined;

  // ── Create lead ─────────────────────────────────────────────────────────────
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: name || phone || "ליד מהאתר",
        phone: phone || undefined,
        email: email || undefined,
        source,
        stage: "new",
        notes: notes || undefined,
      },
      select: { id: true, name: true, stage: true, createdAt: true },
    });

    return NextResponse.json(
      { success: true, leadId: lead.id, name: lead.name, stage: lead.stage },
      { status: 201 }
    );
  } catch (error) {
    console.error("[webhook/lead] DB error:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
