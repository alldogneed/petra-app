/**
 * Shared AES-256-GCM encryption helpers.
 *
 * Used by Google Calendar (GCAL_ENCRYPTION_KEY), Invoicing (INVOICING_ENCRYPTION_KEY),
 * Stripe (STRIPE_ENCRYPTION_KEY), Cardcom (CARDCOM_ENCRYPTION_KEY), and 2FA (TWOFA_ENCRYPTION_KEY).
 * Key format: 64-char hex string (32 bytes).
 */

function getKey(envVar: string): Buffer {
  const keyHex = process.env[envVar];
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      `${envVar} must be a 64-char hex string (32 bytes). ` +
      "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(keyHex, "hex");
}

export function encrypt(plaintext: string, envVar: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCipheriv, randomBytes } = require("crypto") as typeof import("crypto");
  const key = getKey(envVar);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(ciphertext: string, envVar: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createDecipheriv } = require("crypto") as typeof import("crypto");
  const key = getKey(envVar);
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ─── Backwards-compatible GCal wrappers ────────────────────────────────────

const GCAL_KEY = "GCAL_ENCRYPTION_KEY";

export function encryptToken(plaintext: string): string {
  return encrypt(plaintext, GCAL_KEY);
}

export function decryptToken(ciphertext: string): string {
  return decrypt(ciphertext, GCAL_KEY);
}

// ─── Invoicing wrappers ────────────────────────────────────────────────────

const INVOICING_KEY = "INVOICING_ENCRYPTION_KEY";

export function encryptInvoicingSecret(plaintext: string): string {
  return encrypt(plaintext, INVOICING_KEY);
}

export function decryptInvoicingSecret(ciphertext: string): string {
  return decrypt(ciphertext, INVOICING_KEY);
}

// ─── Stripe wrappers ───────────────────────────────────────────────────────

const STRIPE_KEY = "STRIPE_ENCRYPTION_KEY";

export function encryptStripeSecret(plaintext: string): string {
  return encrypt(plaintext, STRIPE_KEY);
}

export function decryptStripeSecret(ciphertext: string): string {
  return decrypt(ciphertext, STRIPE_KEY);
}

// ─── Cardcom token wrappers ─────────────────────────────────────────────────
// Uses CARDCOM_ENCRYPTION_KEY (generate with: openssl rand -hex 32)
// Falls back to storing plaintext if key is not configured (backwards compat)

const CARDCOM_KEY = "CARDCOM_ENCRYPTION_KEY";

export function encryptCardcomToken(plaintext: string): string {
  if (!process.env[CARDCOM_KEY] || process.env[CARDCOM_KEY]!.length !== 64) {
    console.error("[SECURITY] CARDCOM_ENCRYPTION_KEY missing or invalid — refusing to store payment token as plaintext");
    throw new Error("Payment encryption key not configured");
  }
  return encrypt(plaintext, CARDCOM_KEY);
}

export function decryptCardcomToken(ciphertext: string): string {
  // Detect if stored as plaintext (legacy — no ":" separators from AES-GCM format)
  if (!ciphertext.includes(":")) return ciphertext;
  if (!process.env[CARDCOM_KEY] || process.env[CARDCOM_KEY]!.length !== 64) {
    // Key not available — can't decrypt, return as-is
    return ciphertext;
  }
  return decrypt(ciphertext, CARDCOM_KEY);
}

// ─── 2FA secret wrappers ──────────────────────────────────────────────────
// Uses TWOFA_ENCRYPTION_KEY (generate with: openssl rand -hex 32)
// Falls back to plaintext if key is not configured (backwards compat)

const TWOFA_KEY = "TWOFA_ENCRYPTION_KEY";

export function encryptTwoFaSecret(plaintext: string): string {
  if (!process.env[TWOFA_KEY] || process.env[TWOFA_KEY]!.length !== 64) {
    return plaintext;
  }
  return encrypt(plaintext, TWOFA_KEY);
}

export function decryptTwoFaSecret(ciphertext: string): string {
  // Legacy plaintext TOTP secrets are base32-encoded (no ":" separators)
  if (!ciphertext.includes(":")) return ciphertext;
  if (!process.env[TWOFA_KEY] || process.env[TWOFA_KEY]!.length !== 64) {
    return ciphertext;
  }
  return decrypt(ciphertext, TWOFA_KEY);
}
