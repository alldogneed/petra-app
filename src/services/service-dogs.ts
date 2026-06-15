/**
 * Service dogs service — dogs, placements, recipients, compliance.
 *
 * All functions are business-scoped (businessId first param).
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Extracted from:
 *   /api/service-dogs/*, /api/service-placements/*, /api/service-recipients/*
 */

import type { DbClient } from "./supabase";
import { ServiceError } from "./types";
import {
  computeMedicalComplianceStatus,
  computeADIProgress,
  diffProtocolsForPhaseChange,
  createComplianceEvent,
  seedMedicalProtocols,
} from "@/lib/service-dog-engine";
import { SERVICE_DOG_PHASES, SERVICE_DOG_TYPES, LOCATION_OPTIONS } from "@/lib/service-dogs";
import { sanitizeName } from "@/lib/validation";

export { ServiceError };
export type { DbClient };

const VALID_PHASES: string[] = SERVICE_DOG_PHASES.map((p) => p.id);
const VALID_SERVICE_TYPES: string[] = SERVICE_DOG_TYPES.map((t) => t.id);
const VALID_LOCATIONS: string[] = LOCATION_OPTIONS.map((l) => l.id);
const VALID_TRAINING_STATUSES: string[] = ["NOT_STARTED", "IN_PROGRESS", "PENDING_CERT", "CERTIFIED", "FAILED", "ON_HOLD"];

// ─── SERVICE DOGS ───────────────────────────────────────────────────────────

export async function listServiceDogs(
  businessId: string,
  db: DbClient,
  opts: { phase?: string | null; trainingStatus?: string | null; location?: string | null } = {}
) {
  const { phase, trainingStatus, location } = opts;

  if (phase && !VALID_PHASES.includes(phase)) {
    throw new ServiceError("שלב לא חוקי", "VALIDATION");
  }
  if (trainingStatus && !VALID_TRAINING_STATUSES.includes(trainingStatus)) {
    throw new ServiceError("סטטוס אימון לא חוקי", "VALIDATION");
  }
  if (location && !VALID_LOCATIONS.includes(location)) {
    throw new ServiceError("מיקום לא חוקי", "VALIDATION");
  }

  const dogs = await db.serviceDogProfile.findMany({
    where: {
      businessId,
      ...(phase && { phase: phase as any }),
      ...(trainingStatus && { trainingStatus: trainingStatus as any }),
      ...(location && { currentLocation: location as any }),
    },
    include: {
      pet: true,
      medicalProtocols: true,
      placements: {
        where: { status: "ACTIVE" },
        include: { recipient: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return dogs.map((dog) => ({
    ...dog,
    medicalCompliance: computeMedicalComplianceStatus(dog.medicalProtocols, dog.phase),
    activePlacement: dog.placements[0]
      ? {
          id: dog.placements[0].id,
          recipientName: dog.placements[0].recipient.name,
          status: dog.placements[0].status,
        }
      : null,
    medicalProtocols: undefined,
    placements: undefined,
  }));
}

export async function getServiceDog(businessId: string, db: DbClient, id: string) {
  const dog = await db.serviceDogProfile.findFirst({
    where: { id, businessId },
    include: {
      pet: {
        include: {
          health: true,
          behavior: true,
          medications: { orderBy: { createdAt: "desc" } },
        },
      },
      medicalProtocols: { orderBy: { createdAt: "asc" } },
      trainingLogs: { orderBy: { sessionDate: "desc" }, take: 20 },
      complianceEvents: { orderBy: { eventAt: "desc" }, take: 20 },
      placements: {
        include: { recipient: true },
        orderBy: { createdAt: "desc" },
      },
      idCards: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!dog) throw new ServiceError("כלב שירות לא נמצא", "NOT_FOUND");

  const medicalCompliance = computeMedicalComplianceStatus(dog.medicalProtocols, dog.phase);
  const trainingProgress = computeADIProgress(
    dog.trainingStartDate,
    dog.trainingTotalHours,
    dog.trainingTargetHours,
    dog.trainingTargetMonths
  );

  let parsedDocuments: unknown[] = [];
  try { parsedDocuments = JSON.parse((dog.documents as string) || "[]"); } catch { parsedDocuments = []; }
  let parsedFeedingHistory: unknown[] = [];
  try { parsedFeedingHistory = JSON.parse((dog.feedingHistory as string) || "[]"); } catch { parsedFeedingHistory = []; }

  return {
    ...dog,
    documents: parsedDocuments,
    feedingHistory: parsedFeedingHistory,
    medicalCompliance,
    trainingProgress,
  };
}

export async function createServiceDog(
  businessId: string,
  db: DbClient,
  input: {
    petId?: string;
    petName?: string;
    breed?: string;
    species?: string;
    phase?: string;
    serviceType?: string;
    notes?: string;
  }
) {
  const { petId, petName, breed, species, phase, serviceType, notes } = input;

  if (!petId && !petName) {
    throw new ServiceError("נדרש לבחור חיית מחמד או להזין שם כלב", "VALIDATION");
  }
  if (phase && !VALID_PHASES.includes(phase)) {
    throw new ServiceError("שלב לא חוקי", "VALIDATION");
  }
  if (serviceType && !VALID_SERVICE_TYPES.includes(serviceType)) {
    throw new ServiceError("סוג שירות לא חוקי", "VALIDATION");
  }

  let resolvedPetId = petId;
  if (!petId && petName) {
    const newPet = await db.pet.create({
      data: {
        name: petName,
        species: species || "dog",
        breed: breed || null,
        businessId,
      },
    });
    resolvedPetId = newPet.id;
  }

  const pet = await db.pet.findFirst({
    where: {
      id: resolvedPetId,
      OR: [
        { customer: { businessId } },
        { businessId },
      ],
    },
    include: {
      health: {
        select: {
          rabiesLastDate: true,
          rabiesValidUntil: true,
          dhppLastDate: true,
          bordatellaDate: true,
          dewormingLastDate: true,
          fleaTickExpiryDate: true,
        },
      },
    },
  });

  if (!pet) throw new ServiceError("חיית מחמד לא נמצאה", "NOT_FOUND");

  const existing = await db.serviceDogProfile.findUnique({
    where: { petId: resolvedPetId },
  });
  if (existing) throw new ServiceError("לכלב זה כבר קיים פרופיל כלב שירות", "CONFLICT");

  const initialPhase = phase || "SELECTION";

  const biz = await db.business.findUnique({
    where: { id: businessId },
    select: { sdSettings: true },
  });
  const sdSettings = biz?.sdSettings as { trackHours?: boolean; defaultTargetHours?: number } | null;
  const defaultTargetHours = sdSettings?.defaultTargetHours ?? 120;

  const profile = await db.serviceDogProfile.create({
    data: {
      petId: resolvedPetId as string,
      businessId,
      phase: initialPhase,
      serviceType: serviceType || null,
      notes: notes || null,
      trainingTargetHours: defaultTargetHours,
    },
    include: { pet: true },
  });

  const existingProgram = await db.trainingProgram.findFirst({
    where: { dogId: resolvedPetId, trainingType: "SERVICE_DOG", businessId },
  });
  if (!existingProgram) {
    await db.trainingProgram.create({
      data: {
        businessId,
        dogId: resolvedPetId as string,
        customerId: pet.customerId || null,
        name: `הכשרת כלב שירות — ${pet.name}`,
        programType: "SD_FOUNDATION",
        trainingType: "SERVICE_DOG",
        status: "ACTIVE",
        startDate: new Date(),
      },
    });
  }

  await seedMedicalProtocols(profile.id, businessId, initialPhase, pet.health);

  return profile;
}

export async function updateServiceDog(
  businessId: string,
  db: DbClient,
  id: string,
  body: Record<string, unknown>
) {
  if (body.trainingTargetHours != null) {
    const v = Number(body.trainingTargetHours);
    if (!isFinite(v) || v < 1 || v > 10000) throw new ServiceError("שעות יעד לא חוקיות (1–10000)", "VALIDATION");
  }
  if (body.trainingTotalHours != null) {
    const v = Number(body.trainingTotalHours);
    if (!isFinite(v) || v < 0 || v > 100000) throw new ServiceError('סה"כ שעות לא חוקי (0–100000)', "VALIDATION");
  }
  if (body.purchasePrice != null) {
    const v = parseFloat(body.purchasePrice as string);
    if (!isFinite(v) || v < 0 || v > 9999999) throw new ServiceError("מחיר לא חוקי", "VALIDATION");
  }
  if (body.documents !== undefined) {
    let docs: unknown;
    try { docs = typeof body.documents === "string" ? JSON.parse(body.documents as string) : body.documents; } catch { docs = []; }
    if (Array.isArray(docs) && docs.length > 100) throw new ServiceError("יותר מדי מסמכים (מקסימום 100)", "VALIDATION");
  }
  if (body.trainingTests !== undefined) {
    let tests: unknown;
    try { tests = typeof body.trainingTests === "string" ? JSON.parse(body.trainingTests as string) : body.trainingTests; } catch { tests = []; }
    if (Array.isArray(tests) && tests.length > 100) throw new ServiceError("יותר מדי בחינות (מקסימום 100)", "VALIDATION");
  }
  if (body.feedingHistory !== undefined) {
    let entries: unknown;
    try { entries = typeof body.feedingHistory === "string" ? JSON.parse(body.feedingHistory as string) : body.feedingHistory; } catch { entries = []; }
    if (Array.isArray(entries) && entries.length > 500) throw new ServiceError("יותר מדי רשומות האכלה (מקסימום 500)", "VALIDATION");
  }
  if (body.dogPhoto != null && body.dogPhoto !== "") {
    try { const u = new URL(body.dogPhoto as string); if (u.protocol !== "https:") throw new Error(); } catch {
      throw new ServiceError("כתובת תמונה לא חוקית", "VALIDATION");
    }
  }

  const existing = await db.serviceDogProfile.findFirst({
    where: { id, businessId },
  });
  if (!existing) throw new ServiceError("כלב שירות לא נמצא", "NOT_FOUND");

  return db.serviceDogProfile.update({
    where: { id, businessId },
    data: {
      ...(body.serviceType !== undefined && { serviceType: body.serviceType as string }),
      ...(body.registrationNumber !== undefined && { registrationNumber: body.registrationNumber as string }),
      ...(body.certifyingBody !== undefined && { certifyingBody: body.certifyingBody as string }),
      ...(body.certificationDate !== undefined && { certificationDate: body.certificationDate ? new Date(body.certificationDate as string) : null }),
      ...(body.certificationExpiry !== undefined && { certificationExpiry: body.certificationExpiry ? new Date(body.certificationExpiry as string) : null }),
      ...(body.trainingTargetHours !== undefined && body.trainingTargetHours != null && { trainingTargetHours: Number(body.trainingTargetHours) }),
      ...(body.trainingTotalHours !== undefined && { trainingTotalHours: body.trainingTotalHours != null ? Number(body.trainingTotalHours) : 0 }),
      ...(body.trainingTargetMonths !== undefined && { trainingTargetMonths: body.trainingTargetMonths as number }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
      ...(body.documents !== undefined && { documents: typeof body.documents === "string" ? body.documents : JSON.stringify(body.documents) }),
      ...(body.trainingTests !== undefined && { trainingTests: body.trainingTests }),
      ...(body.pedigreeNumber !== undefined && { pedigreeNumber: body.pedigreeNumber as string }),
      ...(body.purchasePrice !== undefined && { purchasePrice: body.purchasePrice != null ? parseFloat(body.purchasePrice as string) : null }),
      ...(body.purchaseSource !== undefined && { purchaseSource: body.purchaseSource as string }),
      ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber as string }),
      ...(body.licenseExpiry !== undefined && { licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry as string) : null }),
      ...(body.maintenanceNotes !== undefined && { maintenanceNotes: body.maintenanceNotes as string }),
      ...(body.yardGroup !== undefined && { yardGroup: body.yardGroup as string }),
      ...(body.feedingInstructions !== undefined && { feedingInstructions: body.feedingInstructions as string }),
      ...(body.feedingHistory !== undefined && { feedingHistory: typeof body.feedingHistory === "string" ? body.feedingHistory : JSON.stringify(body.feedingHistory) }),
      ...(body.dogPhoto !== undefined && { dogPhoto: body.dogPhoto as string }),
      ...(body.currentLocation !== undefined && { currentLocation: body.currentLocation as string }),
      ...(body.intakeDate !== undefined && { intakeDate: body.intakeDate ? new Date(body.intakeDate as string) : null }),
    } as any,
    include: { pet: true },
  });
}

export async function deleteServiceDog(businessId: string, db: DbClient, id: string) {
  const existing = await db.serviceDogProfile.findFirst({
    where: { id, businessId },
  });
  if (!existing) throw new ServiceError("כלב שירות לא נמצא", "NOT_FOUND");

  await db.serviceDogProfile.delete({ where: { id, businessId } });
}

export async function updateServiceDogPhase(
  businessId: string,
  db: DbClient,
  id: string,
  phase: string
) {
  if (!phase || !VALID_PHASES.includes(phase)) {
    throw new ServiceError("שלב לא חוקי", "VALIDATION");
  }

  const dog = await db.serviceDogProfile.findFirst({
    where: { id, businessId },
    include: {
      pet: true,
      medicalProtocols: {
        where: { status: { in: ["COMPLETED", "WAIVED"] } },
      },
    },
  });

  if (!dog) throw new ServiceError("כלב שירות לא נמצא", "NOT_FOUND");

  const oldPhase = dog.phase;
  if (oldPhase === phase) throw new ServiceError("הכלב כבר בשלב זה", "VALIDATION");

  const completedKeys = dog.medicalProtocols.map((p) => p.protocolKey);
  const newProtocols = diffProtocolsForPhaseChange(phase, completedKeys);

  const updated = await db.serviceDogProfile.update({
    where: { id, businessId },
    data: {
      phase,
      phaseChangedAt: new Date(),
      ...(phase === "CERTIFIED" && { trainingStatus: "CERTIFIED" }),
      ...(phase === "DECERTIFIED" && { trainingStatus: "FAILED" }),
      ...(phase === "IN_TRAINING" && dog.trainingStatus === "NOT_STARTED"
        ? { trainingStatus: "IN_PROGRESS", trainingStartDate: new Date() }
        : {}),
    } as any,
    include: { pet: true },
  });

  if (newProtocols.length > 0) {
    await db.serviceDogMedicalProtocol.createMany({
      data: newProtocols.map((p) => ({
        serviceDogId: id,
        businessId,
        phase,
        protocolKey: p.key,
        protocolLabel: p.label,
        category: p.category,
        status: "PENDING",
      })),
    });
  }

  const phaseLabel = SERVICE_DOG_PHASES.find((p) => p.id === phase)?.label || phase;
  const oldPhaseLabel = SERVICE_DOG_PHASES.find((p) => p.id === oldPhase)?.label || oldPhase;

  let eventType = "PHASE_CHANGED";
  if (phase === "CERTIFIED") eventType = "CERTIFIED";
  else if (phase === "DECERTIFIED") eventType = "DECERTIFIED";
  else if (phase === "RETIRED") eventType = "DOG_RETIRED";

  await createComplianceEvent(
    id,
    businessId,
    eventType,
    `${dog.pet.name}: שינוי שלב מ${oldPhaseLabel} ל${phaseLabel}`
  );

  return updated;
}

// ─── PLACEMENTS ──────────────────────────────────────────────────────────────

export async function listPlacements(
  businessId: string,
  db: DbClient,
  opts: { status?: string | null } = {}
) {
  const { status } = opts;
  if (status && !["ACTIVE", "TERMINATED"].includes(status)) {
    throw new ServiceError("סטטוס לא חוקי", "VALIDATION");
  }

  return db.serviceDogPlacement.findMany({
    where: {
      businessId,
      ...(status && { status }),
    },
    include: {
      serviceDog: { include: { pet: true } },
      recipient: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPlacement(
  businessId: string,
  db: DbClient,
  input: {
    serviceDogId: string;
    recipientId: string;
    placementDate?: string;
    certifiedAt?: string;
    trialStartDate?: string;
    trialEndDate?: string;
    notes?: string;
    status?: string;
  }
) {
  const { serviceDogId, recipientId, placementDate, certifiedAt, trialStartDate, trialEndDate, notes, status: bodyStatus } = input;

  if (!serviceDogId || !recipientId) {
    throw new ServiceError("נדרש כלב שירות ומקבל", "VALIDATION");
  }

  const VALID_STATUSES = ["ACTIVE", "TERMINATED"];
  const initialStatus = VALID_STATUSES.includes(bodyStatus || "") ? bodyStatus! : "ACTIVE";

  const dog = await db.serviceDogProfile.findFirst({
    where: { id: serviceDogId, businessId },
    include: { pet: true },
  });
  if (!dog) throw new ServiceError("כלב שירות לא נמצא", "NOT_FOUND");

  const recipient = await db.serviceDogRecipient.findFirst({
    where: { id: recipientId, businessId },
  });
  if (!recipient) throw new ServiceError("מקבל לא נמצא", "NOT_FOUND");

  const existingPlacement = await db.serviceDogPlacement.findFirst({
    where: { serviceDogId, recipientId, status: "ACTIVE" },
  });
  if (existingPlacement) throw new ServiceError("שיבוץ פעיל כבר קיים עבור שילוב זה", "CONFLICT");

  const placement = await db.serviceDogPlacement.create({
    data: {
      businessId,
      serviceDogId,
      recipientId,
      placementDate: placementDate ? new Date(placementDate) : new Date(),
      certifiedAt: certifiedAt ? new Date(certifiedAt) : null,
      trialStartDate: trialStartDate ? new Date(trialStartDate) : null,
      trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
      notes: notes || null,
      status: initialStatus,
    },
    include: {
      serviceDog: { include: { pet: true } },
      recipient: true,
    },
  });

  if (certifiedAt) {
    await db.serviceDogProfile.update({
      where: { id: serviceDogId },
      data: { certificationDate: new Date(certifiedAt) },
    });
  }

  await db.serviceDogRecipient.update({
    where: { id: recipientId },
    data: { status: "MATCHED" },
  });

  await createComplianceEvent(
    serviceDogId,
    businessId,
    "PLACEMENT_STARTED",
    `שיבוץ חדש: ${dog.pet.name} → ${recipient.name}`,
    { placementId: placement.id }
  );

  return placement;
}

// ─── RECIPIENTS ──────────────────────────────────────────────────────────────

function maskSensitive(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...r,
    idNumber: null,
    address: null,
    disabilityType: null,
    disabilityNotes: null,
    fundingSource: null,
  };
}

export async function listRecipients(
  businessId: string,
  db: DbClient,
  opts: { status?: string | null; canSeeSensitive?: boolean } = {}
) {
  const { status, canSeeSensitive = false } = opts;

  const recipients = await db.serviceDogRecipient.findMany({
    where: {
      businessId,
      ...(status && { status }),
    },
    include: {
      customer: true,
      placements: {
        where: { status: "ACTIVE" },
        include: { serviceDog: { include: { pet: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return canSeeSensitive
    ? recipients
    : recipients.map((r) => maskSensitive(r as Record<string, unknown>));
}

export async function getRecipient(
  businessId: string,
  db: DbClient,
  id: string,
  canSeeSensitive: boolean
) {
  const recipient = await db.serviceDogRecipient.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      placements: {
        include: {
          serviceDog: {
            include: { pet: { select: { name: true, breed: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!recipient) throw new ServiceError("זכאי לא נמצא", "NOT_FOUND");

  return canSeeSensitive ? recipient : maskSensitive(recipient as Record<string, unknown>);
}

export async function createRecipient(
  businessId: string,
  db: DbClient,
  input: {
    name: string;
    phone?: string;
    mobile?: string;
    email?: string;
    idNumber?: string;
    address?: string;
    disabilityType?: string;
    disabilityNotes?: string;
    customerId?: string;
    notes?: string;
    fundingSource?: string;
    intakeDate?: string;
  }
) {
  const { name: rawName, phone, mobile, email, idNumber, address, disabilityType, disabilityNotes, customerId, notes, fundingSource, intakeDate } = input;

  if (!rawName) throw new ServiceError("נדרש שם", "VALIDATION");
  const name = sanitizeName(rawName);
  if (!name) throw new ServiceError("שם לא תקין", "VALIDATION");

  if (customerId) {
    const customerCheck = await db.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });
    if (!customerCheck) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");
  }

  return db.serviceDogRecipient.create({
    data: {
      businessId,
      name,
      phone: phone || null,
      mobile: mobile || null,
      email: email || null,
      idNumber: idNumber || null,
      address: address || null,
      disabilityType: disabilityType || null,
      disabilityNotes: disabilityNotes || null,
      customerId: customerId || null,
      notes: notes || null,
      fundingSource: fundingSource || null,
      intakeDate: intakeDate ? new Date(intakeDate) : null,
      status: "LEAD",
    },
  });
}

export async function updateRecipient(
  businessId: string,
  db: DbClient,
  id: string,
  body: Record<string, unknown>
) {
  const existing = await db.serviceDogRecipient.findFirst({
    where: { id, businessId },
  });
  if (!existing) throw new ServiceError("זכאי לא נמצא", "NOT_FOUND");

  return db.serviceDogRecipient.update({
    where: { id, businessId },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.phone !== undefined && { phone: (body.phone as string) || null }),
      ...(body.email !== undefined && { email: (body.email as string) || null }),
      ...(body.idNumber !== undefined && { idNumber: (body.idNumber as string) || null }),
      ...(body.address !== undefined && { address: (body.address as string) || null }),
      ...(body.disabilityType !== undefined && { disabilityType: (body.disabilityType as string) || null }),
      ...(body.disabilityNotes !== undefined && { disabilityNotes: (body.disabilityNotes as string) || null }),
      ...(body.notes !== undefined && { notes: (body.notes as string) || null }),
      ...(body.status !== undefined && { status: body.status as string }),
      ...(body.waitlistDate !== undefined && { waitlistDate: body.waitlistDate ? new Date(body.waitlistDate as string) : null }),
      ...(body.fundingSource !== undefined && { fundingSource: (body.fundingSource as string) || null }),
      ...(body.intakeDate !== undefined && { intakeDate: body.intakeDate ? new Date(body.intakeDate as string) : null }),
      ...(body.approvedAt !== undefined && { approvedAt: body.approvedAt ? new Date(body.approvedAt as string) : null }),
      ...(body.mobile !== undefined && { mobile: (body.mobile as string) || null }),
      ...(body.handoverDate !== undefined && { handoverDate: body.handoverDate ? new Date(body.handoverDate as string) : null }),
      ...(body.attachments !== undefined && { attachments: body.attachments }),
      ...(body.meetings !== undefined && { meetings: body.meetings }),
      ...(body.contactPersons !== undefined && { contactPersons: body.contactPersons }),
    } as any,
  });
}

export async function deleteRecipient(businessId: string, db: DbClient, id: string) {
  const existing = await db.serviceDogRecipient.findFirst({
    where: { id, businessId },
    select: { id: true, name: true },
  });
  if (!existing) throw new ServiceError("זכאי לא נמצא", "NOT_FOUND");

  await db.serviceDogRecipient.delete({ where: { id, businessId } });
  return existing;
}
