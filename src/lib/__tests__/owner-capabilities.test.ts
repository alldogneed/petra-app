import {
  CAPABILITY_GROUPS,
  CRITICAL_CAPABILITIES,
  TENANT_PERMS,
  getClientPermissions,
  hasTenantPermission,
  parsePermissionOverrides,
  type TenantRole,
} from "../permissions";

const NEW_CAPS = [
  TENANT_PERMS.AVAILABILITY_MANAGE,
  TENANT_PERMS.DATA_IMPORT,
  TENANT_PERMS.CONTRACTS_MANAGE,
  TENANT_PERMS.CALENDAR_SYNC,
] as const;

describe("owner-grantable capabilities catalog", () => {
  test("every capability has a known group, a label and a hint", () => {
    const groups = new Set(CAPABILITY_GROUPS.map((g) => g.id));
    for (const cap of CRITICAL_CAPABILITIES) {
      expect(groups.has(cap.group)).toBe(true);
      expect(cap.label.length).toBeGreaterThan(0);
      expect(cap.hint.length).toBeGreaterThan(0);
    }
  });

  test("keys are unique and are real tenant permissions", () => {
    const keys = CRITICAL_CAPABILITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const valid = new Set<string>(Object.values(TENANT_PERMS));
    for (const k of keys) expect(valid.has(k)).toBe(true);
  });

  test("capabilities are ordered by group (the matrix uses colSpan per group)", () => {
    const order = CAPABILITY_GROUPS.map((g) => g.id);
    const indices = CRITICAL_CAPABILITIES.map((c) => order.indexOf(c.group));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  test("the four new capabilities are owner-grantable (in the catalog)", () => {
    const keys = new Set<string>(CRITICAL_CAPABILITIES.map((c) => c.key));
    for (const k of NEW_CAPS) expect(keys.has(k)).toBe(true);
  });
});

describe("role defaults of the new capabilities", () => {
  const def = (role: TenantRole, p: (typeof NEW_CAPS)[number]) => hasTenantPermission(role, p);

  test("owner and manager have all four", () => {
    for (const p of NEW_CAPS) {
      expect(def("owner", p)).toBe(true);
      expect(def("manager", p)).toBe(true);
    }
  });

  test("staff keep calendar sync only (business config + bulk import need a grant)", () => {
    expect(def("user", TENANT_PERMS.CALENDAR_SYNC)).toBe(true);
    expect(def("user", TENANT_PERMS.AVAILABILITY_MANAGE)).toBe(false);
    expect(def("user", TENANT_PERMS.DATA_IMPORT)).toBe(false);
    expect(def("user", TENANT_PERMS.CONTRACTS_MANAGE)).toBe(false);
  });

  test("volunteers get none", () => {
    for (const p of NEW_CAPS) expect(def("volunteer", p)).toBe(false);
  });
});

describe("overrides for the new capabilities", () => {
  test("owner can grant staff availability + import, and revoke a manager's calendar sync", () => {
    const staff = parsePermissionOverrides({ [TENANT_PERMS.AVAILABILITY_MANAGE]: true, [TENANT_PERMS.DATA_IMPORT]: true });
    expect(hasTenantPermission("user", TENANT_PERMS.AVAILABILITY_MANAGE, staff)).toBe(true);
    expect(hasTenantPermission("user", TENANT_PERMS.DATA_IMPORT, staff)).toBe(true);
    const mgr = parsePermissionOverrides({ [TENANT_PERMS.CALENDAR_SYNC]: false });
    expect(hasTenantPermission("manager", TENANT_PERMS.CALENDAR_SYNC, mgr)).toBe(false);
  });

  test("client flags mirror the server check", () => {
    const p = getClientPermissions("user", { [TENANT_PERMS.CONTRACTS_MANAGE]: true, [TENANT_PERMS.CALENDAR_SYNC]: false });
    expect(p.canManageContracts).toBe(true);
    expect(p.canSyncCalendar).toBe(false);
    expect(p.canManageAvailability).toBe(false);
    expect(p.canImportData).toBe(false);
  });

  test("unknown override keys are dropped", () => {
    expect(parsePermissionOverrides({ "tenant.everything": true })).toEqual({});
  });
});
