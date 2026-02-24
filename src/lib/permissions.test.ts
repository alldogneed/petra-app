/**
 * Unit tests for permissions.ts and rate-limit.ts
 */

import {
  hasPlatformPermission,
  hasTenantPermission,
  isPlatformAdmin,
  requires2FA,
  canModifyTenantRole,
  PLATFORM_PERMS,
  TENANT_PERMS,
} from "./permissions";
import { rateLimit, RATE_LIMITS } from "./rate-limit";

// ─── hasPlatformPermission ─────────────────────────────────────────────────────

describe("hasPlatformPermission", () => {
  test("super_admin has all platform permissions", () => {
    Object.values(PLATFORM_PERMS).forEach((perm) => {
      expect(hasPlatformPermission("super_admin", perm)).toBe(true);
    });
  });

  test("admin has most permissions but not billing.write", () => {
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.USERS_READ)).toBe(true);
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.TENANTS_WRITE)).toBe(true);
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.AUDIT_READ)).toBe(true);
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.BILLING_WRITE)).toBe(false);
  });

  test("support has read-only permissions", () => {
    expect(hasPlatformPermission("support", PLATFORM_PERMS.USERS_READ)).toBe(true);
    expect(hasPlatformPermission("support", PLATFORM_PERMS.TENANTS_READ)).toBe(true);
    expect(hasPlatformPermission("support", PLATFORM_PERMS.AUDIT_READ)).toBe(true);
    expect(hasPlatformPermission("support", PLATFORM_PERMS.USERS_WRITE)).toBe(false);
    expect(hasPlatformPermission("support", PLATFORM_PERMS.TENANTS_WRITE)).toBe(false);
    expect(hasPlatformPermission("support", PLATFORM_PERMS.SETTINGS_WRITE)).toBe(false);
  });

  test("null role has no permissions", () => {
    Object.values(PLATFORM_PERMS).forEach((perm) => {
      expect(hasPlatformPermission(null, perm)).toBe(false);
      expect(hasPlatformPermission(undefined, perm)).toBe(false);
    });
  });

  test("invalid role has no permissions", () => {
    expect(hasPlatformPermission("hacker" as never, PLATFORM_PERMS.USERS_READ)).toBe(false);
  });
});

// ─── hasTenantPermission ───────────────────────────────────────────────────────

describe("hasTenantPermission", () => {
  test("owner has all tenant permissions", () => {
    Object.values(TENANT_PERMS).forEach((perm) => {
      expect(hasTenantPermission("owner", perm)).toBe(true);
    });
  });

  test("manager has most permissions", () => {
    expect(hasTenantPermission("manager", TENANT_PERMS.USERS_READ)).toBe(true);
    expect(hasTenantPermission("manager", TENANT_PERMS.USERS_WRITE)).toBe(true);
    expect(hasTenantPermission("manager", TENANT_PERMS.ANALYTICS_READ)).toBe(true);
    expect(hasTenantPermission("manager", TENANT_PERMS.SETTINGS_WRITE)).toBe(true);
    expect(hasTenantPermission("manager", TENANT_PERMS.AUDIT_READ)).toBe(true);
  });

  test("user has only content permissions", () => {
    expect(hasTenantPermission("user", TENANT_PERMS.CONTENT_READ)).toBe(true);
    expect(hasTenantPermission("user", TENANT_PERMS.CONTENT_WRITE)).toBe(true);
    expect(hasTenantPermission("user", TENANT_PERMS.USERS_READ)).toBe(false);
    expect(hasTenantPermission("user", TENANT_PERMS.USERS_WRITE)).toBe(false);
    expect(hasTenantPermission("user", TENANT_PERMS.ANALYTICS_READ)).toBe(false);
    expect(hasTenantPermission("user", TENANT_PERMS.SETTINGS_WRITE)).toBe(false);
    expect(hasTenantPermission("user", TENANT_PERMS.AUDIT_READ)).toBe(false);
  });

  test("null role has no permissions", () => {
    Object.values(TENANT_PERMS).forEach((perm) => {
      expect(hasTenantPermission(null, perm)).toBe(false);
    });
  });
});

// ─── isPlatformAdmin ───────────────────────────────────────────────────────────

describe("isPlatformAdmin", () => {
  test("super_admin is platform admin", () => {
    expect(isPlatformAdmin("super_admin")).toBe(true);
  });

  test("admin is platform admin", () => {
    expect(isPlatformAdmin("admin")).toBe(true);
  });

  test("support is NOT platform admin", () => {
    expect(isPlatformAdmin("support")).toBe(false);
  });

  test("null is NOT platform admin", () => {
    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  test("arbitrary string is NOT platform admin", () => {
    expect(isPlatformAdmin("owner")).toBe(false);
    expect(isPlatformAdmin("manager")).toBe(false);
  });
});

// ─── requires2FA ──────────────────────────────────────────────────────────────

describe("requires2FA", () => {
  test("super_admin requires 2FA", () => {
    expect(requires2FA("super_admin")).toBe(true);
  });

  test("admin requires 2FA", () => {
    expect(requires2FA("admin")).toBe(true);
  });

  test("support does NOT require 2FA", () => {
    expect(requires2FA("support")).toBe(false);
  });

  test("null does not require 2FA", () => {
    expect(requires2FA(null)).toBe(false);
  });
});

// ─── canModifyTenantRole ───────────────────────────────────────────────────────

describe("canModifyTenantRole", () => {
  test("owner can modify owner, manager, user", () => {
    expect(canModifyTenantRole("owner", "owner")).toBe(true);
    expect(canModifyTenantRole("owner", "manager")).toBe(true);
    expect(canModifyTenantRole("owner", "user")).toBe(true);
  });

  test("manager can modify manager and user, not owner", () => {
    expect(canModifyTenantRole("manager", "manager")).toBe(true);
    expect(canModifyTenantRole("manager", "user")).toBe(true);
    expect(canModifyTenantRole("manager", "owner")).toBe(false);
  });

  test("user cannot modify any role", () => {
    expect(canModifyTenantRole("user", "user")).toBe(true); // can modify peers at same level
    expect(canModifyTenantRole("user", "manager")).toBe(false);
    expect(canModifyTenantRole("user", "owner")).toBe(false);
  });
});

// ─── Rate limiter ──────────────────────────────────────────────────────────────

describe("rateLimit", () => {
  beforeEach(() => {
    // Clear the rate limit store before each test
    const globalStore = globalThis as unknown as { _rateLimitStore?: Map<string, unknown> };
    globalStore._rateLimitStore = new Map();
  });

  test("allows requests under the limit", () => {
    const opts = { max: 5, windowMs: 60_000 };
    for (let i = 0; i < 5; i++) {
      const result = rateLimit("test", "ip1", opts);
      expect(result.allowed).toBe(true);
    }
  });

  test("blocks requests over the limit", () => {
    const opts = { max: 3, windowMs: 60_000 };
    rateLimit("test", "ip2", opts);
    rateLimit("test", "ip2", opts);
    rateLimit("test", "ip2", opts);
    const result = rateLimit("test", "ip2", opts); // 4th request
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test("different keys don't share limits", () => {
    const opts = { max: 2, windowMs: 60_000 };
    rateLimit("test", "ip3", opts);
    rateLimit("test", "ip3", opts);
    const blocked = rateLimit("test", "ip3", opts);
    expect(blocked.allowed).toBe(false);

    // Different IP should still be allowed
    const other = rateLimit("test", "ip4", opts);
    expect(other.allowed).toBe(true);
  });

  test("different namespaces don't share limits", () => {
    const opts = { max: 1, windowMs: 60_000 };
    rateLimit("ns1", "ip5", opts);
    const ns1blocked = rateLimit("ns1", "ip5", opts);
    expect(ns1blocked.allowed).toBe(false);

    // Same key, different namespace: still allowed
    const ns2allowed = rateLimit("ns2", "ip5", opts);
    expect(ns2allowed.allowed).toBe(true);
  });

  test("window resets after expiry", () => {
    const opts = { max: 1, windowMs: 1 }; // 1ms window
    rateLimit("test", "ip6", opts);
    const blocked = rateLimit("test", "ip6", opts);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const allowed = rateLimit("test", "ip6", opts);
        expect(allowed.allowed).toBe(true);
        resolve();
      }, 5);
    });
  });

  test("RATE_LIMITS constants have correct shape", () => {
    expect(RATE_LIMITS.AUTH_LOGIN.max).toBe(10);
    expect(RATE_LIMITS.AUTH_LOGIN.windowMs).toBe(10 * 60 * 1000);
    expect(RATE_LIMITS.TOTP_VERIFY.max).toBe(5);
    expect(RATE_LIMITS.TOTP_VERIFY.windowMs).toBe(5 * 60 * 1000);
  });
});
