/**
 * Core onboarding service.
 * Creates a PlatformUser + Business + BusinessUser (owner) in a single transaction,
 * then sends a welcome email with temporary credentials.
 *
 * Designed to be reusable by:
 * - Owner panel manual onboarding (POST /api/owner/onboard-user)
 * - Future self-registration after payment (POST /api/auth/register)
 */

import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail } from "./email";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface OnboardUserInput {
  email: string;
  name: string;
  phone?: string;
  businessName: string;
  businessRegNumber?: string;
  tier?: "basic" | "pro" | "enterprise";
}

export interface OnboardUserResult {
  user: { id: string; email: string; name: string };
  business: { id: string; name: string; slug: string | null };
  membership: { id: string; role: string };
  emailSent: boolean;
  tempPassword: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure random password (base64url, 12 chars). */
export function generateSecurePassword(length = 12): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

/** Generate a URL-safe slug from a business name (supports Hebrew). */
export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u0590-\u05FF-]/g, "") // keep Hebrew, alphanumeric, spaces, hyphens
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") // trim leading/trailing hyphens
    .slice(0, 60);
}

// ─── Main Function ──────────────────────────────────────────────────────────────

export async function onboardUser(input: OnboardUserInput): Promise<OnboardUserResult> {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  const businessName = input.businessName.trim();

  // Generate temporary password
  const tempPassword = generateSecurePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Generate unique slug
  let slug = generateSlug(businessName);
  if (slug) {
    const existing = await prisma.business.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${crypto.randomBytes(3).toString("hex")}`;
    }
  } else {
    // Fallback for names that produce empty slugs
    slug = crypto.randomBytes(6).toString("hex");
  }

  // Sequential operations (no interactive $transaction — Supabase PgBouncer incompatible)
  const user = await prisma.platformUser.create({
    data: {
      email,
      name,
      passwordHash,
      authProvider: "local",
      isActive: true,
      platformRole: null, // regular user, not platform admin
    },
  });

  const business = await prisma.business.create({
    data: {
      name: businessName,
      email,
      phone: input.phone?.trim() || null,
      businessRegNumber: input.businessRegNumber?.trim() || null,
      slug,
      tier: input.tier ?? "basic",
      status: "active",
    },
  });

  const membership = await prisma.businessUser.create({
    data: {
      businessId: business.id,
      userId: user.id,
      role: "owner",
      isActive: true,
    },
  });

  const result = { user, business, membership };

  // Send welcome email OUTSIDE the transaction (non-fatal)
  let emailSent = false;
  try {
    await sendWelcomeEmail({
      to: email,
      name,
      tempPassword,
      businessName,
    });
    emailSent = true;
  } catch (err) {
    console.error("[onboard] Failed to send welcome email:", err);
  }

  return {
    user: { id: result.user.id, email: result.user.email, name: result.user.name },
    business: { id: result.business.id, name: result.business.name, slug: result.business.slug },
    membership: { id: result.membership.id, role: result.membership.role },
    emailSent,
    tempPassword,
  };
}
