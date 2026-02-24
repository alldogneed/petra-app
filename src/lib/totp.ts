/**
 * TOTP (Time-based One-Time Password) implementation.
 * RFC 6238 compatible — works with Google Authenticator, Authy, etc.
 *
 * Pure implementation using Web Crypto API (no external TOTP library needed).
 */

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "SHA-1";

/** Generate a cryptographically random base32 secret (160 bits = 20 bytes) */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Generate N backup codes (alphanumeric, 8 chars each) */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    codes.push(
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
        .slice(0, 8)
    );
  }
  return codes;
}

/** Verify a TOTP token against a secret, checking current ±1 window */
export async function verifyTotp(
  secret: string,
  token: string
): Promise<boolean> {
  const normalizedToken = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalizedToken)) return false;

  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_PERIOD);

  // Check current window and ±1 for clock drift tolerance
  for (const offset of [-1, 0, 1]) {
    const expected = await generateHotp(secret, counter + offset);
    if (expected === normalizedToken) return true;
  }
  return false;
}

/** Generate TOTP URI for QR code display */
export function totpUri(secret: string, email: string, issuer = "Petra Admin"): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: TOTP_ALGORITHM,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function generateHotp(secret: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counterBytes = counterToBytes(counter);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(0) as ArrayBuffer,
    { name: "HMAC", hash: TOTP_ALGORITHM },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
  const hash = new Uint8Array(sig);

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, "0");
}

function counterToBytes(counter: number): ArrayBuffer {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // 64-bit big-endian counter
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);
  return buf;
}

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_CHARS[(value << (5 - bits)) & 31];
  return result;
}

function base32Decode(input: string): Uint8Array {
  const str = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const result: number[] = [];
  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base32 character: '${char}'`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(result);
}
