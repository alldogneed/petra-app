/**
 * Business branding (docs/verticals phase 3). Reads the existing BrandingSettings row
 * (no new table) + Business.name / Business.logo, resolved by `resolveBranding()`:
 * "generic" → the business's own brand, "dogs" → Petra (unchanged).
 */
import prisma from "@/lib/prisma";
import { resolveBranding, type ResolvedBranding } from "@/lib/verticals/branding";
import { updateBranding } from "./online-classes";
import { ServiceError } from "./types";

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
