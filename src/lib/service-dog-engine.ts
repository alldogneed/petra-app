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
 */
export async function seedMedicalProtocols(
  serviceDogId: string,
  businessId: string,
  phase: string
) {
  const protocols = getRequiredProtocolsForPhase(phase);
  if (protocols.length === 0) return [];

  const data = protocols.map((p) => ({
    serviceDogId,
    businessId,
    phase,
    protocolKey: p.key,
    protocolLabel: p.label,
    category: p.category,
    status: "PENDING",
  }));

  await prisma.serviceDogMedicalProtocol.createMany({ data });
  return data;
}
