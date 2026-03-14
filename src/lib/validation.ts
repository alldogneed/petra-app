/** Validates an Israeli phone number. Returns null if valid, error message if invalid. */
export function validateIsraeliPhone(phone: string): string | null {
  if (!phone.trim()) return "שדה חובה";
  const cleaned = phone.replace(/[\s\-(). ]/g, "");
  if (/^0[2-9]\d{7,8}$/.test(cleaned) || /^\+?972[2-9]\d{7,8}$/.test(cleaned)) return null;
  if (cleaned.replace(/\D/g, "").length < 9) return "מספר טלפון חייב להכיל לפחות 9 ספרות";
  return "מספר טלפון לא תקין — נא להזין מספר ישראלי (למשל 050-1234567)";
}

/**
 * Normalizes an Israeli phone number to local display format (05X-XXXXXXX).
 * Converts +972 / 972 prefix to 0-prefix. Returns the input as-is if not a recognized format.
 */
export function normalizeIsraeliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // +972 or 972 prefix → convert to 0-prefix
  if (/^972[2-9]\d{7,8}$/.test(digits)) {
    const local = "0" + digits.slice(3);
    return local.length === 10
      ? `${local.slice(0, 3)}-${local.slice(3)}`
      : local;
  }
  // Already 0-prefix — format with dash
  if (/^0[2-9]\d{7,8}$/.test(digits)) {
    return digits.length === 10
      ? `${digits.slice(0, 3)}-${digits.slice(3)}`
      : digits;
  }
  return phone.trim();
}

/** Returns true if the given string looks like a valid email address. */
export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Validates an email address. Returns null if valid or empty (optional field). */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return null;
  if (!isValidEmail(email)) return "כתובת אימייל לא תקינה";
  return null;
}

/** Strips HTML tags and dangerous characters from a name. */
export function sanitizeName(name: string): string {
  return name.replace(/<[^>]*>/g, "").replace(/[<>{}[\]]/g, "").trim();
}

/** Validates a name. Returns null if valid, error message if invalid. */
export function validateName(name: string): string | null {
  const sanitized = sanitizeName(name);
  if (!sanitized) return "שדה חובה";
  if (sanitized.length < 2) return "שם לא תקין — נא להזין לפחות 2 תווים";
  return null;
}
