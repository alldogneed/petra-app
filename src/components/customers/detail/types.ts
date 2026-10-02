export interface PetDoc {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface CustomerDoc {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  createdAt: string;
}

export interface DogMedication {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  weight: number | null;
  gender: string | null;
  microchip: string | null;
  tags: string;
  attachments: string;
  medicalNotes: string | null;
  foodNotes: string | null;
  foodBrand: string | null;
  foodGramsPerDay: number | null;
  foodFrequency: string | null;
  behaviorNotes: string | null;
  health: {
    neuteredSpayed: boolean | null;
    neuteredSpayedDate: string | null;
    allergies: string | null;
    medicalConditions: string | null;
    surgeriesHistory: string | null;
    activityLimitations: string | null;
    vetName: string | null;
    vetPhone: string | null;
    rabiesLastDate: string | null;
    rabiesValidUntil: string | null;
    dhppLastDate: string | null;
    dhppPuppy1Date: string | null;
    dhppPuppy2Date: string | null;
    dhppPuppy3Date: string | null;
    bordatellaDate: string | null;
    parkWormDate: string | null;
    dewormingLastDate: string | null;
    fleaTickType: string | null;
    fleaTickDate: string | null;
    fleaTickExpiryDate: string | null;
    originInfo: string | null;
    timeWithOwner: string | null;
    notVaccinatedFlags: Record<string, boolean> | null;
  } | null;
  behavior: {
    dogAggression: boolean | null;
    humanAggression: boolean | null;
    leashReactivity: boolean | null;
    leashPulling: boolean | null;
    jumping: boolean | null;
    separationAnxiety: boolean | null;
    excessiveBarking: boolean | null;
    destruction: boolean | null;
    resourceGuarding: boolean | null;
    fears: boolean | null;
    badWithKids: boolean | null;
    houseSoiling: boolean | null;
    biteHistory: boolean | null;
    biteDetails: string | null;
    triggers: string | null;
    priorTraining: boolean | null;
    priorTrainingDetails: string | null;
    customIssues: string | null;
  } | null;
  medications: DogMedication[];
}

export interface PaymentInfo {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  notes?: string | null;
  isDeposit?: boolean;
  appointment: { service: { name: string } | null } | null;
  boardingStay: { pet: { name: string } | null; room: { name: string } | null } | null;
}

export interface TrainingGoal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
}

export interface TrainingProgramInfo {
  id: string;
  dogId: string;
  name: string;
  programType: string;
  status: string;
  startDate: string | null;
  totalSessions: number | null;
  frequency: string | null;
  notes: string | null;
  dog: { name: string } | null;
  goals: TrainingGoal[];
  /** Number of COMPLETED sessions (server-counted). */
  completedSessions: number;
}

export interface OrderLineInfo {
  id: string;
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal?: number;
  lineTax?: number;
  lineTotal: number;
}

export interface OrderPaymentInfo {
  id: string;
  amount: number;
  status: string;
}

export interface OrderInfo {
  id: string;
  orderType: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
  startAt: string | null;
  endAt: string | null;
  lines: OrderLineInfo[];
  payments: OrderPaymentInfo[];
}

export interface CustomerAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  service: { name: string; color: string | null } | null;
  priceListItem?: { name: string } | null;
  pet: { name: string; species: string } | null;
}

export interface CustomerTimelineEvent {
  id: string;
  type: string;
  description: string;
  metadata?: string | null;
  createdAt: string;
}

export interface CustomerBalanceSummary {
  outstanding: number;
  ordersOutstanding: number;
  pendingAmount: number;
  totalPaid: number;
}

export interface CustomerSummary {
  /** null when the caller lacks FINANCE_READ. */
  balance: CustomerBalanceSummary | null;
  counts: {
    appointments: number;
    upcomingAppointments: number;
    pastVisits: number;
    payments: number;
    orders: number;
    timelineEvents: number;
    pets: number;
  };
  nextAppointment: { id: string; date: string; startTime: string; serviceName: string | null; petName: string | null } | null;
  lastVisit: { id: string; date: string; startTime: string; serviceName: string | null } | null;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  idNumber: string | null;
  notes: string | null;
  tags: string;
  source: string | null;
  documents: string;
  createdAt: string;
  pets: Pet[];
  appointments: CustomerAppointment[];
  payments: PaymentInfo[];
  orders: OrderInfo[];
  trainingPrograms: TrainingProgramInfo[];
  timelineEvents: CustomerTimelineEvent[];
  summary: CustomerSummary;
}

/** Paged list responses (GET /api/customers/[id]/{appointments,payments,timeline}). */
export interface PagedAppointments { appointments: CustomerAppointment[]; nextCursor: string | null; total: number }
export interface PagedPayments { payments: PaymentInfo[]; nextCursor: string | null; total: number }
export interface PagedTimeline { events: CustomerTimelineEvent[]; nextCursor: string | null }

/** Service name for an appointment row (service → price-list item → fallback). */
export function appointmentServiceName(apt: Pick<CustomerAppointment, "service" | "priceListItem">, fallback = "שירות"): string {
  return apt.service?.name || apt.priceListItem?.name || fallback;
}

/** "2.10.2026" from an ISO date (date part only — no timezone shift). */
export function formatDayDate(date: string): string {
  const [y, m, d] = String(date).slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${Number(d)}.${Number(m)}.${y}`;
}

/** Parse the customer's JSON tags column safely. */
export function parseTags(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function calcAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (totalMonths < 0) return null;
  if (totalMonths < 12) return `${totalMonths} חודשים`;
  const years = Math.floor(totalMonths / 12);
  return `${years} שנ׳`;
}

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compress images client-side before upload (canvas → JPEG). PDFs/docs returned as-is. */
export async function compressImage(file: File, maxPx = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = document.createElement("img");
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      if (width > maxPx) { height = Math.round((height * maxPx) / width); width = maxPx; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out = new (File as any)([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() }) as File;
        resolve(out.size < file.size ? out : file);
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}
