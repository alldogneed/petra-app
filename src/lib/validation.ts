/** Validates an Israeli phone number. Returns null if valid, error message if invalid. */
export function validateIsraeliPhone(phone: string): string | null {
  if (!phone.trim()) return "שדה חובה";
  const cleaned = phone.replace(/[\s\-(). ]/g, "");
  if (/^0[2-9]\d{7,8}$/.test(cleaned) || /^\+972[2-9]\d{7,8}$/.test(cleaned)) return null;
  return "מספר טלפון לא תקין — נא להזין מספר ישראלי (למשל 050-1234567)";
}

/** Validates an email address. Returns null if valid or empty (optional field). */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "כתובת אימייל לא תקינה";
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
