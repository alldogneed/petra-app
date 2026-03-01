/**
 * Shared AES-256-GCM encryption helpers.
 *
 * Used by Google Calendar (GCAL_ENCRYPTION_KEY), Invoicing (INVOICING_ENCRYPTION_KEY),
 * and Stripe (STRIPE_ENCRYPTION_KEY).
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
