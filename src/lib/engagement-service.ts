/**
 * engagement-service.ts
 * Triggers in-app Notifications based on user behaviour milestones.
 * Call these server-side from API routes after successful mutations.
 */

import prisma from "@/lib/prisma";

// ─── Core helper ──────────────────────────────────────────────────────────────

/**
 * Notify the owner(s) of a business.
 * Looks up BusinessUser rows with role='owner', creates a Notification for each.
 */
export async function notifyBusinessOwners(
  businessId: string,
  title: string,
  message: string,
  actionUrl?: string
): Promise<void> {
  try {
    const owners = await prisma.businessUser.findMany({
      where: { businessId, role: "owner" },
      select: { userId: true },
    });
    if (owners.length === 0) return;

    await prisma.notification.createMany({
      data: owners.map((o) => ({
        userId: o.userId,
        title,
        message,
        actionUrl: actionUrl ?? null,
      })),
      skipDuplicates: true,
    });
  } catch {
    // fire-and-forget — never block the caller
  }
}

// ─── Milestone triggers ───────────────────────────────────────────────────────

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

    // Milestone: 5 customers
    const count2 = await prisma.customer.count({ where: { businessId } });
    if (count2 === 5) {
      await prisma.notification.create({
        data: {
          userId,
          title: "5 לקוחות! 🚀",
          message: "הגעת ל-5 לקוחות. הפלטפורמה עובדת בשבילך!",
          actionUrl: "/customers",
        },
      });
    }
  } catch {
    // never block the caller — fire and forget
  }
}

/**
 * Called after a new online booking is created (public booking widget).
 * Notifies all business owners.
 */
export async function notifyNewBooking(
  businessId: string,
  customerName: string,
  serviceName: string,
  bookingId: string
): Promise<void> {
  await notifyBusinessOwners(
    businessId,
    `הזמנה חדשה מ-${customerName} 📅`,
    `הזמנה אונליין חדשה לשירות "${serviceName}" ממתינה לאישור.`,
    `/bookings`
  );
}

/**
 * Called after a payment is recorded.
 * Notifies the user who recorded it (not all owners — already saw it).
 */
export async function notifyPaymentReceived(
  userId: string,
  businessId: string,
  amount: number,
  customerName: string
): Promise<void> {
  try {
    // Check if this is the first payment ever for the business
    const count = await prisma.payment.count({ where: { businessId } });
    if (count === 1) {
      await prisma.notification.create({
        data: {
          userId,
          title: "התשלום הראשון התקבל! 💰",
          message: `קיבלת ₪${amount} מ-${customerName}. ברוך הבא לניהול פיננסי מסודר!`,
          actionUrl: "/payments",
        },
      });
    }
  } catch {
    // fire-and-forget
  }
}
