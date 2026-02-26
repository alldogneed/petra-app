/**
 * Input validation for invoicing API keys and document inputs.
 */

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
const MAX_API_KEY_LENGTH = 256;
const MAX_FIELD_LENGTH = 500;

/**
 * Validate an API key: non-empty, no control characters, max 256 chars.
 */
export function validateApiKey(key: string): { valid: boolean; error?: string } {
  if (!key || !key.trim()) {
    return { valid: false, error: "מפתח API לא יכול להיות ריק" };
  }
  if (CONTROL_CHARS.test(key)) {
    return { valid: false, error: "מפתח API מכיל תווים לא חוקיים" };
  }
  if (key.length > MAX_API_KEY_LENGTH) {
    return { valid: false, error: `מפתח API ארוך מדי (מקסימום ${MAX_API_KEY_LENGTH} תווים)` };
  }
  return { valid: true };
}

/**
 * Validate document creation input.
 */
export function validateDocumentInput(input: {
  customerId?: string;
  docType?: number;
  amount?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.customerId) {
    errors.push("חובה לבחור לקוח");
  }

  const validDocTypes = [305, 320, 400, 330];
  if (input.docType && !validDocTypes.includes(input.docType)) {
    errors.push("סוג מסמך לא חוקי");
  }

  if (input.amount !== undefined && input.amount <= 0) {
    errors.push("סכום חייב להיות חיובי");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Strip control characters, trim whitespace, and limit length.
 */
export function sanitizeForProvider(value: string, maxLength = MAX_FIELD_LENGTH): string {
  return value
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, maxLength);
}
