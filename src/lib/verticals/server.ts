/**
 * Server-side vertical lookups. businessId always comes from the session (rule #10).
 */
import { prisma } from "@/lib/prisma";
import { normalizeVertical, type Vertical } from "./index";

/** The business's vertical; unknown business / missing column value → "dogs". */
export async function getBusinessVertical(businessId: string | null | undefined): Promise<Vertical> {
  if (!businessId) return normalizeVertical(null);
  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { vertical: true } });
  return normalizeVertical(biz?.vertical);
}

export async function isGenericBusiness(businessId: string | null | undefined): Promise<boolean> {
  return (await getBusinessVertical(businessId)) === "generic";
}
