/**
 * Owner security alerts for sensitive actions (ניהול ובקרה → התראות אבטחה).
 * Called by logActivity() for every row that has a businessId.
 *
 * Decision logic is pure and lives in ./security-alert-rules.ts
 * (createSecurityAlertDispatcher). This file only wires the I/O:
 * prisma reads, Resend email (lazy client, skipped without RESEND_API_KEY),
 * best-effort WhatsApp free-form to Business.phone.
 *
 * Non-sensitive actions return before any DB query (candidateRulesForAction()).
 * Rate limit: 20 alerts / business / hour, in-memory per serverless instance.
 * Never throws.
 */
import type { ActivityLog } from "@prisma/client";
import { Resend } from "resend";
import prisma from "./prisma";
import { hasFeatureWithOverrides } from "./feature-flags";
import { isSubscriptionLapsed } from "./subscription-access";
import {
  createAlertRateLimiter,
  createSecurityAlertDispatcher,
  type SecurityAlertDeps,
} from "./security-alert-rules";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

function parseOverrides(raw: unknown): Record<string, boolean> | null {
  try {
    if (!raw) return null;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v && typeof v === "object" ? (v as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

/** Effective-tier check for `staff_management` (lapsed subscription → free). */
export async function businessHasSecurityAlertsTier(businessId: string): Promise<boolean> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { tier: true, featureOverrides: true, subscriptionEndsAt: true, subscriptionStatus: true, cardcomRecurringId: true },
  });
  if (!b) return false;
  return tierAllows(b);
}

function tierAllows(b: {
  tier: string | null;
  featureOverrides: unknown;
  subscriptionEndsAt: Date | null;
  subscriptionStatus: string | null;
  cardcomRecurringId: string | null;
}): boolean {
  const lapsed = isSubscriptionLapsed({
    subscriptionEndsAt: b.subscriptionEndsAt,
    subscriptionStatus: b.subscriptionStatus,
    cardcomRecurringId: b.cardcomRecurringId,
  });
  return hasFeatureWithOverrides(lapsed ? "free" : b.tier, "staff_management", parseOverrides(b.featureOverrides));
}

const limiter = createAlertRateLimiter();

const deps: SecurityAlertDeps = {
  async loadBusiness(businessId) {
    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true, phone: true, securityAlertPrefs: true,
        tier: true, featureOverrides: true, subscriptionEndsAt: true, subscriptionStatus: true, cardcomRecurringId: true,
      },
    });
    if (!b) return null;
    return { name: b.name, phone: b.phone, prefsRaw: b.securityAlertPrefs, tierAllowed: tierAllows(b) };
  },
  async isOwner(businessId, userId) {
    const m = await prisma.businessUser.findFirst({
      where: { businessId, userId, role: "owner" },
      select: { id: true },
    });
    return !!m;
  },
  async countRecentDeletes(businessId, userId, since, until) {
    return prisma.activityLog.count({
      where: {
        businessId, userId,
        action: { startsWith: "DELETE_" },
        createdAt: { gt: since, lte: until },
      },
    });
  },
  async priorLoginDevices(businessId, userId, since, before, excludeId) {
    const rows = await prisma.activityLog.findMany({
      where: {
        businessId, userId, action: "LOGIN",
        createdAt: { gte: since, lt: before },
        id: { not: excludeId },
        entityLabel: { not: null },
      },
      distinct: ["entityLabel"],
      select: { entityLabel: true },
      take: 50,
    });
    return rows.map((r) => r.entityLabel);
  },
  async ownerEmails(businessId) {
    const owners = await prisma.businessUser.findMany({
      where: { businessId, role: "owner", isActive: true, user: { isActive: true } },
      select: { user: { select: { email: true } } },
    });
    return [...new Set(owners.map((o) => o.user.email).filter(Boolean))];
  },
  async sendEmail(to, subject, html) {
    const resend = getResend();
    if (!resend) return; // email not configured — skip silently
    // One message per owner — co-owners don't see each other's addresses.
    await Promise.all(
      to.map(async (addr) => {
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM || "Petra <noreply@petra-app.com>",
          to: addr,
          subject,
          html,
        });
        if (error) console.error("[security-alerts] Resend error:", error.message);
      })
    );
  },
  async sendWhatsApp(businessId, phone, text) {
    const [{ sendWhatsAppMessage }, { toWhatsAppPhone }] = await Promise.all([
      import("./whatsapp"),
      import("./utils"),
    ]);
    const to = toWhatsAppPhone(phone);
    if (!to) return;
    const res = await sendWhatsAppMessage({ to, body: text, businessId, context: "security_alert" });
    if (!res.success) console.error("[security-alerts] WhatsApp send failed:", res.error);
  },
  rateLimit: (businessId) => limiter.take(businessId),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://petra-app.com",
};

const dispatch = createSecurityAlertDispatcher(deps);

export async function onActivityLogged(entry: ActivityLog): Promise<void> {
  try {
    await dispatch(entry);
  } catch {
    // dispatch never throws; belt and braces
  }
}
