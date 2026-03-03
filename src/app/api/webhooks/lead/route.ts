export const dynamic = 'force-dynamic';
/**
 * POST /api/webhooks/lead
 *
 * Public webhook endpoint for receiving leads from external sources (e.g. Next.js website).
 * Secured via x-api-key header matching MAKE_WEBHOOK_SECRET env var.
 *
 * Body (at least name/fullName/firstName or phone required):
 *   name          – full name of the lead (OR use firstName + lastName, OR fullName)
 *   firstName     – first name (combined with lastName if name/fullName absent)
 *   lastName      – last name
 *   fullName      – full name alias for name
 *   phone         – Israeli phone number
 *   email         – email address
 *   source        – lead source label (e.g. "website", "all-dog"). Defaults to "website"
 *   notes         – free-text message / form content
 *   petName       – pet's name (appended to notes)
 *   petBreed      – pet's breed (appended to notes)
 *   breed         – alias for petBreed
 *   city          – city (appended to notes)
 *   service       – requested service (appended to notes)
 *   businessId    – target business ID (falls back to WEBHOOK_BUSINESS_ID env var)
 *   timestamp     – ISO timestamp from the source (ignored, for logging only)
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

  // Resolve name: prefer explicit name/fullName, fall back to firstName + lastName
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const name =
    str(body.name) ||
    str(body.fullName) ||
    [firstName, lastName].filter(Boolean).join(" ");

  const phone = str(body.phone) || undefined;
  const email = str(body.email) || undefined;
  const source = str(body.source) || "website";

  // businessId: body first, then env fallback
  const businessId =
    str(body.businessId) || process.env.WEBHOOK_BUSINESS_ID || undefined;

  const petName = str(body.petName) || undefined;
  // Accept both petBreed and breed
  const petBreed = str(body.petBreed) || str(body.breed) || undefined;
  const city = str(body.city) || undefined;
  const service = str(body.service) || undefined;
  const rawNotes = str(body.notes) || undefined;

  if (!name && !phone) {
    return NextResponse.json(
      { error: "At least one of: name, fullName, firstName, phone is required" },
      { status: 400 }
    );
  }

  if (!businessId) {
    return NextResponse.json(
      { error: "businessId is required (body or WEBHOOK_BUSINESS_ID env var)" },
      { status: 400 }
    );
  }

  // Build notes — include all extra context
  const notesParts: string[] = [];
  if (rawNotes) notesParts.push(rawNotes);
  if (city) notesParts.push(`עיר: ${city}`);
  if (service) notesParts.push(`שירות מבוקש: ${service}`);
  if (petName) notesParts.push(`שם כלב: ${petName}`);
  if (petBreed) notesParts.push(`גזע: ${petBreed}`);
  const notes = notesParts.length > 0 ? notesParts.join("\n") : undefined;

  // ── Create lead ─────────────────────────────────────────────────────────────
  try {
    // Find the first stage for this business (sortOrder 0 = "ליד חדש")
    const firstStage = await prisma.leadStage.findFirst({
      where: { businessId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: name || phone || "ליד מהאתר",
        phone: phone || undefined,
        email: email || undefined,
        source,
        stage: firstStage?.id ?? "new",
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
