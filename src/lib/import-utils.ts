/**
 * Petra Import Utilities
 * Phone normalization, header mapping, CSV/XLSX parsing
 * Supports: customers/pets, service dogs, service recipients
 */

import * as XLSX from "xlsx";
import {
  SERVICE_DOG_PHASES,
  SERVICE_DOG_TYPES,
  LOCATION_OPTIONS,
  DISABILITY_TYPES,
  RECIPIENT_FUNDING_SOURCES,
} from "./service-dogs";

// ─── Phone Normalization ──────────────────────────────────────────────────────

export function normalizePhone(input: string): { phoneRaw: string; phoneNorm: string } | null {
  if (!input) return null;
  const phoneRaw = input.trim();

  // Strip all non-digits except leading +
  const digits = phoneRaw.replace(/[\s\-().]/g, "");

  if (!digits) return null;

  let phoneNorm: string;

  if (digits.startsWith("+")) {
    // already has country code
    phoneNorm = digits;
  } else if (digits.startsWith("972")) {
    phoneNorm = "+" + digits;
  } else if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) {
    // Israeli mobile/landline: 05X-XXXXXXX → +9725X-XXXXXXX
    phoneNorm = "+972" + digits.slice(1);
  } else if (digits.length >= 7) {
    // Unknown format — keep as-is with + prefix if looks like intl
    phoneNorm = digits;
  } else {
    return null;
  }

  // Remove any remaining non-digit chars from norm except leading +
  phoneNorm = "+" + phoneNorm.replace(/\D/g, "");

  return { phoneRaw, phoneNorm };
}

// ─── Header Mapping ───────────────────────────────────────────────────────────

type CustomerField = "full_name" | "phone" | "email" | "city" | "notes";
type PetField = "pet_name" | "owner_phone" | "breed" | "sex" | "age" | "notes";

const CUSTOMER_HEADER_MAP: Record<string, CustomerField> = {
  // full_name
  full_name: "full_name", name: "full_name", customer: "full_name", client: "full_name",
  "שם": "full_name", "שם מלא": "full_name", "שם לקוח": "full_name", "שם פרטי": "full_name",
  "שם ומשפחה": "full_name",
  // phone
  phone: "phone", mobile: "phone", telephone: "phone", tel: "phone", "טלפון": "phone",
  "נייד": "phone", "מספר": "phone", "טל": "phone", "מספר טלפון": "phone", "פלאפון": "phone",
  // email
  email: "email", "מייל": "email", "דואל": "email", "אימייל": "email",
  // city
  city: "city", "עיר": "city", "יישוב": "city", "מקום מגורים": "city",
  // notes
  notes: "notes", remark: "notes", remarks: "notes", comment: "notes", comments: "notes",
  "הערות": "notes", "הערה": "notes",
};

const PET_HEADER_MAP: Record<string, PetField> = {
  // pet_name
  pet_name: "pet_name", dog: "pet_name", dog_name: "pet_name", cat_name: "pet_name",
  pet: "pet_name", animal: "pet_name",
  "שם כלב": "pet_name", "כלב": "pet_name", "שם חיית מחמד": "pet_name", "שם": "pet_name",
  "שם חיה": "pet_name",
  // owner_phone
  owner_phone: "owner_phone", customer_phone: "owner_phone", owner_mobile: "owner_phone",
  "בעלים טלפון": "owner_phone", "טלפון בעלים": "owner_phone", "טלפון": "owner_phone",
  "נייד": "owner_phone",
  // breed
  breed: "breed", "גזע": "breed",
  // sex
  sex: "sex", gender: "sex", "מין": "sex", "זכר/נקבה": "sex",
  // age
  age: "age", "גיל": "age", "גיל בשנים": "age",
  // notes
  notes: "notes", remark: "notes", "הערות": "notes", "הערה": "notes",
};

/** Pet header map for combined (single-sheet) mode — excludes "הערות" to avoid conflict with customer notes */
const COMBINED_PET_HEADER_MAP: Record<string, PetField> = {
  pet_name: "pet_name", dog: "pet_name", dog_name: "pet_name", pet: "pet_name",
  "שם כלב": "pet_name", "כלב": "pet_name", "שם חיית מחמד": "pet_name", "שם חיה": "pet_name",
  breed: "breed", "גזע": "breed",
  sex: "sex", gender: "sex", "מין": "sex", "זכר/נקבה": "sex",
  age: "age", "גיל": "age", "גיל בשנים": "age",
  // pet-specific notes columns only (not the generic "הערות")
  "הערות כלב": "notes", "הערות חיה": "notes", "הערות חיית מחמד": "notes",
  pet_notes: "notes", dog_notes: "notes",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mapCustomerHeaders(headers: string[]): Record<string, CustomerField> {
  const result: Record<string, CustomerField> = {};
  for (const h of headers) {
    const key = normalizeHeader(h);
    const mapped = CUSTOMER_HEADER_MAP[key] ?? CUSTOMER_HEADER_MAP[h.trim()];
    if (mapped) result[h] = mapped;
  }
  return result;
}

export function mapPetHeaders(headers: string[]): Record<string, PetField> {
  const result: Record<string, PetField> = {};
  for (const h of headers) {
    const key = normalizeHeader(h);
    const mapped = PET_HEADER_MAP[key] ?? PET_HEADER_MAP[h.trim()];
    if (mapped) result[h] = mapped;
  }
  return result;
}

// ─── Row Types ────────────────────────────────────────────────────────────────

export interface RawCustomerRow {
  rowNumber: number;
  full_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  notes?: string;
  raw: Record<string, string>;
}

export interface RawPetRow {
  rowNumber: number;
  pet_name?: string;
  owner_phone?: string;
  breed?: string;
  sex?: string;
  age?: string;
  notes?: string;
  raw: Record<string, string>;
}

export interface ParseIssue {
  rowNumber: number;
  entityType: "customer" | "pet" | "service_dog" | "recipient";
  issueCode: string;
  message: string;
  raw: Record<string, string>;
}

export interface ParseResult {
  customers: RawCustomerRow[];
  pets: RawPetRow[];
  issues: ParseIssue[];
  customerMappingConfidence: number; // 0-1
  petMappingConfidence: number;      // 0-1
}

// ─── XLSX / CSV Parsing ───────────────────────────────────────────────────────

function sheetToRows(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return raw.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      // When cellDates:true, date cells come as Date objects — convert to ISO string
      // so parseDateValue can handle them reliably
      if (v instanceof Date) {
        out[String(k)] = v.toISOString();
      } else {
        out[String(k)] = String(v ?? "").trim();
      }
    }
    return out;
  });
}

function parseCustomerRows(
  rows: Record<string, string>[],
  startRowOffset = 2
): { customers: RawCustomerRow[]; issues: ParseIssue[]; confidence: number } {
  if (rows.length === 0) return { customers: [], issues: [], confidence: 0 };

  const headers = Object.keys(rows[0]);
  const mapping = mapCustomerHeaders(headers);
  const mapped = Object.values(mapping);
  const confidence = headers.length > 0
    ? Math.min(1, (new Set(mapped).size) / 3) // expect at least 3 core fields
    : 0;

  const customers: RawCustomerRow[] = [];
  const issues: ParseIssue[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + startRowOffset;
    const get = (field: CustomerField): string => {
      const col = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const full_name = get("full_name");
    const phone = get("phone");

    if (!full_name && !phone) {
      // Completely empty row — skip silently
      return;
    }

    if (!full_name) {
      issues.push({ rowNumber: rowNum, entityType: "customer", issueCode: "MISSING_NAME", message: "שם לקוח חסר", raw: row });
      return;
    }
    if (!phone) {
      issues.push({ rowNumber: rowNum, entityType: "customer", issueCode: "MISSING_PHONE", message: "טלפון חסר", raw: row });
      return;
    }
    const norm = normalizePhone(phone);
    if (!norm) {
      issues.push({ rowNumber: rowNum, entityType: "customer", issueCode: "INVALID_PHONE", message: `טלפון לא תקין: "${phone}"`, raw: row });
      return;
    }

    customers.push({
      rowNumber: rowNum,
      full_name,
      phone: norm.phoneRaw,
      email: get("email") || undefined,
      city: get("city") || undefined,
      notes: get("notes") || undefined,
      raw: row,
    });
  });

  return { customers, issues, confidence };
}

function parsePetRows(
  rows: Record<string, string>[],
  startRowOffset = 2
): { pets: RawPetRow[]; issues: ParseIssue[]; confidence: number } {
  if (rows.length === 0) return { pets: [], issues: [], confidence: 0 };

  const headers = Object.keys(rows[0]);
  const mapping = mapPetHeaders(headers);
  const mapped = Object.values(mapping);
  const confidence = headers.length > 0
    ? Math.min(1, (new Set(mapped).size) / 2)
    : 0;

  const pets: RawPetRow[] = [];
  const issues: ParseIssue[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + startRowOffset;
    const get = (field: PetField): string => {
      const col = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const pet_name = get("pet_name");
    const owner_phone = get("owner_phone");

    if (!pet_name && !owner_phone) return; // empty row

    if (!pet_name) {
      issues.push({ rowNumber: rowNum, entityType: "pet", issueCode: "MISSING_PET_NAME", message: "שם חיית מחמד חסר", raw: row });
      return;
    }
    if (!owner_phone) {
      issues.push({ rowNumber: rowNum, entityType: "pet", issueCode: "MISSING_OWNER_PHONE", message: "טלפון בעלים חסר", raw: row });
      return;
    }
    const norm = normalizePhone(owner_phone);
    if (!norm) {
      issues.push({ rowNumber: rowNum, entityType: "pet", issueCode: "INVALID_OWNER_PHONE", message: `טלפון בעלים לא תקין: "${owner_phone}"`, raw: row });
      return;
    }

    pets.push({
      rowNumber: rowNum,
      pet_name,
      owner_phone: norm.phoneNorm,
      breed: get("breed") || undefined,
      sex: get("sex") || undefined,
      age: get("age") || undefined,
      notes: get("notes") || undefined,
      raw: row,
    });
  });

  return { pets, issues, confidence };
}

/** Detect if a sheet is a combined customer+pet sheet (has both customer and pet-specific columns) */
function isCombinedSheet(headers: string[]): boolean {
  const normalized = headers.map((h) => normalizeHeader(h));
  const hasCustCol = normalized.some((h) =>
    ["שם מלא", "שם לקוח", "full_name", "name", "שם"].includes(h)
  );
  const hasPetCol = normalized.some((h) =>
    Object.keys(COMBINED_PET_HEADER_MAP).map(normalizeHeader).includes(h)
  );
  return hasCustCol && hasPetCol;
}

/** Parse a combined single-sheet where each row = one customer + optional pet */
function parseCombinedRows(
  rows: Record<string, string>[],
  startRowOffset = 2
): { customers: RawCustomerRow[]; pets: RawPetRow[]; issues: ParseIssue[]; confidence: number } {
  if (rows.length === 0) return { customers: [], pets: [], issues: [], confidence: 0 };

  const headers = Object.keys(rows[0]);
  const custMapping = mapCustomerHeaders(headers);

  // Build pet mapping using the combined map (no "הערות" conflict)
  const petMapping: Record<string, PetField> = {};
  for (const h of headers) {
    const key = normalizeHeader(h);
    const mapped = COMBINED_PET_HEADER_MAP[key] ?? COMBINED_PET_HEADER_MAP[h.trim()];
    if (mapped) petMapping[h] = mapped;
  }

  const customers: RawCustomerRow[] = [];
  const pets: RawPetRow[] = [];
  const issues: ParseIssue[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + startRowOffset;

    const getCust = (field: CustomerField): string => {
      const col = Object.entries(custMapping).find(([, f]) => f === field)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };
    const getPet = (field: PetField): string => {
      const col = Object.entries(petMapping).find(([, f]) => f === field)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const full_name = getCust("full_name");
    const phone = getCust("phone");

    if (!full_name && !phone) return; // empty row

    if (!full_name) {
      issues.push({ rowNumber: rowNum, entityType: "customer", issueCode: "MISSING_NAME", message: "שם לקוח חסר", raw: row });
      return;
    }
    if (!phone) {
      issues.push({ rowNumber: rowNum, entityType: "customer", issueCode: "MISSING_PHONE", message: "טלפון חסר", raw: row });
      return;
    }
    const norm = normalizePhone(phone);
    if (!norm) {
      issues.push({ rowNumber: rowNum, entityType: "customer", issueCode: "INVALID_PHONE", message: `טלפון לא תקין: "${phone}"`, raw: row });
      return;
    }

    customers.push({
      rowNumber: rowNum,
      full_name,
      phone: norm.phoneRaw,
      email: getCust("email") || undefined,
      city: getCust("city") || undefined,
      notes: getCust("notes") || undefined,
      raw: row,
    });

    // Pet is optional — only add if pet_name is filled
    const pet_name = getPet("pet_name");
    if (pet_name) {
      pets.push({
        rowNumber: rowNum,
        pet_name,
        owner_phone: norm.phoneNorm, // link to customer in same row by phone
        breed: getPet("breed") || undefined,
        sex: getPet("sex") || undefined,
        age: getPet("age") || undefined,
        notes: getPet("notes") || undefined,
        raw: row,
      });
    }
  });

  const confidence = Object.keys(custMapping).length >= 2 ? 1 : 0.5;
  return { customers, pets, issues, confidence };
}

/**
 * Main parse entry point.
 * buffer: file bytes
 * filename: original filename
 * includePets: hint for CSV files — treat as customers+pets if true
 */
export function parseImportFile(
  buffer: Buffer,
  filename: string,
  includePets: boolean
): ParseResult {
  const ext = filename.toLowerCase().split(".").pop();
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  let customerRows: Record<string, string>[] = [];
  let petRows: Record<string, string>[] = [];

  if (ext === "xlsx" || ext === "xls") {
    const sheetNames = workbook.SheetNames.map((s) => s.toLowerCase());

    const customerSheetIdx = sheetNames.findIndex((s) =>
      s.includes("customer") || s.includes("לקוח") || s.includes("לקוחות") || s.includes("ייבוא")
    );
    const petSheetIdx = sheetNames.findIndex((s) =>
      s.includes("pet") || s.includes("dog") || s.includes("כלב") || s.includes("חיות")
    );

    const firstSheetRows = workbook.SheetNames.length >= 1
      ? sheetToRows(workbook.Sheets[workbook.SheetNames[customerSheetIdx >= 0 ? customerSheetIdx : 0]])
      : [];

    // Detect combined single-sheet (has both customer + pet columns)
    const firstHeaders = firstSheetRows.length > 0 ? Object.keys(firstSheetRows[0]) : [];
    if (petSheetIdx < 0 && isCombinedSheet(firstHeaders)) {
      const combined = parseCombinedRows(firstSheetRows);
      return {
        customers: combined.customers,
        pets: combined.pets,
        issues: combined.issues,
        customerMappingConfidence: combined.confidence,
        petMappingConfidence: combined.confidence,
      };
    }

    // Legacy two-sheet format
    customerRows = firstSheetRows;
    if (petSheetIdx >= 0) {
      petRows = sheetToRows(workbook.Sheets[workbook.SheetNames[petSheetIdx]]);
    } else if (workbook.SheetNames.length >= 2) {
      petRows = sheetToRows(workbook.Sheets[workbook.SheetNames[1]]);
    }
  } else {
    // CSV: single sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheetToRows(sheet);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    if (includePets && isCombinedSheet(headers)) {
      const combined = parseCombinedRows(rows);
      return {
        customers: combined.customers,
        pets: combined.pets,
        issues: combined.issues,
        customerMappingConfidence: combined.confidence,
        petMappingConfidence: combined.confidence,
      };
    }

    if (includePets) {
      const petHeaderKeys = headers.filter((h) => PET_HEADER_MAP[normalizeHeader(h)] !== undefined);
      if (petHeaderKeys.length >= 2) {
        petRows = rows;
      } else {
        customerRows = rows;
      }
    } else {
      customerRows = rows;
    }
  }

  const custResult = parseCustomerRows(customerRows);
  const petResult = parsePetRows(petRows);

  return {
    customers: custResult.customers,
    pets: petResult.pets,
    issues: [...custResult.issues, ...petResult.issues],
    customerMappingConfidence: custResult.confidence,
    petMappingConfidence: petResult.confidence,
  };
}

// ─── Template generation ──────────────────────────────────────────────────────

export function generateCustomerTemplate(): Buffer {
  const wb = XLSX.utils.book_new();

  // Single combined sheet — customer + pet in each row
  const data = [
    ["שם מלא", "טלפון", "מייל", "עיר", "הערות", "שם כלב", "גזע", "מין", "גיל", "הערות כלב"],
    ["ישראל ישראלי", "052-1234567", "example@gmail.com", "תל אביב", "", "ריקי", "לברדור", "זכר", "3", ""],
    ["שרה כהן", "054-9876543", "", "חיפה", "לקוח VIP", "בוקסר", "פודל", "נקבה", "1", ""],
    ["דוד לוי", "050-1111111", "", "ירושלים", "", "", "", "", "", ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Column widths for readability
  sheet["!cols"] = [
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, sheet, "ייבוא לקוחות");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Service Dog Import ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

type ServiceDogField = "name" | "breed" | "gender" | "birthDate" | "microchip" | "phase" | "serviceType" | "location" | "notes";

const SERVICE_DOG_HEADER_MAP: Record<string, ServiceDogField> = {
  // name
  name: "name", dog_name: "name", "שם כלב": "name", "שם": "name",
  // breed
  breed: "breed", "גזע": "breed",
  // gender
  gender: "gender", sex: "gender", "מין": "gender", "זכר/נקבה": "gender",
  // birthDate
  birthdate: "birthDate", birth_date: "birthDate", dob: "birthDate",
  "תאריך לידה": "birthDate", "תאריך": "birthDate",
  // microchip
  microchip: "microchip", chip: "microchip", "מיקרוצ'יפ": "microchip", "שבב": "microchip",
  // phase
  phase: "phase", stage: "phase", "שלב": "phase",
  // serviceType
  servicetype: "serviceType", service_type: "serviceType", type: "serviceType",
  "סוג שירות": "serviceType", "סוג": "serviceType",
  // location
  location: "location", current_location: "location",
  "מיקום נוכחי": "location", "מיקום": "location",
  // notes
  notes: "notes", remark: "notes", remarks: "notes",
  "הערות": "notes", "הערה": "notes",
};

export function mapServiceDogHeaders(headers: string[]): Record<string, ServiceDogField> {
  const result: Record<string, ServiceDogField> = {};
  for (const h of headers) {
    const key = normalizeHeader(h);
    const mapped = SERVICE_DOG_HEADER_MAP[key] ?? SERVICE_DOG_HEADER_MAP[h.trim()];
    if (mapped) result[h] = mapped;
  }
  return result;
}

export interface RawServiceDogRow {
  rowNumber: number;
  name: string;
  breed?: string;
  gender?: string;
  birthDate?: string;
  microchip?: string;
  phase?: string;
  serviceType?: string;
  location?: string;
  notes?: string;
  raw: Record<string, string>;
}

/**
 * Resolve a Hebrew/English user value to an enum ID.
 * Matches by id (case-insensitive) or label (exact match).
 */
function resolveEnum(value: string, items: readonly { id: string; label: string }[]): string | null {
  if (!value) return null;
  const v = value.trim();
  const vLower = v.toLowerCase();
  // Match by ID
  const byId = items.find((i) => i.id.toLowerCase() === vLower);
  if (byId) return byId.id;
  // Match by label
  const byLabel = items.find((i) => i.label === v);
  if (byLabel) return byLabel.id;
  return null;
}

function normalizeGender(val: string): string | null {
  const v = val.trim().toLowerCase();
  if (["male", "m", "זכר", "ז"].includes(v)) return "male";
  if (["female", "f", "נקבה", "נ"].includes(v)) return "female";
  return null;
}

function parseDateValue(val: string): Date | null {
  if (!val) return null;
  // Try DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (4-digit year)
  const ddmmyyyy = val.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(+ddmmyyyy[3], +ddmmyyyy[2] - 1, +ddmmyyyy[1]);
    if (!isNaN(d.getTime())) return d;
  }
  // Try DD/MM/YY or DD.MM.YY (2-digit year — Israeli common format, assume 2000+)
  const ddmmyy = val.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2})$/);
  if (ddmmyy) {
    const year = 2000 + +ddmmyy[3];
    const d = new Date(year, +ddmmyy[2] - 1, +ddmmyy[1]);
    if (!isNaN(d.getTime())) return d;
  }
  // Try ISO string (covers cellDates:true output like "2025-02-24T00:00:00.000Z")
  const iso = new Date(val);
  if (!isNaN(iso.getTime()) && iso.getFullYear() < 9999) return iso;
  return null;
}

export function parseServiceDogRows(
  rows: Record<string, string>[],
  startRowOffset = 2
): { dogs: RawServiceDogRow[]; issues: ParseIssue[]; confidence: number } {
  if (rows.length === 0) return { dogs: [], issues: [], confidence: 0 };

  const headers = Object.keys(rows[0]);
  const mapping = mapServiceDogHeaders(headers);
  const mapped = new Set(Object.values(mapping));
  const confidence = headers.length > 0 ? Math.min(1, mapped.size / 3) : 0;

  const dogs: RawServiceDogRow[] = [];
  const issues: ParseIssue[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + startRowOffset;
    const get = (field: ServiceDogField): string => {
      const col = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const name = get("name");
    if (!name) {
      // Check if entire row is empty
      const hasAnyValue = Object.values(row).some((v) => v.trim());
      if (hasAnyValue) {
        issues.push({ rowNumber: rowNum, entityType: "service_dog", issueCode: "MISSING_NAME", message: "שם כלב חסר", raw: row });
      }
      return;
    }

    // Validate enums
    const phaseRaw = get("phase");
    const phase = phaseRaw ? resolveEnum(phaseRaw, SERVICE_DOG_PHASES) : null;
    if (phaseRaw && !phase) {
      issues.push({ rowNumber: rowNum, entityType: "service_dog", issueCode: "INVALID_PHASE", message: `שלב לא תקין: "${phaseRaw}"`, raw: row });
    }

    const serviceTypeRaw = get("serviceType");
    const serviceType = serviceTypeRaw ? resolveEnum(serviceTypeRaw, SERVICE_DOG_TYPES) : null;
    if (serviceTypeRaw && !serviceType) {
      issues.push({ rowNumber: rowNum, entityType: "service_dog", issueCode: "INVALID_SERVICE_TYPE", message: `סוג שירות לא תקין: "${serviceTypeRaw}"`, raw: row });
    }

    const locationRaw = get("location");
    const location = locationRaw ? resolveEnum(locationRaw, LOCATION_OPTIONS) : null;
    if (locationRaw && !location) {
      issues.push({ rowNumber: rowNum, entityType: "service_dog", issueCode: "INVALID_LOCATION", message: `מיקום לא תקין: "${locationRaw}"`, raw: row });
    }

    const genderRaw = get("gender");
    const gender = genderRaw ? normalizeGender(genderRaw) : undefined;
    if (genderRaw && !gender) {
      issues.push({ rowNumber: rowNum, entityType: "service_dog", issueCode: "INVALID_GENDER", message: `מין לא תקין: "${genderRaw}"`, raw: row });
    }

    const birthDateRaw = get("birthDate");
    let birthDateStr: string | undefined;
    if (birthDateRaw) {
      const parsed = parseDateValue(birthDateRaw);
      if (parsed) {
        birthDateStr = parsed.toISOString();
      } else {
        issues.push({ rowNumber: rowNum, entityType: "service_dog", issueCode: "INVALID_BIRTH_DATE", message: `תאריך לידה לא תקין: "${birthDateRaw}"`, raw: row });
      }
    }

    dogs.push({
      rowNumber: rowNum,
      name,
      breed: get("breed") || undefined,
      gender: gender || undefined,
      birthDate: birthDateStr,
      microchip: get("microchip") || undefined,
      phase: phase || undefined,
      serviceType: serviceType || undefined,
      location: location || undefined,
      notes: get("notes") || undefined,
      raw: row,
    });
  });

  return { dogs, issues, confidence };
}

export function parseServiceDogFile(buffer: Buffer, filename: string): { dogs: RawServiceDogRow[]; issues: ParseIssue[]; confidence: number } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetToRows(sheet);
  return parseServiceDogRows(rows);
}

export function generateServiceDogTemplate(): Buffer {
  const wb = XLSX.utils.book_new();
  const data = [
    ["שם כלב", "גזע", "מין", "תאריך לידה", "מיקרוצ'יפ", "שלב", "סוג שירות", "מיקום נוכחי", "הערות"],
    ["רקס", "רועה גרמני", "זכר", "15/03/2024", "985112000123456", "באימון", "ניידות", "אצל המאמן", ""],
    ["לונה", "לברדור", "נקבה", "01/08/2023", "985112000654321", "אימון מתקדם", "נחייה", "משפחת אומנה", "כלבה מצטיינת"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, "כלבי שירות");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Service Recipient Import ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

type RecipientField = "name" | "phone" | "email" | "idNumber" | "address" | "disabilityType" | "disabilityNotes" | "fundingSource" | "notes";

const RECIPIENT_HEADER_MAP: Record<string, RecipientField> = {
  // name
  name: "name", full_name: "name", "שם": "name", "שם מלא": "name", "שם זכאי": "name",
  // phone
  phone: "phone", mobile: "phone", telephone: "phone", "טלפון": "phone", "נייד": "phone",
  // email
  email: "email", "מייל": "email", "דואל": "email", "אימייל": "email",
  // idNumber
  idnumber: "idNumber", id_number: "idNumber", id: "idNumber",
  "ת.ז.": "idNumber", "תעודת זהות": "idNumber", "ת.ז": "idNumber", "תז": "idNumber",
  // address
  address: "address", "כתובת": "address",
  // disabilityType
  disabilitytype: "disabilityType", disability_type: "disabilityType", disability: "disabilityType",
  "סוג מוגבלות": "disabilityType", "מוגבלות": "disabilityType",
  // disabilityNotes
  disabilitynotes: "disabilityNotes", disability_notes: "disabilityNotes",
  "הערות מוגבלות": "disabilityNotes", "פירוט מוגבלות": "disabilityNotes",
  // fundingSource
  fundingsource: "fundingSource", funding_source: "fundingSource", funding: "fundingSource",
  "מקור מימון": "fundingSource", "מימון": "fundingSource",
  // notes
  notes: "notes", remark: "notes", remarks: "notes",
  "הערות": "notes", "הערה": "notes",
};

export function mapRecipientHeaders(headers: string[]): Record<string, RecipientField> {
  const result: Record<string, RecipientField> = {};
  for (const h of headers) {
    const key = normalizeHeader(h);
    const mapped = RECIPIENT_HEADER_MAP[key] ?? RECIPIENT_HEADER_MAP[h.trim()];
    if (mapped) result[h] = mapped;
  }
  return result;
}

export interface RawRecipientRow {
  rowNumber: number;
  name: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  address?: string;
  disabilityType?: string;
  disabilityNotes?: string;
  fundingSource?: string;
  notes?: string;
  raw: Record<string, string>;
}

export function parseRecipientRows(
  rows: Record<string, string>[],
  startRowOffset = 2
): { recipients: RawRecipientRow[]; issues: ParseIssue[]; confidence: number } {
  if (rows.length === 0) return { recipients: [], issues: [], confidence: 0 };

  const headers = Object.keys(rows[0]);
  const mapping = mapRecipientHeaders(headers);
  const mapped = new Set(Object.values(mapping));
  const confidence = headers.length > 0 ? Math.min(1, mapped.size / 3) : 0;

  const recipients: RawRecipientRow[] = [];
  const issues: ParseIssue[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + startRowOffset;
    const get = (field: RecipientField): string => {
      const col = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return col ? (row[col] ?? "").trim() : "";
    };

    const name = get("name");
    if (!name) {
      const hasAnyValue = Object.values(row).some((v) => v.trim());
      if (hasAnyValue) {
        issues.push({ rowNumber: rowNum, entityType: "recipient", issueCode: "MISSING_NAME", message: "שם זכאי חסר", raw: row });
      }
      return;
    }

    // Phone — optional but validate if provided
    const phoneRaw = get("phone");
    let phoneNorm: string | undefined;
    if (phoneRaw) {
      const norm = normalizePhone(phoneRaw);
      if (norm) {
        phoneNorm = norm.phoneRaw;
      } else {
        issues.push({ rowNumber: rowNum, entityType: "recipient", issueCode: "INVALID_PHONE", message: `טלפון לא תקין: "${phoneRaw}"`, raw: row });
      }
    }

    // Email — optional but validate if provided
    const emailRaw = get("email");
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      issues.push({ rowNumber: rowNum, entityType: "recipient", issueCode: "INVALID_EMAIL", message: `אימייל לא תקין: "${emailRaw}"`, raw: row });
    }

    const disabilityTypeRaw = get("disabilityType");
    const disabilityType = disabilityTypeRaw ? resolveEnum(disabilityTypeRaw, DISABILITY_TYPES) : null;
    if (disabilityTypeRaw && !disabilityType) {
      issues.push({ rowNumber: rowNum, entityType: "recipient", issueCode: "INVALID_DISABILITY_TYPE", message: `סוג מוגבלות לא תקין: "${disabilityTypeRaw}"`, raw: row });
    }

    const fundingSourceRaw = get("fundingSource");
    const fundingSource = fundingSourceRaw ? resolveEnum(fundingSourceRaw, RECIPIENT_FUNDING_SOURCES) : null;
    if (fundingSourceRaw && !fundingSource) {
      issues.push({ rowNumber: rowNum, entityType: "recipient", issueCode: "INVALID_FUNDING_SOURCE", message: `מקור מימון לא תקין: "${fundingSourceRaw}"`, raw: row });
    }

    recipients.push({
      rowNumber: rowNum,
      name,
      phone: phoneNorm || undefined,
      email: emailRaw || undefined,
      idNumber: get("idNumber") || undefined,
      address: get("address") || undefined,
      disabilityType: disabilityType || undefined,
      disabilityNotes: get("disabilityNotes") || undefined,
      fundingSource: fundingSource || undefined,
      notes: get("notes") || undefined,
      raw: row,
    });
  });

  return { recipients, issues, confidence };
}

export function parseRecipientFile(buffer: Buffer, filename: string): { recipients: RawRecipientRow[]; issues: ParseIssue[]; confidence: number } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetToRows(sheet);
  return parseRecipientRows(rows);
}

export function generateRecipientTemplate(): Buffer {
  const wb = XLSX.utils.book_new();
  const data = [
    ["שם", "טלפון", "מייל", "ת.ז.", "כתובת", "סוג מוגבלות", "הערות מוגבלות", "מקור מימון", "הערות"],
    ["יוסי כהן", "052-1234567", "yossi@example.com", "123456789", "תל אביב, רחוב הרצל 10", "PTSD", "לוחם משוחרר", "משרד הביטחון", ""],
    ["מירי לוי", "054-9876543", "", "987654321", "חיפה", "לקות ראייה", "", "ביטוח לאומי", "רשימת המתנה"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 24 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, "זכאים");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
