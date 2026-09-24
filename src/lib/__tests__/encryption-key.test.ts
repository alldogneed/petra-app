/**
 * Encryption keys pasted with a trailing newline (`echo … | vercel env add`)
 * must still work — CARDCOM_ENCRYPTION_KEY and TWOFA_ENCRYPTION_KEY were
 * silently disabled in prod that way.
 */

import { encryptCardcomToken, decryptCardcomToken } from "@/lib/encryption";

const KEY = "a".repeat(64);
const saved = process.env.CARDCOM_ENCRYPTION_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.CARDCOM_ENCRYPTION_KEY;
  else process.env.CARDCOM_ENCRYPTION_KEY = saved;
});

describe("Cardcom key normalization", () => {
  it.each([
    ["exact", KEY],
    ["real trailing newline", `${KEY}\n`],
    ["literal \\n suffix", `${KEY}\\n`],
    ["surrounding spaces", `  ${KEY}  `],
  ])("%s → encrypts and round-trips", (_label, value) => {
    process.env.CARDCOM_ENCRYPTION_KEY = value;
    const enc = encryptCardcomToken("tok-123");
    expect(enc).toContain(":");
    expect(decryptCardcomToken(enc)).toBe("tok-123");
  });

  it("same key with or without newline decrypts the same ciphertext", () => {
    process.env.CARDCOM_ENCRYPTION_KEY = `${KEY}\n`;
    const enc = encryptCardcomToken("tok-xyz");
    process.env.CARDCOM_ENCRYPTION_KEY = KEY;
    expect(decryptCardcomToken(enc)).toBe("tok-xyz");
  });

  it.each([["too short", "abc"], ["not hex", "z".repeat(64)], ["missing", ""]])(
    "%s → refuses to encrypt",
    (_label, value) => {
      process.env.CARDCOM_ENCRYPTION_KEY = value;
      expect(() => encryptCardcomToken("tok")).toThrow("Payment encryption key not configured");
    },
  );
});
