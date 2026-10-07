import {
  CRITICAL_CAPABILITIES,
  TENANT_PERMS,
  VIEW_SCREENS,
  getClientPermissions,
  hasTenantPermission,
  isScreenBlocked,
  screenPermissionForPath,
  type TenantPermission,
  type TenantRole,
} from "../permissions";

const VIEW = Object.entries(TENANT_PERMS)
  .filter(([k]) => k.startsWith("VIEW_"))
  .map(([, v]) => v) as TenantPermission[];

// What the sidebar showed each role before screens became grantable (items without minRole).
const STAFF_SCREENS = new Set<TenantPermission>([
  TENANT_PERMS.VIEW_TASKS,
  TENANT_PERMS.VIEW_BOARDING,
  TENANT_PERMS.VIEW_SERVICE_DOGS,
  TENANT_PERMS.VIEW_TRAINING,
  TENANT_PERMS.VIEW_ONLINE_CLASSES,
]);

describe("screen permissions catalog", () => {
  test("every view permission is owner-grantable and in the screens group", () => {
    for (const p of VIEW) {
      const cap = CRITICAL_CAPABILITIES.find((c) => c.key === p);
      expect(cap?.group).toBe("screens");
    }
  });

  test("every view permission gates at least one route, and only view permissions do", () => {
    const gated = new Set(VIEW_SCREENS.map((s) => s.perm));
    for (const p of VIEW) expect(gated.has(p)).toBe(true);
    for (const p of Array.from(gated)) expect(VIEW.includes(p)).toBe(true);
  });
});

describe("role defaults match the previous sidebar", () => {
  test("owner and manager see every screen", () => {
    for (const p of VIEW) {
      expect(hasTenantPermission("owner", p)).toBe(true);
      expect(hasTenantPermission("manager", p)).toBe(true);
    }
  });

  test("staff and volunteers see only the screens that had no minRole", () => {
    for (const role of ["user", "volunteer"] as TenantRole[]) {
      for (const p of VIEW) expect(hasTenantPermission(role, p)).toBe(STAFF_SCREENS.has(p));
    }
  });
});

describe("screenPermissionForPath", () => {
  test("matches the screen and its sub-routes, not look-alike prefixes", () => {
    expect(screenPermissionForPath("/leads")).toBe(TENANT_PERMS.VIEW_LEADS);
    expect(screenPermissionForPath("/customers/abc")).toBe(TENANT_PERMS.VIEW_CUSTOMERS);
    expect(screenPermissionForPath("/boarding/daily")).toBe(TENANT_PERMS.VIEW_BOARDING);
    expect(screenPermissionForPath("/leadsx")).toBeNull();
    expect(screenPermissionForPath("/dashboard")).toBeNull();
    expect(screenPermissionForPath("/orders")).toBeNull();
    expect(screenPermissionForPath("/settings")).toBeNull();
  });
});

describe("isScreenBlocked", () => {
  test("the owner is never blocked, even with a stray override", () => {
    expect(isScreenBlocked("owner", { [TENANT_PERMS.VIEW_LEADS]: false }, "/leads")).toBe(false);
  });

  test("a screen the owner unchecked is blocked for a manager", () => {
    expect(isScreenBlocked("manager", { [TENANT_PERMS.VIEW_CUSTOMERS]: false }, "/customers/1")).toBe(true);
    expect(isScreenBlocked("manager", {}, "/customers/1")).toBe(false);
  });

  test("staff keep direct entry to screens that are off only by role default", () => {
    // Reached from the dashboard, search and the mobile nav — never an explicit decision.
    expect(isScreenBlocked("user", null, "/customers/1")).toBe(false);
    expect(isScreenBlocked("user", null, "/calendar")).toBe(false);
    expect(isScreenBlocked("user", { [TENANT_PERMS.VIEW_CALENDAR]: false }, "/calendar")).toBe(true);
  });

  test("API-enforced screens are blocked on the role default alone", () => {
    expect(isScreenBlocked("user", null, "/leads")).toBe(true);
    expect(isScreenBlocked("user", null, "/scheduled-messages")).toBe(true);
    expect(isScreenBlocked("user", { [TENANT_PERMS.VIEW_LEADS]: true }, "/leads")).toBe(false);
  });

  test("ungated paths and unknown roles are never blocked", () => {
    expect(isScreenBlocked("user", null, "/dashboard")).toBe(false);
    expect(isScreenBlocked(null, null, "/leads")).toBe(false);
  });
});

describe("client flags", () => {
  test("a granted screen shows up for staff, a revoked one disappears for a manager", () => {
    expect(getClientPermissions("user", { [TENANT_PERMS.VIEW_CUSTOMERS]: true }).canViewCustomers).toBe(true);
    expect(getClientPermissions("manager", { [TENANT_PERMS.VIEW_FINANCE]: false }).canViewFinanceScreen).toBe(false);
  });
});
