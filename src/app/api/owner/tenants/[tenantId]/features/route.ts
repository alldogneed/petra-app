export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import type { FeatureKey } from "@/lib/feature-flags";

// All valid feature keys — used to sanitise the incoming payload
const VALID_FEATURE_KEYS: FeatureKey[] = [
  "leads",
  "boarding",
  "training",
  "training_groups",
  "automations",
  "custom_messages",
  "service_dogs",
  "groomer_portfolio",
  "invoicing",
  "staff_management",
  "excel_export",
  "gcal_sync",
  "payments",
  "orders",
  "pricing",
  "pets_advanced",
  "scheduled_messages",
];

/**
 * PATCH /api/owner/tenants/:tenantId/features
 *
 * Body: { overrides: Record<FeatureKey, boolean | null> }
 *   - true  → force-enable regardless of tier
 *   - false → force-disable regardless of tier
 *   - null  → remove override (revert to tier default)
 *
 * Auth: requires platform.settings.write (owner / super_admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const authResult = await requirePlatformPermission(request, "platform.settings.write");
  if (isGuardError(authResult)) return authResult;

  const { tenantId } = params;
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.overrides !== "object") {
    return NextResponse.json({ error: "Invalid body — expected { overrides: {...} }" }, { status: 400 });
  }

  // Load current overrides
  const business = await prisma.business.findUnique({
    where: { id: tenantId },
    select: { id: true, featureOverrides: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Parse existing overrides
  let current: Record<string, boolean> = {};
  try {
    const raw = business.featureOverrides;
    if (raw) {
      current = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, boolean>);
    }
  } catch { /* start fresh */ }

  // Apply incoming changes — only accept valid feature keys
  const incoming = body.overrides as Record<string, boolean | null>;
  for (const key of VALID_FEATURE_KEYS) {
    if (key in incoming) {
      const val = incoming[key];
      if (val === null || val === undefined) {
        delete current[key]; // remove override → revert to tier default
      } else if (typeof val === "boolean") {
        current[key] = val;
      }
    }
  }

  const updated = await prisma.business.update({
    where: { id: tenantId },
    data: { featureOverrides: current },
    select: { id: true, featureOverrides: true },
  });

  return NextResponse.json({ ok: true, featureOverrides: updated.featureOverrides });
}

/**
 * GET /api/owner/tenants/:tenantId/features
 * Returns current feature overrides for the tenant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const authResult = await requirePlatformPermission(request, "platform.settings.write");
  if (isGuardError(authResult)) return authResult;

  const { tenantId } = params;
  const business = await prisma.business.findUnique({
    where: { id: tenantId },
    select: { tier: true, featureOverrides: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    tier: business.tier,
    featureOverrides: business.featureOverrides ?? {},
  });
}
