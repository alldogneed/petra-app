/**
 * Shared lead stage utilities.
 * Ensures every business always has default pipeline stages,
 * so auto-created leads (webhook, booking form) always land in "ליד חדש".
 */

import prisma from "./prisma";

export const DEFAULT_LEAD_STAGES = [
  { name: "ליד חדש",        color: "#94A3B8", sortOrder: 0, isWon: false, isLost: false },
  { name: "יצירת קשר",      color: "#6366F1", sortOrder: 1, isWon: false, isLost: false },
  { name: "ייעוץ ראשוני",   color: "#F59E0B", sortOrder: 2, isWon: false, isLost: false },
  { name: "הצעת מחיר",      color: "#3B82F6", sortOrder: 3, isWon: false, isLost: false },
  { name: "ממתין להחלטה",  color: "#8B5CF6", sortOrder: 4, isWon: false, isLost: false },
  { name: "לקוח",           color: "#10B981", sortOrder: 5, isWon: true,  isLost: false },
  { name: "לא רלוונטי",    color: "#EF4444", sortOrder: 6, isWon: false, isLost: true  },
];

/** Creates default stages if the business has none. Idempotent. */
export async function ensureDefaultStages(businessId: string): Promise<void> {
  const count = await prisma.leadStage.count({ where: { businessId } });
  if (count === 0) {
    await prisma.leadStage.createMany({
      data: DEFAULT_LEAD_STAGES.map((s) => ({ ...s, businessId })),
    });
  }
}

/**
 * Returns the ID of the first active (non-won, non-lost) stage for a business.
 * Auto-creates default stages if none exist.
 * Always returns a valid stage ID — never null.
 */
export async function getFirstLeadStageId(businessId: string): Promise<string> {
  await ensureDefaultStages(businessId);

  const stage = await prisma.leadStage.findFirst({
    where: { businessId, isWon: false, isLost: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  // Safety fallback — should never happen after ensureDefaultStages
  if (!stage) {
    const any = await prisma.leadStage.findFirst({
      where: { businessId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (!any) throw new Error(`No lead stages found for business ${businessId}`);
    return any.id;
  }

  return stage.id;
}
