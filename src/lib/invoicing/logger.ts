/**
 * Masked logging utility for invoicing.
 * Prevents sensitive data (API keys, tokens, secrets) from appearing in logs.
 */

const SENSITIVE_KEYS = /key|secret|token|password|authorization|credential/i;

/**
 * Deep-clone an object and mask values of sensitive keys.
 * Format: first 4 chars + "****" + last 4 chars (or "****" if too short).
 */
export function maskSensitive<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj as T;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitive(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key) && typeof value === "string") {
      result[key] = maskString(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = maskSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function maskString(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/**
 * Log an invoicing event with sensitive data masked.
 */
export function logInvoicing(
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
): void {
  const masked = data ? maskSensitive(data) : undefined;
  const prefix = `[invoicing]`;

  switch (level) {
    case "info":
      console.log(prefix, message, masked ?? "");
      break;
    case "warn":
      console.warn(prefix, message, masked ?? "");
      break;
    case "error":
      console.error(prefix, message, masked ?? "");
      break;
  }
}
