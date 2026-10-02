/**
 * Tests for owner security-alert pure logic + the dispatcher decision flow
 * (I/O injected as jest mocks). Pure module.
 */
import {
  DEFAULT_SECURITY_ALERT_PREFS,
  parseSecurityAlertPrefs,
  candidateRulesForAction,
  isAlertableAction,
  isBulkDeleteTrigger,
  isNewDevice,
  isNewDeviceSession,
  pickNewDeviceLogins,
  createAlertRateLimiter,
  buildAlertContent,
  createSecurityAlertDispatcher,
  type SecurityAlertDeps,
  type AlertEntry,
} from "../security-alert-rules";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("parseSecurityAlertPrefs", () => {
  it("null / garbage → defaults (fresh copy)", () => {
    expect(parseSecurityAlertPrefs(null)).toEqual(DEFAULT_SECURITY_ALERT_PREFS);
    expect(parseSecurityAlertPrefs("nope")).toEqual(DEFAULT_SECURITY_ALERT_PREFS);
    expect(parseSecurityAlertPrefs([1, 2])).toEqual(DEFAULT_SECURITY_ALERT_PREFS);
    const p = parseSecurityAlertPrefs(undefined);
    p.rules.deleteCustomer = false;
    expect(DEFAULT_SECURITY_ALERT_PREFS.rules.deleteCustomer).toBe(true);
  });

  it("keeps valid booleans, drops unknown keys, defaults invalid values", () => {
    const p = parseSecurityAlertPrefs({
      enabled: false, email: "yes", whatsapp: true, evil: "<script>",
      rules: { newDeviceLogin: true, deleteCustomer: 0, hacker: true },
    });
    expect(p).toEqual({
      enabled: false, email: true, whatsapp: true, includeOwnActions: false,
      rules: { ...DEFAULT_SECURITY_ALERT_PREFS.rules, newDeviceLogin: true },
    });
    expect(Object.keys(p)).not.toContain("evil");
    expect(Object.keys(p.rules)).not.toContain("hacker");
  });

  it("accepts a JSON string", () => {
    expect(parseSecurityAlertPrefs('{"includeOwnActions":true}').includeOwnActions).toBe(true);
  });
});

describe("candidateRulesForAction", () => {
  it("maps actions to rules", () => {
    expect(candidateRulesForAction("DELETE_CUSTOMER")).toEqual(["bulkDelete", "deleteCustomer"]);
    expect(candidateRulesForAction("DELETE_PAYMENT")).toEqual(["bulkDelete", "paymentCancelRefund"]);
    expect(candidateRulesForAction("REFUND_PAYMENT")).toEqual(["paymentCancelRefund"]);
    expect(candidateRulesForAction("DELETE_LEAD")).toEqual(["bulkDelete"]);
    expect(candidateRulesForAction("EXPORT_ACTIVITY")).toEqual(["exportData"]);
    expect(candidateRulesForAction("UPDATE_MEMBER_ROLE")).toEqual(["permissionChange"]);
    expect(candidateRulesForAction("LOGIN")).toEqual(["newDeviceLogin"]);
  });
  it("non-sensitive actions are not alertable", () => {
    for (const a of ["CREATE_CUSTOMER", "UPDATE_LEAD", "CREATE_PAYMENT", "REVOKE_SESSION", "UPDATE_SECURITY_ALERTS"]) {
      expect(isAlertableAction(a)).toBe(false);
    }
  });
});

describe("bulk + new device", () => {
  it("bulk fires exactly at the threshold", () => {
    expect([4, 5, 6, 10].map(isBulkDeleteTrigger)).toEqual([false, true, false, false]);
  });

  it("isNewDevice needs labeled history and a non-matching device", () => {
    expect(isNewDevice("Chrome · Windows", [])).toBe(false);
    expect(isNewDevice("Chrome · Windows", [null])).toBe(false);
    expect(isNewDevice("Chrome · Windows", ["Safari · iPhone"])).toBe(true);
    expect(isNewDevice("Chrome · Windows", ["Safari · iPhone", "Chrome · Windows"])).toBe(false);
    expect(isNewDevice("מכשיר לא ידוע", ["Safari · iPhone"])).toBe(false);
    expect(isNewDevice(null, ["Safari · iPhone"])).toBe(false);
  });

  it("isNewDeviceSession honours 7d window, 24h grace and 90d lookback", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const created = new Date(now.getTime() - 2 * DAY);
    const s = { userId: "u1", createdAt: created, device: "Chrome · Windows" };
    const old = (ms: number, label: string, userId = "u1") => ({ userId, entityLabel: label, createdAt: new Date(created.getTime() - ms) });
    expect(isNewDeviceSession(s, [old(5 * DAY, "Safari · iPhone")], now)).toBe(true);
    expect(isNewDeviceSession(s, [old(5 * DAY, "Safari · iPhone"), old(5 * DAY, "Chrome · Windows")], now)).toBe(false);
    // same device only within the grace window (the login that created this session) → still new
    expect(isNewDeviceSession(s, [old(5 * DAY, "Safari · iPhone"), old(HOUR, "Chrome · Windows")], now)).toBe(true);
    // same device only older than 90 days → new
    expect(isNewDeviceSession(s, [old(5 * DAY, "Safari · iPhone"), old(100 * DAY, "Chrome · Windows")], now)).toBe(true);
    // other user's history is ignored
    expect(isNewDeviceSession(s, [old(5 * DAY, "Safari · iPhone", "u2")], now)).toBe(false);
    // older than 7 days → never flagged
    const oldSession = { ...s, createdAt: new Date(now.getTime() - 8 * DAY) };
    expect(isNewDeviceSession(oldSession, [], now)).toBe(false);
  });

  it("pickNewDeviceLogins returns first logins from a new device after `since`", () => {
    const t0 = new Date("2026-09-01T10:00:00Z").getTime();
    const rows = [
      { id: "1", userId: "u", entityLabel: "A", createdAt: new Date(t0) },
      { id: "2", userId: "u", entityLabel: "A", createdAt: new Date(t0 + 20 * DAY) },
      { id: "3", userId: "u", entityLabel: "B", createdAt: new Date(t0 + 21 * DAY) },
      { id: "4", userId: "u", entityLabel: "B", createdAt: new Date(t0 + 22 * DAY) },
      { id: "5", userId: "v", entityLabel: "C", createdAt: new Date(t0 + 22 * DAY) },
    ];
    const out = pickNewDeviceLogins(rows.reverse(), new Date(t0 + 15 * DAY));
    expect(out.map((r) => r.id)).toEqual(["3"]);
  });
});

describe("createAlertRateLimiter", () => {
  it("allows max per hour per key, resets next hour", () => {
    const rl = createAlertRateLimiter(3);
    const t = 10 * HOUR;
    expect([1, 2, 3, 4].map(() => rl.take("b1", t))).toEqual([true, true, true, false]);
    expect(rl.take("b2", t)).toBe(true);
    expect(rl.take("b1", t + HOUR)).toBe(true);
  });
});

describe("buildAlertContent", () => {
  it("escapes HTML and strips newlines from the subject", () => {
    const c = buildAlertContent({
      rule: "deleteCustomer", action: "DELETE_CUSTOMER",
      actorName: "<img src=x onerror=alert(1)>\nBcc: x", entityLabel: "\"Rex\" & <b>",
      businessName: "Biz", at: new Date("2026-10-01T09:00:00Z"), appUrl: "https://petra-app.com/",
    });
    expect(c.html).not.toContain("<img");
    expect(c.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(c.html).toContain("&quot;Rex&quot; &amp; &lt;b&gt;");
    expect(c.html).toContain('href="https://petra-app.com/business-admin"');
    expect(c.html).toContain('dir="rtl"');
    expect(c.subject).not.toMatch(/[\r\n]/);
    expect(c.subject).toContain("התראת אבטחה — Biz");
    expect(c.text).toContain("12:00"); // Israel time (UTC+3 in October)
  });
});

// ─── Dispatcher ─────────────────────────────────────────────────────────────

function makeDeps(over: Partial<SecurityAlertDeps> = {}) {
  const deps = {
    loadBusiness: jest.fn(async () => ({ name: "Biz", tierAllowed: true, prefsRaw: null, phone: "050-1234567" })),
    isOwner: jest.fn(async () => false),
    countRecentDeletes: jest.fn(async () => 1),
    priorLoginDevices: jest.fn(async () => [] as (string | null)[]),
    ownerEmails: jest.fn(async () => ["owner@x.com"]),
    sendEmail: jest.fn(async () => {}),
    sendWhatsApp: jest.fn(async () => {}),
    rateLimit: jest.fn(() => true),
    appUrl: () => "https://petra-app.com",
    log: jest.fn(),
    ...over,
  };
  return deps;
}

const entry = (action: string, extra: Partial<AlertEntry> = {}): AlertEntry => ({
  id: "row1", userId: "staff1", userName: "דנה", action,
  createdAt: new Date("2026-10-01T09:00:00Z"), businessId: "biz1", entityLabel: "רקס", ...extra,
});

describe("createSecurityAlertDispatcher", () => {
  it("non-sensitive action → zero I/O", async () => {
    const deps = makeDeps();
    const dispatch = createSecurityAlertDispatcher(deps);
    expect(await dispatch(entry("CREATE_CUSTOMER"))).toBeNull();
    expect(await dispatch(entry("DELETE_CUSTOMER", { businessId: null }))).toBeNull();
    for (const fn of Object.values(deps)) {
      if (typeof fn === "function" && "mock" in fn) expect((fn as jest.Mock).mock.calls).toHaveLength(0);
    }
  });

  it("staff deletes a customer → email to owners", async () => {
    const deps = makeDeps();
    const fired = await createSecurityAlertDispatcher(deps)(entry("DELETE_CUSTOMER"));
    expect(fired).toBe("deleteCustomer");
    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject] = deps.sendEmail.mock.calls[0] as unknown as [string[], string];
    expect(to).toEqual(["owner@x.com"]);
    expect(subject).toContain("דנה");
    expect(deps.sendWhatsApp).not.toHaveBeenCalled(); // whatsapp default off
  });

  it("whatsapp pref sends to the business phone", async () => {
    const deps = makeDeps({
      loadBusiness: jest.fn(async () => ({ name: "Biz", tierAllowed: true, prefsRaw: { whatsapp: true, email: false }, phone: "0501234567" })),
    });
    await createSecurityAlertDispatcher(deps)(entry("EXPORT_CUSTOMERS"));
    expect(deps.sendWhatsApp).toHaveBeenCalledWith("biz1", "0501234567", expect.stringContaining("דנה"));
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("tier without staff_management / disabled / rule off → nothing sent", async () => {
    for (const biz of [
      { name: "B", tierAllowed: false, prefsRaw: null, phone: null },
      { name: "B", tierAllowed: true, prefsRaw: { enabled: false }, phone: null },
      { name: "B", tierAllowed: true, prefsRaw: { email: false, whatsapp: false }, phone: null },
      { name: "B", tierAllowed: true, prefsRaw: { rules: { deleteCustomer: false, bulkDelete: false } }, phone: null },
    ]) {
      const deps = makeDeps({ loadBusiness: jest.fn(async () => biz) });
      expect(await createSecurityAlertDispatcher(deps)(entry("DELETE_CUSTOMER"))).toBeNull();
      expect(deps.sendEmail).not.toHaveBeenCalled();
    }
  });

  it("owner's own actions skipped unless includeOwnActions", async () => {
    const deps = makeDeps({ isOwner: jest.fn(async () => true) });
    expect(await createSecurityAlertDispatcher(deps)(entry("DELETE_CUSTOMER"))).toBeNull();
    const deps2 = makeDeps({
      isOwner: jest.fn(async () => true),
      loadBusiness: jest.fn(async () => ({ name: "B", tierAllowed: true, prefsRaw: { includeOwnActions: true }, phone: null })),
    });
    expect(await createSecurityAlertDispatcher(deps2)(entry("DELETE_CUSTOMER"))).toBe("deleteCustomer");
    // permissionChange never fires for an owner actor
    expect(await createSecurityAlertDispatcher(deps2)(entry("UPDATE_MEMBER_ROLE"))).toBeNull();
  });

  it("bulk delete fires once at the 5th delete", async () => {
    for (const [n, expected] of [[4, null], [5, "bulkDelete"], [6, null]] as const) {
      const deps = makeDeps({ countRecentDeletes: jest.fn(async () => n) });
      expect(await createSecurityAlertDispatcher(deps)(entry("DELETE_LEAD"))).toBe(expected);
    }
    // DELETE_CUSTOMER at 6 still alerts as a customer delete
    const deps = makeDeps({ countRecentDeletes: jest.fn(async () => 6) });
    expect(await createSecurityAlertDispatcher(deps)(entry("DELETE_CUSTOMER"))).toBe("deleteCustomer");
  });

  it("new-device login applies to owners too (when rule enabled)", async () => {
    const on = { name: "B", tierAllowed: true, prefsRaw: { rules: { newDeviceLogin: true } }, phone: null };
    const deps = makeDeps({
      isOwner: jest.fn(async () => true),
      loadBusiness: jest.fn(async () => on),
      priorLoginDevices: jest.fn(async () => ["Safari · iPhone"]),
    });
    expect(await createSecurityAlertDispatcher(deps)(entry("LOGIN", { entityLabel: "Chrome · Windows" }))).toBe("newDeviceLogin");
    const known = makeDeps({ loadBusiness: jest.fn(async () => on), priorLoginDevices: jest.fn(async () => ["Chrome · Windows"]) });
    expect(await createSecurityAlertDispatcher(known)(entry("LOGIN", { entityLabel: "Chrome · Windows" }))).toBeNull();
    // default prefs: rule off → no history query at all
    const off = makeDeps();
    expect(await createSecurityAlertDispatcher(off)(entry("LOGIN", { entityLabel: "Chrome · Windows" }))).toBeNull();
    expect(off.priorLoginDevices).not.toHaveBeenCalled();
  });

  it("rate limited → dropped; failures never throw", async () => {
    const limited = makeDeps({ rateLimit: jest.fn(() => false) });
    expect(await createSecurityAlertDispatcher(limited)(entry("DELETE_CUSTOMER"))).toBeNull();
    expect(limited.sendEmail).not.toHaveBeenCalled();

    const broken = makeDeps({ loadBusiness: jest.fn(async () => { throw new Error("db down"); }) });
    await expect(createSecurityAlertDispatcher(broken)(entry("DELETE_CUSTOMER"))).resolves.toBeNull();

    const badEmail = makeDeps({ sendEmail: jest.fn(async () => { throw new Error("resend"); }) });
    await expect(createSecurityAlertDispatcher(badEmail)(entry("DELETE_CUSTOMER"))).resolves.toBe("deleteCustomer");
  });
});
