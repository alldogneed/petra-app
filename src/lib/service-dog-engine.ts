// ─── Service Dog Business Logic Engine ───

import prisma from "@/lib/prisma";
import {
  PHASE_MEDICAL_PROTOCOLS,
  MEDICAL_PROTOCOL_MAP,
  COMPLIANCE_EVENT_MAP,
  COMPLIANCE_NOTIFICATION_HOURS,
  type MedicalComplianceStatus,
  type ADITrainingProgress,
} from "./service-dogs";

// ─── Health → Protocol Sync Map ───────────────────────────────────────────────
//
// Each entry defines how a DogHealth record informs a protocol:
//   completedFrom — if this DogHealth field has a date, the protocol is COMPLETED
//                   (used for primary / one-time vaccinations)
//   dueDateFn     — computes the protocol's next dueDate from DogHealth
//                   (used for booster / recurring protocols)
//
// Both can coexist: e.g. BORDETELLA is "COMPLETED on bordatellaDate,
// and the next one is DUE in 365 days".

type HealthFields = {
  rabiesLastDate?: Date | null;
  rabiesValidUntil?: Date | null;
  dhppLastDate?: Date | null;
  bordatellaDate?: Date | null;
  dewormingLastDate?: Date | null;
  dewormingValidUntil?: Date | null;
  parkWormValidUntil?: Date | null;
  fleaTickExpiryDate?: Date | null;
};

type SyncRule = {
  completedFrom?: keyof HealthFields;
  dueDateFn?: (h: HealthFields) => Date | null;
};

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

export const PROTOCOL_HEALTH_SYNC_MAP: Record<string, SyncRule> = {
  // ── Rabies ────────────────────────────────────────────────────────────────
  RABIES_PRIMARY: {
    completedFrom: "rabiesLastDate",
  },
  RABIES_BOOSTER: {
    // Booster is due when current vaccination expires
    dueDateFn: (h) => (h.rabiesValidUntil ? new Date(h.rabiesValidUntil) : null),
  },

  // ── DHPP ──────────────────────────────────────────────────────────────────
  DHPP_PRIMARY: {
    completedFrom: "dhppLastDate",
  },
  DHPP: {
    // Annual renewal
    dueDateFn: (h) => (h.dhppLastDate ? addDays(new Date(h.dhppLastDate), 365) : null),
  },
  DHPP_BOOSTER: {
    dueDateFn: (h) => (h.dhppLastDate ? addDays(new Date(h.dhppLastDate), 365) : null),
  },

  // ── Bordetella ────────────────────────────────────────────────────────────
  BORDETELLA: {
    completedFrom: "bordatellaDate",
    dueDateFn: (h) => (h.bordatellaDate ? addDays(new Date(h.bordatellaDate), 365) : null),
  },

  // ── Parasites ─────────────────────────────────────────────────────────────
  DEWORMING: {
    dueDateFn: (h) => {
      if (h.dewormingValidUntil) return new Date(h.dewormingValidUntil);
      return h.dewormingLastDate ? addDays(new Date(h.dewormingLastDate), 180) : null;
    },
  },
  PARK_WORM: {
    dueDateFn: (h) => (h.parkWormValidUntil ? new Date(h.parkWormValidUntil) : null),
  },
  FLEA_TICK: {
    dueDateFn: (h) => (h.fleaTickExpiryDate ? new Date(h.fleaTickExpiryDate) : null),
  },
};

// ─── Medical Rules Engine ───

/**
 * Get the list of protocol definitions required for a given phase.
 */
export function getRequiredProtocolsForPhase(phase: string) {
  const keys = PHASE_MEDICAL_PROTOCOLS[phase] || [];
  return keys
    .map((key) => MEDICAL_PROTOCOL_MAP[key])
    .filter(Boolean);
}

/**
 * Compute compliance status from a list of medical protocol records.
 */
export function computeMedicalComplianceStatus(
  protocols: Array<{ status: string }>,
  _currentPhase: string
): MedicalComplianceStatus {
  const total = protocols.length;
  if (total === 0) {
    return {
      totalProtocols: 0,
      completedCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      compliancePercent: 100,
      status: "green",
    };
  }

  const completedCount = protocols.filter((p) => p.status === "COMPLETED" || p.status === "WAIVED").length;
  const overdueCount = protocols.filter((p) => p.status === "OVERDUE").length;
  const pendingCount = total - completedCount - overdueCount;
  const compliancePercent = Math.round((completedCount / total) * 100);

  let status: "green" | "amber" | "red" = "green";
  if (overdueCount > 0) status = "red";
  else if (pendingCount > 0 && compliancePercent < 80) status = "amber";

  return {
    totalProtocols: total,
    completedCount,
    pendingCount,
    overdueCount,
    compliancePercent,
    status,
  };
}

/**
 * Get new protocol keys needed when transitioning to a new phase.
 * Skips protocols that are already completed in previous phases.
 */
export function diffProtocolsForPhaseChange(
  newPhase: string,
  existingCompletedKeys: string[]
): Array<{ key: string; label: string; category: string }> {
  const required = getRequiredProtocolsForPhase(newPhase);
  const completedSet = new Set(existingCompletedKeys);
  return required.filter((p) => !completedSet.has(p.key));
}

// ─── ADI Hour Calculator ───

/**
 * Compute ADI training progress from profile fields.
 */
export function computeADIProgress(
  trainingStartDate: Date | null,
  totalHours: number,
  targetHours: number,
  targetMonths: number
): ADITrainingProgress {
  const now = new Date();
  let monthsElapsed = 0;
  if (trainingStartDate) {
    const diffMs = now.getTime() - trainingStartDate.getTime();
    monthsElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
  }

  const percentComplete = targetHours > 0 ? Math.round((totalHours / targetHours) * 100) : 0;
  const hoursRemaining = Math.max(0, targetHours - totalHours);
  const monthsRemaining = Math.max(0, targetMonths - monthsElapsed);

  const isReadyForCertification =
    totalHours >= targetHours && monthsElapsed >= targetMonths;

  return {
    totalHours,
    targetHours,
    percentComplete: Math.min(percentComplete, 100),
    monthsElapsed,
    targetMonths,
    monthsRemaining,
    hoursRemaining,
    isReadyForCertification,
  };
}

/**
 * Accumulate training hours from a new session.
 * Only COMPLETED sessions count toward the total.
 */
export function accumulateTrainingHours(
  currentTotal: number,
  newSessionMinutes: number,
  status: string
): number {
  if (status !== "COMPLETED") return currentTotal;
  return currentTotal + newSessionMinutes / 60;
}

// ─── Compliance Manager ───

/**
 * Create a compliance event and set the 48-hour notification deadline.
 * Also updates the service dog profile's isGovReportPending flag.
 */
export async function createComplianceEvent(
  serviceDogId: string,
  businessId: string,
  eventType: string,
  description: string,
  options?: { placementId?: string; triggeredByUserId?: string }
) {
  const eventDef = COMPLIANCE_EVENT_MAP[eventType];
  const notificationRequired = eventDef?.requiresGovReport ?? false;
  const now = new Date();
  const notificationDue = notificationRequired
    ? new Date(now.getTime() + COMPLIANCE_NOTIFICATION_HOURS * 60 * 60 * 1000)
    : null;

  const event = await prisma.serviceDogComplianceEvent.create({
    data: {
      serviceDogId,
      businessId,
      eventType,
      eventDescription: description,
      notificationRequired,
      notificationDue,
      notificationStatus: notificationRequired ? "PENDING" : "NOT_REQUIRED",
      placementId: options?.placementId ?? null,
      triggeredByUserId: options?.triggeredByUserId ?? null,
      eventAt: now,
    },
  });

  // Update profile flag
  if (notificationRequired) {
    await prisma.serviceDogProfile.update({
      where: { id: serviceDogId },
      data: { isGovReportPending: true, govReportDue: notificationDue },
    });
  }

  return event;
}

/**
 * Get all overdue compliance events for a business.
 */
export async function getOverdueComplianceEvents(businessId: string) {
  return prisma.serviceDogComplianceEvent.findMany({
    where: {
      businessId,
      notificationStatus: "PENDING",
      notificationDue: { lt: new Date() },
    },
    include: {
      serviceDog: { include: { pet: true } },
      placement: true,
    },
    orderBy: { notificationDue: "asc" },
  });
}

/**
 * Seed medical protocols for a service dog based on their current phase.
 * If health data is provided, auto-completes known protocols and sets
 * calculated due dates for recurring ones.
 */
export async function seedMedicalProtocols(
  serviceDogId: string,
  businessId: string,
  phase: string,
  health?: HealthFields | null
) {
  const protocols = getRequiredProtocolsForPhase(phase);
  if (protocols.length === 0) return [];

  const now = new Date();

  const data = protocols.map((p) => {
    const rule = health ? PROTOCOL_HEALTH_SYNC_MAP[p.key] : null;

    // Check if health data proves this protocol was already done
    const completedDate = rule?.completedFrom && health?.[rule.completedFrom]
      ? new Date(health[rule.completedFrom] as Date)
      : null;

    // Compute due date from health, or leave null for manual entry
    const dueDate = rule?.dueDateFn && health ? rule.dueDateFn(health) : null;

    const isOverdue = dueDate && dueDate < now && !completedDate;

    return {
      serviceDogId,
      businessId,
      phase,
      protocolKey: p.key,
      protocolLabel: p.label,
      category: p.category,
      status: completedDate ? "COMPLETED" : isOverdue ? "OVERDUE" : "PENDING",
      completedDate: completedDate ?? undefined,
      dueDate: dueDate ?? undefined,
    };
  });

  await prisma.serviceDogMedicalProtocol.createMany({ data });
  return data;
}

/**
 * Sync medical protocols for an existing service dog against its pet's health record.
 * - Marks primary protocols COMPLETED where health data confirms completion
 * - Updates dueDate on PENDING/OVERDUE protocols using health-derived calculations
 * Returns: { completed: number; dueDatesSet: number }
 */
export async function syncProtocolsFromHealth(
  serviceDogId: string,
  health: HealthFields
): Promise<{ completed: number; dueDatesSet: number }> {
  const protocols = await prisma.serviceDogMedicalProtocol.findMany({
    where: { serviceDogId },
  });

  let completed = 0;
  let dueDatesSet = 0;
  const now = new Date();

  for (const proto of protocols) {
    const rule = PROTOCOL_HEALTH_SYNC_MAP[proto.protocolKey];
    if (!rule) continue;

    const updates: Record<string, unknown> = {};

    // Mark as COMPLETED if health record confirms it was done
    if (rule.completedFrom && health[rule.completedFrom] && proto.status !== "COMPLETED" && proto.status !== "WAIVED") {
      updates.status = "COMPLETED";
      updates.completedDate = new Date(health[rule.completedFrom] as Date);
      completed++;
    }

    // Set or update dueDate from health calculation (only if still pending)
    if (rule.dueDateFn && proto.status !== "COMPLETED" && proto.status !== "WAIVED") {
      const dueDate = rule.dueDateFn(health);
      if (dueDate && dueDate.getTime() !== proto.dueDate?.getTime()) {
        updates.dueDate = dueDate;
        updates.status = dueDate < now ? "OVERDUE" : "PENDING";
        dueDatesSet++;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.serviceDogMedicalProtocol.update({
        where: { id: proto.id },
        data: updates,
      });
    }
  }

  return { completed, dueDatesSet };
}
