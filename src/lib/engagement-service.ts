/**
 * engagement-service.ts
 * Triggers in-app Notifications based on user behaviour milestones.
 * Call these server-side from API routes after successful mutations.
 */

import prisma from "@/lib/prisma";

/**
 * Called after a customer is created.
 * If this is the very first customer for the business, notify the owner.
 */
export async function checkFirstCustomer(
  userId: string,
  businessId: string
): Promise<void> {
  try {
    const count = await prisma.customer.count({ where: { businessId } });
    if (count !== 1) return; // not the first

    await prisma.notification.create({
      data: {
        userId,
        title: "כל הכבוד! 🎉",
        message:
          "הוספת את הלקוח הראשון שלך! עכשיו תוכל לשלוח לו בקשת תשלום, לקבוע תור ולנהל את כל הפעילות בקלות.",
        actionUrl: "/payment-request",
      },
    });
  } catch {
    // never block the caller — fire and forget
  }
}
