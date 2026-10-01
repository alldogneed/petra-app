import { sessionHasTenantPermission, TENANT_PERMS } from "../permissions";

type M = { businessId: string; role: string; isActive: boolean; permissionOverrides?: Record<string, boolean> | null };
const s = (memberships: M[], platformRole: string | null = null) => ({ user: { platformRole }, memberships });
const B = "biz-1";

describe("sessionHasTenantPermission", () => {
  test("owner always passes, even with a revoking override", () => {
    const sess = s([{ businessId: B, role: "owner", isActive: true, permissionOverrides: { [TENANT_PERMS.DATA_EXPORT]: false } }]);
    expect(sessionHasTenantPermission(sess, B, TENANT_PERMS.DATA_EXPORT)).toBe(true);
  });

  test("override grants a capability the role lacks", () => {
    const sess = s([{ businessId: B, role: "manager", isActive: true, permissionOverrides: { [TENANT_PERMS.CRITICAL_DELETE]: true } }]);
    expect(sessionHasTenantPermission(sess, B, TENANT_PERMS.CRITICAL_DELETE)).toBe(true);
  });

  test("override revokes a role default", () => {
    const sess = s([{ businessId: B, role: "user", isActive: true, permissionOverrides: { [TENANT_PERMS.MESSAGES_SEND]: false } }]);
    expect(sessionHasTenantPermission(sess, B, TENANT_PERMS.MESSAGES_SEND)).toBe(false);
    expect(sessionHasTenantPermission(sess, B, TENANT_PERMS.DATA_EXPORT)).toBe(true);
  });

  test("role default applies without overrides", () => {
    const mgr = s([{ businessId: B, role: "manager", isActive: true }]);
    expect(sessionHasTenantPermission(mgr, B, TENANT_PERMS.SETTINGS_CRITICAL)).toBe(false);
    expect(sessionHasTenantPermission(mgr, B, TENANT_PERMS.AI_ASSISTANT)).toBe(false);
    const vol = s([{ businessId: B, role: "volunteer", isActive: true }]);
    expect(sessionHasTenantPermission(vol, B, TENANT_PERMS.DATA_EXPORT)).toBe(false);
  });

  test("membership of another business or inactive membership does not count", () => {
    const other = s([{ businessId: "biz-2", role: "owner", isActive: true }]);
    expect(sessionHasTenantPermission(other, B, TENANT_PERMS.DATA_EXPORT)).toBe(true); // falls back to "user" default
    expect(sessionHasTenantPermission(other, B, TENANT_PERMS.SETTINGS_CRITICAL)).toBe(false);
    const inactive = s([{ businessId: B, role: "owner", isActive: false }]);
    expect(sessionHasTenantPermission(inactive, B, TENANT_PERMS.SETTINGS_CRITICAL)).toBe(false);
  });

  test("platform super_admin (impersonation) passes like an owner", () => {
    expect(sessionHasTenantPermission(s([], "super_admin"), B, TENANT_PERMS.SETTINGS_CRITICAL)).toBe(true);
    expect(sessionHasTenantPermission(s([], "admin"), B, TENANT_PERMS.SETTINGS_CRITICAL)).toBe(false);
  });
});
