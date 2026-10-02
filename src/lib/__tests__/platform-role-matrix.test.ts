/**
 * Platform role matrix — what each platform role (super_admin / admin / support)
 * can reach in the /owner panel. Guards the read-only contract of `support`
 * statically: every mutating handler under /api/owner and the platform routes
 * under /api/admin must require a permission `support` does not hold.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PLATFORM_PERMS, hasPlatformPermission, type PlatformPermission } from "@/lib/permissions";

const API = join(__dirname, "..", "..", "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return routeFiles(p);
    return name === "route.ts" ? [p] : [];
  });
}

const PERM_BY_KEY = PLATFORM_PERMS as Record<string, PlatformPermission>;

/** Permission each exported handler requires, e.g. { GET: "platform.users.read" }. */
function handlerPerms(file: string): Record<string, PlatformPermission | "ROLE_LIST" | null> {
  const src = readFileSync(file, "utf8");
  const out: Record<string, PlatformPermission | "ROLE_LIST" | null> = {};
  const parts = src.split(/export async function (GET|POST|PATCH|PUT|DELETE)\b/);
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1];
    const byConst = body.match(/requirePlatformPermission\(\s*\w+,\s*PLATFORM_PERMS\.(\w+)/);
    const byString = body.match(/requirePlatformPermission\(\s*\w+,\s*"([\w.]+)"/);
    if (byConst) out[parts[i]] = PERM_BY_KEY[byConst[1]];
    else if (byString) out[parts[i]] = byString[1] as PlatformPermission;
    else if (/requirePlatformRole\(/.test(body)) out[parts[i]] = "ROLE_LIST";
    else out[parts[i]] = null;
  }
  return out;
}

const platformRoutes = [
  ...routeFiles(join(API, "owner")),
  ...["users", "feed", "stats", "broadcast-messages", "migration", "subscriptions"].flatMap((d) =>
    routeFiles(join(API, "admin", d))
  ),
];

describe("platform role permissions", () => {
  it("support is read-only", () => {
    const granted = Object.values(PLATFORM_PERMS).filter((p) => hasPlatformPermission("support", p));
    expect(granted.sort()).toEqual(
      [PLATFORM_PERMS.USERS_READ, PLATFORM_PERMS.TENANTS_READ, PLATFORM_PERMS.AUDIT_READ].sort()
    );
  });

  it("admin can manage users and tenants but not billing writes", () => {
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.USERS_WRITE)).toBe(true);
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.TENANTS_WRITE)).toBe(true);
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.SETTINGS_WRITE)).toBe(true);
    expect(hasPlatformPermission("admin", PLATFORM_PERMS.BILLING_WRITE)).toBe(false);
  });

  it("super_admin holds every permission; no role means none", () => {
    for (const p of Object.values(PLATFORM_PERMS)) {
      expect(hasPlatformPermission("super_admin", p)).toBe(true);
      expect(hasPlatformPermission(null, p)).toBe(false);
    }
  });
});

describe("platform API routes", () => {
  it("finds the routes", () => {
    expect(platformRoutes.length).toBeGreaterThan(20);
  });

  it("every handler has a platform guard", () => {
    const unguarded: string[] = [];
    for (const file of platformRoutes) {
      for (const [method, perm] of Object.entries(handlerPerms(file))) {
        if (perm === null) unguarded.push(`${method} ${file.split("/api/")[1]}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("support cannot reach any mutating handler", () => {
    const reachable: string[] = [];
    for (const file of platformRoutes) {
      for (const [method, perm] of Object.entries(handlerPerms(file))) {
        if (method === "GET" || perm === null || perm === "ROLE_LIST") continue;
        if (hasPlatformPermission("support", perm)) reachable.push(`${method} ${file.split("/api/")[1]}`);
      }
    }
    expect(reachable).toEqual([]);
  });

  it("support cannot read settings-level pages (customer success, flags, broadcast, import)", () => {
    const gated = [
      "owner/customer-success/route.ts",
      "owner/feature-flags/route.ts",
      "admin/broadcast-messages/route.ts",
      "admin/migration/businesses/route.ts",
    ];
    for (const rel of gated) {
      const perm = handlerPerms(join(API, rel)).GET;
      expect(perm).toBe(PLATFORM_PERMS.SETTINGS_WRITE);
      expect(hasPlatformPermission("support", perm as PlatformPermission)).toBe(false);
      expect(hasPlatformPermission("admin", perm as PlatformPermission)).toBe(true);
    }
  });
});
