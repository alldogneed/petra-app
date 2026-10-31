/**
 * Business branding (docs/verticals phase 3). Reads the existing BrandingSettings row
 * (no new table) + Business.name / Business.logo, resolved by `resolveBranding()`:
 * "generic" → the business's own brand, "dogs" → Petra (unchanged).
 */
import prisma from "@/lib/prisma";
import { resolveBranding, type ResolvedBranding } from "@/lib/verticals/branding";
import { updateBranding } from "./online-classes";
import { ServiceError } from "./types";
import { isValidCustomSubdomain } from "@/lib/verticals/tenant-host";

const BRANDING_SELECT = {
  name: true,
  logo: true,
  vertical: true,
  brandingSettings: { select: { logoUrl: true, primaryColor: true, secondaryColor: true, senderName: true } },
} as const;

type BrandingRow = { name: string; logo: string | null; vertical: string; brandingSettings: { logoUrl: string | null; primaryColor: string; secondaryColor: string | null; senderName: string | null } | null };

function fromRow(row: BrandingRow | null): ResolvedBranding {
  return resolveBranding({
    vertical: row?.vertical,
    businessName: row?.name,
    businessLogo: row?.logo,
    branding: row?.brandingSettings,
  });
}

export async function getBusinessBranding(businessId: string): Promise<ResolvedBranding> {
  const row = await prisma.business.findUnique({ where: { id: businessId }, select: BRANDING_SELECT });
  return fromRow(row);
}

export async function getBusinessBrandingBySlug(slug: string): Promise<ResolvedBranding> {
  const row = await prisma.business.findUnique({ where: { slug }, select: BRANDING_SELECT });
  return fromRow(row);
}

/** Raw editable fields for Settings → פרטי העסק → מיתוג. */
export async function getBrandingSettingsForEdit(businessId: string) {
  const row = await prisma.business.findUnique({ where: { id: businessId }, select: BRANDING_SELECT });
  if (!row) throw new ServiceError("Business not found", "NOT_FOUND");
  return {
    vertical: row.vertical,
    logoUrl: row.brandingSettings?.logoUrl ?? null,
    primaryColor: row.brandingSettings?.primaryColor ?? null,
    secondaryColor: row.brandingSettings?.secondaryColor ?? null,
    senderName: row.brandingSettings?.senderName ?? null,
    businessLogo: row.logo,
    resolved: fromRow(row),
  };
}

export interface BrandingEditInput {
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string | null;
  senderName?: string | null;
}

/** Same validation + upsert as the portal branding (hex colours, safe URL). */
export async function updateBusinessBranding(businessId: string, input: BrandingEditInput) {
  if (input.senderName != null && input.senderName.length > 100) {
    throw new ServiceError("שם השולח ארוך מדי (מקסימום 100 תווים)", "VALIDATION");
  }
  await updateBranding(businessId, input);
  return getBrandingSettingsForEdit(businessId);
}

/**
 * Phase 4: a "generic" business picks its own Latin address (`{value}.petra.app`). It IS
 * the booking slug, so `/book/{old}` stops working — the settings card asks first.
 */
export async function updateBusinessSubdomain(businessId: string, value: string) {
  const slug = value.trim().toLowerCase();
  if (!isValidCustomSubdomain(slug)) {
    throw new ServiceError("כתובת לא תקינה — אותיות באנגלית, ספרות ומקף, לפחות 3 תווים", "VALIDATION");
  }
  const taken = await prisma.business.findFirst({ where: { slug, NOT: { id: businessId } }, select: { id: true } });
  if (taken) throw new ServiceError("הכתובת תפוסה — נסו כתובת אחרת", "CONFLICT");
  try {
    await prisma.business.update({ where: { id: businessId }, data: { slug } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") throw new ServiceError("הכתובת תפוסה — נסו כתובת אחרת", "CONFLICT");
    throw e;
  }
  return slug;
}
