/**
 * Pets service — pets, health, medications, behavior, weight, vaccinations.
 *
 * All functions: businessId first, db second, then args.
 * No Request/Response. Throws ServiceError on failure.
 */

import type { PrismaClient } from "@prisma/client";
import { ServiceError } from "./types";

export type DbClient = PrismaClient;
export { ServiceError };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysFromNow(expiry: Date, now: Date) {
  return Math.round((expiry.getTime() - now.getTime()) / DAY_MS);
}

/** Prisma OR clause for pet ownership (customer-owned or standalone). */
function petOwnership(businessId: string) {
  return [
    { customer: { businessId } },
    { businessId },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VaccineType =
  | "rabies" | "dhpp" | "dhppPuppy1" | "dhppPuppy2" | "dhppPuppy3"
  | "bordetella" | "parkWorm" | "deworming" | "fleaTick";

export interface VaccinationEntry {
  healthId: string;
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceDogId: string | null;
  vaccineType: VaccineType;
  vaccineLabel: string;
  lastDate: string | null;
  validUntil: string | null;
  daysUntil: number;
  isExpired: boolean;
  isUnknown: boolean;
  extra?: string;
}

export interface PetListOptions {
  search?: string;
  species?: string;
}

export interface VaccinationListOptions {
  all?: boolean;
  days?: number;
}

export interface MedicationInput {
  medName: string;
  dosage?: string | null;
  frequency?: string | null;
  times?: string | null;
  instructions?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface WeightEntryInput {
  weight: number;
  recordedAt?: string;
  notes?: string | null;
}

export interface RenewVaccineInput {
  vaccineType: "rabies" | "dhpp" | "bordetella";
  newDate: string;
  newValidUntil?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pet list
// ─────────────────────────────────────────────────────────────────────────────

export async function listPets(businessId: string, db: DbClient, opts: PetListOptions = {}) {
  const { search = "", species = "" } = opts;

  const where: Record<string, unknown> = {
    OR: petOwnership(businessId),
  };

  if (search) {
    where.AND = [{
      OR: [
        { name: { contains: search } },
        { breed: { contains: search } },
        { customer: { name: { contains: search } } },
      ],
    }];
  }

  if (species) where.species = species;

  const pets = await db.pet.findMany({
    where,
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      gender: true,
      weight: true,
      birthDate: true,
      tags: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true } },
      health: {
        select: {
          neuteredSpayed: true,
          rabiesValidUntil: true,
          rabiesUnknown: true,
          allergies: true,
          medicalConditions: true,
        },
      },
      medications: {
        select: { id: true, medName: true, frequency: true, endDate: true },
        where: { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
      },
      _count: { select: { appointments: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  const now = new Date();
  return pets.map((p) => {
    let vaccinationStatus: "ok" | "expiring" | "expired" | "unknown" = "unknown";
    if (p.health?.rabiesUnknown) {
      vaccinationStatus = "unknown";
    } else if (p.health?.rabiesValidUntil) {
      const d = daysFromNow(new Date(p.health.rabiesValidUntil), now);
      vaccinationStatus = d < 0 ? "expired" : d <= 30 ? "expiring" : "ok";
    }
    return { ...p, activeMedicationCount: p.medications.length, vaccinationStatus };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Single pet
// ─────────────────────────────────────────────────────────────────────────────

export async function getPet(businessId: string, db: DbClient, petId: string) {
  return db.pet.findFirst({
    where: { id: petId, OR: petOwnership(businessId) },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      health: true,
      behavior: true,
      medications: { orderBy: { createdAt: "desc" } },
      appointments: {
        include: { service: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 20,
      },
      boardingStays: {
        include: { room: { select: { name: true } } },
        orderBy: { checkIn: "desc" },
        take: 10,
      },
      trainingPrograms: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Update pet
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdatePetInput {
  name?: string;
  breed?: string | null;
  gender?: string | null;
  weight?: number | string | null;
  birthDate?: string | null;
  microchip?: string | null;
  color?: string | null;
  tags?: string | null;
  attachments?: unknown;
  medicalNotes?: string | null;
  foodNotes?: string | null;
  foodBrand?: string | null;
  foodGramsPerDay?: number | string | null;
  foodFrequency?: string | null;
  behaviorNotes?: string | null;
  neuteredSpayed?: boolean;
  neuteredSpayedDate?: string | null;
}

export async function updatePet(businessId: string, db: DbClient, petId: string, input: UpdatePetInput) {
  const existing = await db.pet.findFirst({
    where: { id: petId, OR: petOwnership(businessId) },
  });
  if (!existing) throw new ServiceError("Pet not found", "NOT_FOUND");

  // Length validation
  if (input.name !== undefined && (typeof input.name !== "string" || input.name.length > 100)) {
    throw new ServiceError("שם חיית מחמד ארוך מדי (מקסימום 100 תווים)", "VALIDATION");
  }
  if (typeof input.breed === "string" && input.breed.length > 100) {
    throw new ServiceError("גזע ארוך מדי (מקסימום 100 תווים)", "VALIDATION");
  }
  if (typeof input.medicalNotes === "string" && input.medicalNotes.length > 5000) {
    throw new ServiceError("הערות רפואיות ארוכות מדי (מקסימום 5000 תווים)", "VALIDATION");
  }
  if (typeof input.foodNotes === "string" && input.foodNotes.length > 2000) {
    throw new ServiceError("הערות מזון ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }
  if (typeof input.behaviorNotes === "string" && input.behaviorNotes.length > 2000) {
    throw new ServiceError("הערות התנהגות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }

  const { neuteredSpayed, neuteredSpayedDate, ...petData } = input;

  const updateData: Record<string, unknown> = {};
  if (petData.name !== undefined) updateData.name = petData.name;
  if (petData.breed !== undefined) updateData.breed = petData.breed || null;
  if (petData.gender !== undefined) updateData.gender = petData.gender || null;
  if (petData.weight !== undefined) updateData.weight = petData.weight != null ? parseFloat(String(petData.weight)) : null;
  if (petData.birthDate !== undefined) updateData.birthDate = petData.birthDate ? new Date(petData.birthDate) : null;
  if (petData.microchip !== undefined) updateData.microchip = petData.microchip || null;
  if (petData.color !== undefined) updateData.color = petData.color || null;
  if (petData.tags !== undefined) updateData.tags = petData.tags;
  if (petData.attachments !== undefined) updateData.attachments = petData.attachments;
  if (petData.medicalNotes !== undefined) updateData.medicalNotes = petData.medicalNotes || null;
  if (petData.foodNotes !== undefined) updateData.foodNotes = petData.foodNotes || null;
  if (petData.foodBrand !== undefined) updateData.foodBrand = petData.foodBrand || null;
  if (petData.foodGramsPerDay !== undefined) updateData.foodGramsPerDay = petData.foodGramsPerDay != null ? parseFloat(String(petData.foodGramsPerDay)) : null;
  if (petData.foodFrequency !== undefined) updateData.foodFrequency = petData.foodFrequency || null;
  if (petData.behaviorNotes !== undefined) updateData.behaviorNotes = petData.behaviorNotes || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pet = await db.pet.update({
    where: { id: petId },
    data: updateData as any,
    include: { health: true, behavior: true },
  });

  if (neuteredSpayed !== undefined || neuteredSpayedDate !== undefined) {
    const healthData: Record<string, unknown> = {};
    if (neuteredSpayed !== undefined) healthData.neuteredSpayed = Boolean(neuteredSpayed);
    if (neuteredSpayedDate !== undefined) healthData.neuteredSpayedDate = neuteredSpayedDate ? new Date(neuteredSpayedDate) : null;
    await db.dogHealth.upsert({
      where: { petId },
      create: { petId, ...healthData },
      update: healthData,
    });
  }

  return pet;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete pet (cascade, no $transaction — Supabase PgBouncer)
// ─────────────────────────────────────────────────────────────────────────────

export async function deletePet(businessId: string, db: DbClient, petId: string) {
  const existing = await db.pet.findFirst({
    where: { id: petId, OR: petOwnership(businessId) },
    select: { id: true, name: true },
  });
  if (!existing) throw new ServiceError("Pet not found", "NOT_FOUND");

  await db.dogMedication.deleteMany({ where: { petId } });
  await db.dogHealth.deleteMany({ where: { petId } });
  await db.dogBehavior.deleteMany({ where: { petId } });
  await db.petWeightEntry.deleteMany({ where: { petId } });
  await db.trainingGroupParticipant.deleteMany({ where: { dogId: petId } });
  await db.pet.delete({ where: { id: petId } });

  return existing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

const HISTORY_MAP: Record<string, { history: string; validUntil?: string }> = {
  rabiesLastDate:    { history: "rabiesHistory",    validUntil: "rabiesValidUntil" },
  dhppLastDate:      { history: "dhppHistory" },
  bordatellaDate:    { history: "bordatellaHistory" },
  parkWormDate:      { history: "parkWormHistory" },
  dewormingLastDate: { history: "dewormingHistory" },
  fleaTickDate:      { history: "fleaTickHistory",  validUntil: "fleaTickExpiryDate" },
};

export async function updatePetHealth(businessId: string, db: DbClient, petId: string, body: Record<string, unknown>) {
  const pet = await db.pet.findFirst({ where: { id: petId, OR: petOwnership(businessId) } });
  if (!pet) throw new ServiceError("Pet not found", "NOT_FOUND");

  const data: Record<string, unknown> = {};
  const dateFields = [
    "rabiesLastDate", "rabiesValidUntil",
    "dhppLastDate", "dhppValidUntil",
    "dhppPuppy1Date", "dhppPuppy2Date", "dhppPuppy3Date",
    "bordatellaDate", "bordatellaValidUntil", "parkWormDate", "parkWormValidUntil",
    "dewormingLastDate", "dewormingValidUntil",
    "fleaTickDate", "fleaTickExpiryDate",
    "neuteredSpayedDate",
  ];
  const stringFields = ["allergies", "medicalConditions", "surgeriesHistory", "activityLimitations", "vetName", "vetPhone", "originInfo", "timeWithOwner", "fleaTickType"];
  const boolFields = ["neuteredSpayed", "rabiesUnknown"];
  const jsonFields = ["notVaccinatedFlags"];

  for (const f of dateFields) {
    if (f in body) data[f] = body[f] ? new Date(body[f] as string) : null;
  }
  for (const f of stringFields) {
    if (f in body) data[f] = body[f] || null;
  }
  for (const f of boolFields) {
    if (f in body) data[f] = Boolean(body[f]);
  }
  for (const f of jsonFields) {
    if (f in body) data[f] = body[f] ?? null;
  }

  // Append old dates to history when updating vaccine date fields
  const updatingVaccineDates = Object.keys(HISTORY_MAP).filter((f) => f in body && body[f]);
  if (updatingVaccineDates.length > 0) {
    const selectFields: Record<string, boolean> = {};
    for (const f of updatingVaccineDates) {
      selectFields[f] = true;
      selectFields[HISTORY_MAP[f].history] = true;
      if (HISTORY_MAP[f].validUntil) selectFields[HISTORY_MAP[f].validUntil!] = true;
    }
    const current = await db.dogHealth.findUnique({
      where: { petId },
      select: selectFields as Record<string, true>,
    });
    if (current) {
      for (const f of updatingVaccineDates) {
        const cfg = HISTORY_MAP[f];
        const oldDate = (current as Record<string, unknown>)[f] as Date | null;
        if (oldDate) {
          const prev = ((current as Record<string, unknown>)[cfg.history] as { date: string; validUntil?: string }[] | null) ?? [];
          const entry: { date: string; validUntil?: string } = { date: oldDate.toISOString() };
          if (cfg.validUntil) {
            const oldVU = (current as Record<string, unknown>)[cfg.validUntil] as Date | null;
            if (oldVU) entry.validUntil = oldVU.toISOString();
          }
          data[cfg.history] = [...prev, entry];
        }
      }
    }
  }

  return db.dogHealth.upsert({
    where: { petId },
    create: { petId, ...data },
    update: data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Renew vaccine
// ─────────────────────────────────────────────────────────────────────────────

const VACCINE_MAP: Record<"rabies" | "dhpp" | "bordetella", { dateField: string; validUntilField: string; historyField: string }> = {
  rabies:     { dateField: "rabiesLastDate",  validUntilField: "rabiesValidUntil",     historyField: "rabiesHistory" },
  dhpp:       { dateField: "dhppLastDate",    validUntilField: "dhppValidUntil",       historyField: "dhppHistory" },
  bordetella: { dateField: "bordatellaDate",  validUntilField: "bordatellaValidUntil", historyField: "bordatellaHistory" },
};

export async function renewVaccine(businessId: string, db: DbClient, petId: string, input: RenewVaccineInput) {
  const { vaccineType, newDate, newValidUntil } = input;

  if (!VACCINE_MAP[vaccineType]) throw new ServiceError("סוג חיסון לא תקין", "VALIDATION");
  if (!newDate) throw new ServiceError("תאריך חיסון חסר", "VALIDATION");

  const pet = await db.pet.findFirst({
    where: { id: petId, OR: petOwnership(businessId) },
    include: { health: true },
  });
  if (!pet) throw new ServiceError("Pet not found", "NOT_FOUND");

  const { dateField, validUntilField, historyField } = VACCINE_MAP[vaccineType];
  const currentHealth = pet.health as Record<string, unknown> | null;

  const currentDate = currentHealth?.[dateField];
  const currentValidUntil = currentHealth?.[validUntilField];

  let existingHistory: unknown[] = [];
  if (currentHealth) {
    const raw = currentHealth[historyField];
    if (Array.isArray(raw)) existingHistory = raw;
  }

  const updatedHistory = currentDate
    ? [
        ...existingHistory,
        {
          date: currentDate instanceof Date ? currentDate.toISOString() : currentDate,
          validUntil: currentValidUntil instanceof Date ? (currentValidUntil as Date).toISOString() : currentValidUntil ?? null,
          recordedAt: new Date().toISOString(),
        },
      ]
    : existingHistory;

  const updateData: Record<string, unknown> = {
    [dateField]: new Date(newDate),
    [validUntilField]: newValidUntil ? new Date(newValidUntil) : null,
    [historyField]: updatedHistory,
  };

  return db.dogHealth.upsert({
    where: { petId },
    create: { petId, ...updateData },
    update: updateData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Medications (per-pet)
// ─────────────────────────────────────────────────────────────────────────────

async function verifyPet(businessId: string, db: DbClient, petId: string) {
  const pet = await db.pet.findFirst({ where: { id: petId, OR: petOwnership(businessId) } });
  if (!pet) throw new ServiceError("Pet not found", "NOT_FOUND");
  return pet;
}

async function verifyMed(businessId: string, db: DbClient, petId: string, medId: string) {
  const med = await db.dogMedication.findFirst({
    where: { id: medId, petId, pet: { OR: petOwnership(businessId) } },
  });
  if (!med) throw new ServiceError("Medication not found", "NOT_FOUND");
  return med;
}

export async function listPetMedications(businessId: string, db: DbClient, petId: string) {
  await verifyPet(businessId, db, petId);
  return db.dogMedication.findMany({ where: { petId }, orderBy: { createdAt: "desc" } });
}

export async function createMedication(businessId: string, db: DbClient, petId: string, input: MedicationInput) {
  await verifyPet(businessId, db, petId);
  if (!input.medName?.trim()) throw new ServiceError("שם תרופה הוא שדה חובה", "VALIDATION");

  return db.dogMedication.create({
    data: {
      petId,
      medName: input.medName.trim(),
      dosage: input.dosage?.trim() || null,
      frequency: input.frequency?.trim() || null,
      times: input.times?.trim() || null,
      instructions: input.instructions?.trim() || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
}

export async function updateMedication(businessId: string, db: DbClient, petId: string, medId: string, input: Partial<MedicationInput>) {
  const existing = await verifyMed(businessId, db, petId, medId);

  const safeDate = (v: string | null | undefined): Date | null | undefined => {
    if (v === undefined) return undefined;
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const parsedStart = safeDate(input.startDate as string | null | undefined);
  const parsedEnd = safeDate(input.endDate as string | null | undefined);
  if (input.startDate !== undefined && parsedStart === undefined) throw new ServiceError("תאריך התחלה לא חוקי", "VALIDATION");
  if (input.endDate !== undefined && parsedEnd === undefined) throw new ServiceError("תאריך סיום לא חוקי", "VALIDATION");

  return db.dogMedication.update({
    where: { id: existing.id },
    data: {
      ...(input.medName !== undefined && { medName: (input.medName as string).trim() }),
      ...(input.dosage !== undefined && { dosage: input.dosage?.trim() || null }),
      ...(input.frequency !== undefined && { frequency: input.frequency?.trim() || null }),
      ...(input.times !== undefined && { times: input.times?.trim() || null }),
      ...(input.instructions !== undefined && { instructions: input.instructions?.trim() || null }),
      ...(input.startDate !== undefined && { startDate: parsedStart }),
      ...(input.endDate !== undefined && { endDate: parsedEnd }),
    },
  });
}

export async function deleteMedication(businessId: string, db: DbClient, petId: string, medId: string) {
  const existing = await verifyMed(businessId, db, petId, medId);
  await db.dogMedication.delete({ where: { id: existing.id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Behavior
// ─────────────────────────────────────────────────────────────────────────────

export async function updateBehavior(businessId: string, db: DbClient, petId: string, body: Record<string, unknown>) {
  await verifyPet(businessId, db, petId);

  const data: Record<string, unknown> = {};
  const boolFields = [
    "dogAggression", "humanAggression", "leashReactivity", "leashPulling",
    "jumping", "separationAnxiety", "excessiveBarking", "destruction",
    "resourceGuarding", "fears", "badWithKids", "houseSoiling",
    "biteHistory", "priorTraining",
  ];
  const stringFields = ["biteDetails", "triggers", "priorTrainingDetails"];

  for (const f of boolFields) {
    if (f in body) data[f] = Boolean(body[f]);
  }
  for (const f of stringFields) {
    if (f in body) data[f] = body[f] || null;
  }
  if ("customIssues" in body) {
    const arr = Array.isArray(body.customIssues) ? body.customIssues : [];
    data.customIssues = arr.length > 0 ? JSON.stringify(arr) : null;
  }

  return db.dogBehavior.upsert({
    where: { petId },
    create: { petId, ...data },
    update: data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight
// ─────────────────────────────────────────────────────────────────────────────

export async function listWeightEntries(businessId: string, db: DbClient, petId: string) {
  await verifyPet(businessId, db, petId);
  return db.petWeightEntry.findMany({
    where: { petId, businessId },
    orderBy: { recordedAt: "desc" },
  });
}

export async function addWeightEntry(businessId: string, db: DbClient, petId: string, input: WeightEntryInput) {
  await verifyPet(businessId, db, petId);

  const weight = typeof input.weight === "number" ? input.weight : parseFloat(String(input.weight));
  if (!Number.isFinite(weight) || weight <= 0) throw new ServiceError("משקל לא תקין", "VALIDATION");

  return db.petWeightEntry.create({
    data: {
      petId,
      businessId,
      weight,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      notes: input.notes ?? null,
    },
  });
}

export async function deleteWeightEntry(businessId: string, db: DbClient, petId: string, entryId: string) {
  await db.petWeightEntry.deleteMany({ where: { id: entryId, petId, businessId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Birthdays
// ─────────────────────────────────────────────────────────────────────────────

export async function listPetBirthdays(businessId: string, db: DbClient, opts: { days?: number } = {}) {
  const days = opts.days ?? 14;

  const pets = await db.pet.findMany({
    where: { OR: petOwnership(businessId), birthDate: { not: null } },
    select: {
      id: true, name: true, species: true, breed: true, birthDate: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  const now = new Date();
  const upcoming: Array<{
    petId: string; petName: string; species: string; breed: string | null;
    customerId: string; customerName: string; customerPhone: string;
    birthDate: string; nextBirthday: string; daysUntil: number; age: number;
  }> = [];

  for (const pet of pets) {
    if (!pet.birthDate) continue;
    const bd = new Date(pet.birthDate);
    const nextBd = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (nextBd < now) nextBd.setFullYear(now.getFullYear() + 1);
    const daysUntil = Math.round((nextBd.getTime() - now.getTime()) / DAY_MS);
    if (daysUntil > days) continue;
    const age = nextBd.getFullYear() - bd.getFullYear() -
      (nextBd.getMonth() < bd.getMonth() || (nextBd.getMonth() === bd.getMonth() && nextBd.getDate() < bd.getDate()) ? 1 : 0);

    upcoming.push({
      petId: pet.id, petName: pet.name, species: pet.species, breed: pet.breed,
      customerId: pet.customer?.id ?? "", customerName: pet.customer?.name ?? "", customerPhone: pet.customer?.phone ?? "",
      birthDate: pet.birthDate.toISOString(), nextBirthday: nextBd.toISOString(), daysUntil, age,
    });
  }

  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  return upcoming;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vaccinations
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_SELECT = {
  id: true,
  rabiesLastDate: true, rabiesValidUntil: true, rabiesUnknown: true,
  dhppLastDate: true, dhppPuppy1Date: true, dhppPuppy2Date: true, dhppPuppy3Date: true,
  bordatellaDate: true, parkWormDate: true, dewormingLastDate: true,
  fleaTickType: true, fleaTickDate: true, fleaTickExpiryDate: true,
  pet: {
    select: {
      id: true, name: true, species: true, breed: true,
      customer: { select: { id: true, name: true, phone: true } },
      serviceDogProfile: { select: { id: true } },
    },
  },
};

type HealthRow = Awaited<ReturnType<typeof fetchHealths>>[number];

function buildVaccineEntry(
  h: HealthRow,
  type: VaccineType,
  label: string,
  lastDate: Date | null,
  validUntil: Date | null,
  now: Date,
  extra?: string
): VaccinationEntry {
  const base = {
    petId: h.pet.id,
    petName: h.pet.name,
    species: h.pet.species,
    breed: h.pet.breed,
    customerId: h.pet.customer?.id ?? "",
    customerName: h.pet.customer?.name ?? "",
    customerPhone: h.pet.customer?.phone ?? "",
    serviceDogId: h.pet.serviceDogProfile?.id ?? null,
  };
  const idSuffix = type === "rabies" ? "" : `_${type}`;

  if (!validUntil) {
    return { ...base, healthId: h.id + idSuffix, vaccineType: type, vaccineLabel: label, lastDate: lastDate?.toISOString() ?? null, validUntil: null, daysUntil: 0, isExpired: false, isUnknown: true, ...(extra ? { extra } : {}) };
  }
  const days = daysFromNow(validUntil, now);
  return { ...base, healthId: h.id + idSuffix, vaccineType: type, vaccineLabel: label, lastDate: lastDate?.toISOString() ?? null, validUntil: validUntil.toISOString(), daysUntil: days, isExpired: validUntil < now, isUnknown: false, ...(extra ? { extra } : {}) };
}

function buildAllVaccineEntries(h: HealthRow, now: Date): VaccinationEntry[] {
  return [
    buildVaccineEntry(h, "rabies",     "כלבת",                  h.rabiesLastDate,    (h.rabiesUnknown || !h.rabiesValidUntil) ? null : h.rabiesValidUntil, now),
    buildVaccineEntry(h, "dhpp",       "משושה בוגר (DHPP)",     h.dhppLastDate,      h.dhppLastDate      ? addDays(h.dhppLastDate, 365)  : null, now),
    buildVaccineEntry(h, "dhppPuppy1", "משושה גורים מנה 1",     h.dhppPuppy1Date,    h.dhppPuppy1Date    ? addDays(h.dhppPuppy1Date, 14)  : null, now),
    buildVaccineEntry(h, "dhppPuppy2", "משושה גורים מנה 2",     h.dhppPuppy2Date,    h.dhppPuppy2Date    ? addDays(h.dhppPuppy2Date, 14)  : null, now),
    buildVaccineEntry(h, "dhppPuppy3", "משושה גורים מנה 3",     h.dhppPuppy3Date,    h.dhppPuppy3Date    ? addDays(h.dhppPuppy3Date, 365) : null, now),
    buildVaccineEntry(h, "bordetella", "שעלת מכלאות",           h.bordatellaDate,    null, now),
    buildVaccineEntry(h, "parkWorm",   "תולעת הפארק",           h.parkWormDate,      h.parkWormDate      ? addDays(h.parkWormDate, 90)    : null, now),
    buildVaccineEntry(h, "deworming",  "תילוע",                  h.dewormingLastDate, h.dewormingLastDate ? addDays(h.dewormingLastDate, 210) : null, now),
    buildVaccineEntry(h, "fleaTick",   "קרציות ופרעושים",       h.fleaTickDate,      h.fleaTickExpiryDate ?? null, now, h.fleaTickType ?? undefined),
  ];
}

async function fetchHealths(businessId: string, db: DbClient) {
  return db.dogHealth.findMany({
    where: { pet: { OR: petOwnership(businessId) } },
    select: HEALTH_SELECT,
  });
}

const STATUS_ORDER = (v: VaccinationEntry) =>
  v.isExpired ? 0 : v.isUnknown ? 1 : v.daysUntil <= 30 ? 2 : 3;

export async function listVaccinations(businessId: string, db: DbClient, opts: VaccinationListOptions = {}) {
  const now = new Date();

  if (opts.all) {
    const healths = await fetchHealths(businessId, db);
    const results = healths.flatMap((h) => buildAllVaccineEntries(h, now));
    results.sort((a, b) => STATUS_ORDER(a) - STATUS_ORDER(b) || a.daysUntil - b.daysUntil);
    return results;
  }

  const days = Math.min(Math.max(opts.days ?? 30, 1), 365);
  const cutoff = new Date(now.getTime() + days * DAY_MS);

  const dhppCutoff       = new Date(cutoff.getTime() - 365 * DAY_MS);
  const dhppPuppy1Cutoff = new Date(cutoff.getTime() - 14 * DAY_MS);
  const dhppPuppy2Cutoff = new Date(cutoff.getTime() - 14 * DAY_MS);
  const dhppPuppy3Cutoff = new Date(cutoff.getTime() - 365 * DAY_MS);
  const parkWormCutoff   = new Date(cutoff.getTime() - 90 * DAY_MS);
  const dewormCutoff     = new Date(cutoff.getTime() - 210 * DAY_MS);

  const healths = await db.dogHealth.findMany({
    where: {
      pet: { OR: petOwnership(businessId) },
      OR: [
        { rabiesValidUntil: { lte: cutoff }, rabiesUnknown: false },
        { dhppLastDate: { not: null, lte: dhppCutoff } },
        { dhppPuppy1Date: { not: null, lte: dhppPuppy1Cutoff } },
        { dhppPuppy2Date: { not: null, lte: dhppPuppy2Cutoff } },
        { dhppPuppy3Date: { not: null, lte: dhppPuppy3Cutoff } },
        { parkWormDate: { not: null, lte: parkWormCutoff } },
        { dewormingLastDate: { not: null, lte: dewormCutoff } },
        { fleaTickExpiryDate: { not: null, lte: cutoff } },
      ],
    },
    select: HEALTH_SELECT,
  });

  const results: VaccinationEntry[] = [];
  for (const h of healths) {
    for (const entry of buildAllVaccineEntries(h, now)) {
      if (entry.vaccineType === "bordetella" || entry.isUnknown) continue;
      if (entry.validUntil && new Date(entry.validUntil) <= cutoff) results.push(entry);
    }
  }
  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global medications list (across all business pets)
// ─────────────────────────────────────────────────────────────────────────────

export async function listAllMedications(businessId: string, db: DbClient, opts: { boardedOnly?: boolean } = {}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const medications = await db.dogMedication.findMany({
    where: {
      pet: { customer: { businessId } },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        { OR: [{ startDate: null }, { startDate: { lte: new Date() } }] },
      ],
    },
    include: {
      pet: {
        select: {
          id: true, name: true, species: true, breed: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { petId: "asc" },
  });

  let result = medications;
  if (opts.boardedOnly) {
    const checkedInPetIds = await db.boardingStay.findMany({
      where: { pet: { customer: { businessId } }, status: "checked_in" },
      select: { petId: true },
    });
    const boardedSet = new Set(checkedInPetIds.map((s) => s.petId));
    result = medications.filter((m) => boardedSet.has(m.petId));
  }

  const byPet = new Map<string, { pet: typeof medications[0]["pet"]; meds: typeof medications }>();
  for (const med of result) {
    const existing = byPet.get(med.petId);
    if (existing) existing.meds.push(med);
    else byPet.set(med.petId, { pet: med.pet, meds: [med] });
  }

  return Array.from(byPet.values()).map(({ pet, meds }) => ({
    petId: pet.id, petName: pet.name, species: pet.species, breed: pet.breed,
    customerId: pet.customer?.id ?? "", customerName: pet.customer?.name ?? "", customerPhone: pet.customer?.phone ?? "",
    medications: meds.map((m) => ({
      id: m.id, medName: m.medName, dosage: m.dosage, frequency: m.frequency,
      times: m.times, instructions: m.instructions, startDate: m.startDate, endDate: m.endDate,
    })),
  }));
}
