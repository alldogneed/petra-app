import {
  generateIntakeToken,
  hashToken,
  getIntakeExpiry,
  normalizePhoneIL,
  isValidILPhone,
  buildWhatsAppDeepLink,
  buildIntakeMessage,
  buildIntakeLink,
  checkMissingDetails,
} from "../lib/intake";

// ─── Token Tests ────────────────────────────────────────────────────────────

describe("generateIntakeToken", () => {
  it("returns a base64url string of expected length", () => {
    const token = generateIntakeToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThanOrEqual(32);
    // base64url chars only
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateIntakeToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashToken("test-token");
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("different tokens produce different hashes", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("getIntakeExpiry", () => {
  it("returns a date 7 days in the future", () => {
    const now = Date.now();
    const expiry = getIntakeExpiry();
    const diff = expiry.getTime() - now;
    // Should be ~7 days (604800000 ms) ± 1 second
    expect(diff).toBeGreaterThan(604800000 - 1000);
    expect(diff).toBeLessThan(604800000 + 1000);
  });
});

// ─── Phone Tests ────────────────────────────────────────────────────────────

describe("normalizePhoneIL", () => {
  it("normalizes 05x local format", () => {
    expect(normalizePhoneIL("0501234567")).toBe("+972501234567");
  });

  it("normalizes with dashes", () => {
    expect(normalizePhoneIL("050-123-4567")).toBe("+972501234567");
  });

  it("normalizes with spaces", () => {
    expect(normalizePhoneIL("050 123 4567")).toBe("+972501234567");
  });

  it("preserves already-E164 format", () => {
    expect(normalizePhoneIL("+972501234567")).toBe("+972501234567");
  });

  it("adds + to 972 prefix", () => {
    expect(normalizePhoneIL("972501234567")).toBe("+972501234567");
  });

  it("handles 058 prefix", () => {
    expect(normalizePhoneIL("058-1234567")).toBe("+972581234567");
  });
});

describe("isValidILPhone", () => {
  it("validates correct IL mobile numbers", () => {
    expect(isValidILPhone("0501234567")).toBe(true);
    expect(isValidILPhone("050-123-4567")).toBe(true);
    expect(isValidILPhone("+972501234567")).toBe(true);
    expect(isValidILPhone("058-1234567")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidILPhone("123")).toBe(false);
    expect(isValidILPhone("0201234567")).toBe(false);  // 02 is not mobile
    expect(isValidILPhone("")).toBe(false);
  });
});

// ─── WhatsApp Deep Link Tests ───────────────────────────────────────────────

describe("buildWhatsAppDeepLink", () => {
  it("builds correct wa.me URL", () => {
    const url = buildWhatsAppDeepLink("+972501234567", "שלום");
    expect(url).toBe("https://wa.me/972501234567?text=%D7%A9%D7%9C%D7%95%D7%9D");
  });

  it("URL-encodes message with link", () => {
    const url = buildWhatsAppDeepLink("+972501234567", "בדוק: https://example.com/form");
    expect(url).toContain("wa.me/972501234567");
    expect(url).toContain("text=");
    expect(decodeURIComponent(url.split("text=")[1])).toBe("בדוק: https://example.com/form");
  });
});

// ─── Message Template Tests ─────────────────────────────────────────────────

describe("buildIntakeMessage", () => {
  it("includes all variables", () => {
    const msg = buildIntakeMessage({
      customerName: "ישראל",
      businessName: "פטרה",
      intakeLink: "https://example.com/intake/abc",
    });
    expect(msg).toContain("ישראל");
    expect(msg).toContain("פטרה");
    expect(msg).toContain("https://example.com/intake/abc");
  });
});

// ─── Intake Link Tests ──────────────────────────────────────────────────────

describe("buildIntakeLink", () => {
  it("builds link with token", () => {
    const link = buildIntakeLink("my-token-123");
    expect(link).toContain("/intake/my-token-123");
  });
});

// ─── Missing Details Check Tests ────────────────────────────────────────────

describe("checkMissingDetails", () => {
  it("detects no dogs", () => {
    const result = checkMissingDetails({ pets: [] });
    expect(result.hasMissingDetails).toBe(true);
    expect(result.noDogs).toBe(true);
  });

  it("detects missing health", () => {
    const result = checkMissingDetails({
      pets: [{ health: null, behavior: { id: "b1" } }],
    });
    expect(result.hasMissingDetails).toBe(true);
    expect(result.missingHealth).toBe(true);
    expect(result.missingBehavior).toBe(false);
  });

  it("detects missing behavior", () => {
    const result = checkMissingDetails({
      pets: [{ health: { id: "h1" }, behavior: null }],
    });
    expect(result.hasMissingDetails).toBe(true);
    expect(result.missingBehavior).toBe(true);
  });

  it("returns false when all data present", () => {
    const result = checkMissingDetails({
      pets: [{ health: { id: "h1" }, behavior: { id: "b1" } }],
    });
    expect(result.hasMissingDetails).toBe(false);
  });

  it("detects if any pet is missing data", () => {
    const result = checkMissingDetails({
      pets: [
        { health: { id: "h1" }, behavior: { id: "b1" } },
        { health: null, behavior: { id: "b2" } },
      ],
    });
    expect(result.hasMissingDetails).toBe(true);
    expect(result.missingHealth).toBe(true);
  });
});
