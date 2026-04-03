/**
 * Creates a lead in Or Rabinovich's (alldog) Petra business account
 * whenever a prospective customer fills in their billing details on the checkout page.
 * Fire-and-forget — never throws; logs errors silently.
 */
import prisma from "@/lib/prisma";
import { getFirstLeadStageId } from "@/lib/lead-stages";

const OWNER_EMAIL = "alldogneed@gmail.com";

const TIER_LABELS: Record<string, string> = {
  basic: "מסלול בייסיק (₪99/חודש)",
  pro: "מסלול פרו (₪199/חודש)",
};

interface OwnerLeadData {
  name: string;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  tier: string;
  businessType?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  billingEmail?: string | null;
}

export async function createOwnerLead(data: OwnerLeadData): Promise<void> {
  try {
    // Find Or's platform user
    const ownerUser = await prisma.platformUser.findUnique({
      where: { email: OWNER_EMAIL },
      select: { id: true },
    });
    if (!ownerUser) return;

    // Find Or's primary business
    const membership = await prisma.businessUser.findFirst({
      where: { userId: ownerUser.id },
      select: { businessId: true },
    });
    if (!membership) return;

    const businessId = membership.businessId;

    // Get the first active lead stage (auto-creates defaults if needed)
    const stageId = await getFirstLeadStageId(businessId);

    // Build notes from billing details
    const noteLines: string[] = [];
    if (data.businessName) noteLines.push(`שם עסק: ${data.businessName}`);
    if (data.businessType) noteLines.push(`סוג עוסק: ${data.businessType}`);
    if (data.vatNumber)    noteLines.push(`ח.פ / ע.מ: ${data.vatNumber}`);
    if (data.address)      noteLines.push(`כתובת: ${data.address}`);
    if (data.billingEmail && data.billingEmail !== data.email)
      noteLines.push(`אימייל חשבונית: ${data.billingEmail}`);

    await prisma.lead.create({
      data: {
        businessId,
        name: data.name,
        email: data.billingEmail ?? data.email ?? null,
        phone: data.phone ?? null,
        requestedService: TIER_LABELS[data.tier] ?? data.tier,
        source: "checkout",
        stage: stageId,
        notes: noteLines.length > 0 ? noteLines.join("\n") : null,
      },
    });
  } catch (err) {
    console.error("createOwnerLead: failed silently:", err);
  }
}
