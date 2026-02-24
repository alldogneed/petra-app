/**
 * Petra Import Utilities
 * Phone normalization, header mapping, CSV/XLSX parsing
 */

import * as XLSX from "xlsx";

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
  entityType: "customer" | "pet";
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
      out[String(k)] = String(v ?? "").trim();
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
  const workbook = XLSX.read(buffer, { type: "buffer" });

  let customerRows: Record<string, string>[] = [];
  let petRows: Record<string, string>[] = [];

  if (ext === "xlsx" || ext === "xls") {
    // Try named sheets first
    const sheetNames = workbook.SheetNames.map((s) => s.toLowerCase());

    const customerSheetIdx = sheetNames.findIndex((s) =>
      s.includes("customer") || s.includes("לקוח") || s.includes("לקוחות")
    );
    const petSheetIdx = sheetNames.findIndex((s) =>
      s.includes("pet") || s.includes("dog") || s.includes("כלב") || s.includes("חיות")
    );

    if (customerSheetIdx >= 0) {
      customerRows = sheetToRows(workbook.Sheets[workbook.SheetNames[customerSheetIdx]]);
    } else if (workbook.SheetNames.length >= 1) {
      customerRows = sheetToRows(workbook.Sheets[workbook.SheetNames[0]]);
    }

    if (petSheetIdx >= 0) {
      petRows = sheetToRows(workbook.Sheets[workbook.SheetNames[petSheetIdx]]);
    } else if (workbook.SheetNames.length >= 2) {
      petRows = sheetToRows(workbook.Sheets[workbook.SheetNames[1]]);
    }
  } else {
    // CSV: single sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheetToRows(sheet);

    if (includePets) {
      // Detect which columns belong to customers vs pets
      // by looking at first row headers
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const petHeaderKeys = headers.filter((h) => {
        const k = normalizeHeader(h);
        return PET_HEADER_MAP[k] !== undefined;
      });
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

  const customerData = [
    ["שם מלא", "טלפון", "מייל", "עיר", "הערות"],
    ["ישראל ישראלי", "052-1234567", "example@gmail.com", "תל אביב", ""],
    ["שרה כהן", "054-9876543", "", "חיפה", "לקוח VIP"],
  ];
  const customerSheet = XLSX.utils.aoa_to_sheet(customerData);
  XLSX.utils.book_append_sheet(wb, customerSheet, "לקוחות");

  const petData = [
    ["שם כלב", "טלפון בעלים", "גזע", "מין", "גיל", "הערות"],
    ["ריקי", "052-1234567", "לברדור", "זכר", "3", ""],
    ["בוקסר", "054-9876543", "פודל", "נקבה", "1", ""],
  ];
  const petSheet = XLSX.utils.aoa_to_sheet(petData);
  XLSX.utils.book_append_sheet(wb, petSheet, "חיות מחמד");

  const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return xlsxBuffer;
}
