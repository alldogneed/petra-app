import crypto from "crypto";

// ─── Token helpers ──────────────────────────────────────────────────────────

/** Generate a cryptographically secure random token (URL-safe) */
export function generateIntakeToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** SHA-256 hash of a token (what we store in DB) */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 7-day expiry from now */
export function getIntakeExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

// ─── Phone helpers ──────────────────────────────────────────────────────────

/** Normalize an Israeli phone number to E.164 (+972...) */
export function normalizePhoneIL(phone: string): string {
  // Strip spaces, dashes, dots, parens
  let clean = phone.replace(/[\s\-().]/g, "");
  // Already E.164 (9 digits for mobile, 8 for landline)
  if (/^\+972\d{8,9}$/.test(clean)) return clean;
  // With international prefix without +
  if (/^972\d{8,9}$/.test(clean)) return "+" + clean;
  // Local Israeli format 05x...
  if (/^0[5-9]\d{8}$/.test(clean)) return "+972" + clean.slice(1);
  // Fallback: return as-is with + prefix if missing
  if (!clean.startsWith("+")) clean = "+" + clean;
  return clean;
}

/** Validate that a phone looks like a valid IL mobile */
export function isValidILPhone(phone: string): boolean {
  const norm = normalizePhoneIL(phone);
  return /^\+972[5-9]\d{8}$/.test(norm);
}

/** Build a wa.me deep link */
export function buildWhatsAppDeepLink(phoneE164: string, message: string): string {
  // wa.me expects number without +
  const num = phoneE164.replace("+", "");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// ─── Message template ───────────────────────────────────────────────────────

export function buildIntakeMessage(vars: {
  customerName: string;
  businessName: string;
  intakeLink: string;
}): string {
  return `היי ${vars.customerName}, כאן ${vars.businessName} 👋\nכדי שנתכונן בצורה הכי טובה, אשמח שתמלא/י בקישור את פרטי הכלב והבריאות שלו (דקה-שתיים):\n${vars.intakeLink}\nתודה!`;
}

// ─── Intake form link builder ───────────────────────────────────────────────

export function buildIntakeLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/intake/${token}`;
}

// ─── Missing-details check ──────────────────────────────────────────────────

export interface MissingDetailsResult {
  hasMissingDetails: boolean;
  noDogs: boolean;
  missingHealth: boolean;
  missingBehavior: boolean;
}

export function checkMissingDetails(customer: {
  pets: Array<{
    health?: { id: string } | null;
    behavior?: { id: string } | null;
  }>;
}): MissingDetailsResult {
  const noDogs = customer.pets.length === 0;
  const missingHealth = customer.pets.some((p) => !p.health);
  const missingBehavior = customer.pets.some((p) => !p.behavior);
  return {
    hasMissingDetails: noDogs || missingHealth || missingBehavior,
    noDogs,
    missingHealth,
    missingBehavior,
  };
}
