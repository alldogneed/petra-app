import { hashInviteToken, invitationStatus, inviteUrl, isStrongPassword, normalizeEmail } from "../team-invitations";

jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/email", () => ({ sendTeamInvitationEmail: jest.fn() }));

describe("team invitations", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const future = new Date("2026-10-20T12:00:00Z");
  const past = new Date("2026-10-01T12:00:00Z");

  test("status: accepted and revoked win over expiry; expiry is exclusive of now", () => {
    expect(invitationStatus({ acceptedAt: past, revokedAt: null, expiresAt: past }, now)).toBe("accepted");
    expect(invitationStatus({ acceptedAt: null, revokedAt: past, expiresAt: future }, now)).toBe("revoked");
    expect(invitationStatus({ acceptedAt: null, revokedAt: null, expiresAt: now }, now)).toBe("expired");
    expect(invitationStatus({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("pending");
  });

  test("token hash is deterministic sha-256 hex and never the raw token", () => {
    const raw = "a".repeat(64);
    expect(hashInviteToken(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(raw)).toBe(hashInviteToken(raw));
    expect(hashInviteToken(raw)).not.toBe(raw);
  });

  test("password rule matches registration: 12+, upper, lower, digit", () => {
    expect(isStrongPassword("Short1A")).toBe(false);
    expect(isStrongPassword("alllowercase12")).toBe(false);
    expect(isStrongPassword("ALLUPPERCASE12")).toBe(false);
    expect(isStrongPassword("NoDigitsHereAtAll")).toBe(false);
    expect(isStrongPassword("GoodPassword12")).toBe(true);
  });

  test("email is trimmed and lower-cased; link points at /invite", () => {
    expect(normalizeEmail("  Dana@Example.COM ")).toBe("dana@example.com");
    expect(inviteUrl("abc")).toMatch(/\/invite\?token=abc$/);
  });
});
