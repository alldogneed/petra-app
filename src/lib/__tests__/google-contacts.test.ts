/**
 * Tests for the lead → Google Contacts sync: payload building, scope detection,
 * and the opt-in gate (no Google call unless the business turned the sync on).
 */

const mockBusinessFindUnique = jest.fn();
const mockLeadFindFirst = jest.fn();
const mockLeadUpdate = jest.fn();
const mockBusinessUserFindFirst = jest.fn();
const mockLeadFindMany = jest.fn();
const mockLeadCount = jest.fn();

jest.mock("../prisma", () => ({
  prisma: {
    business: { findUnique: (...a: unknown[]) => mockBusinessFindUnique(...a) },
    lead: {
      findFirst: (...a: unknown[]) => mockLeadFindFirst(...a),
      update: (...a: unknown[]) => mockLeadUpdate(...a),
      findMany: (...a: unknown[]) => mockLeadFindMany(...a),
      count: (...a: unknown[]) => mockLeadCount(...a),
    },
    businessUser: { findFirst: (...a: unknown[]) => mockBusinessUserFindFirst(...a) },
  },
}));

jest.mock("../google-calendar", () => ({
  refreshAccessToken: jest.fn().mockResolvedValue("access-token"),
}));

import {
  buildContactPayload,
  scopeIncludesContacts,
  syncLeadToGoogleContacts,
  syncPendingLeadsToGoogleContacts,
  GOOGLE_CONTACTS_SCOPE,
} from "../google-contacts";

const LEAD = {
  id: "lead1",
  name: "דנה כהן",
  phone: "0501234567",
  email: null,
  notes: "כלב גדול",
  requestedService: "אילוף",
  city: "חיפה",
  googleContactId: null as string | null,
};

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockBusinessUserFindFirst.mockResolvedValue({
    user: { id: "u1", gcalConnected: true, gcalRefreshToken: "enc" },
  });
});

describe("scopeIncludesContacts", () => {
  it("matches the exact contacts scope only", () => {
    expect(scopeIncludesContacts(`email ${GOOGLE_CONTACTS_SCOPE} openid`)).toBe(true);
    expect(scopeIncludesContacts("https://www.googleapis.com/auth/contacts.readonly")).toBe(false);
    expect(scopeIncludesContacts("")).toBe(false);
    expect(scopeIncludesContacts(null)).toBe(false);
  });
});

describe("buildContactPayload", () => {
  it("omits empty fields and always carries the Petra note", () => {
    const payload = buildContactPayload(LEAD);
    expect(payload.names).toEqual([{ givenName: "דנה כהן" }]);
    expect(payload.phoneNumbers).toEqual([{ value: "0501234567", type: "mobile" }]);
    expect(payload.emailAddresses).toBeUndefined();
    expect(payload.addresses).toEqual([{ city: "חיפה", type: "home" }]);
    expect(payload.biographies?.[0].value).toContain("מקור: Petra");
  });
});

describe("syncLeadToGoogleContacts", () => {
  it("does nothing when the business has the sync off", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: false });
    await syncLeadToGoogleContacts("biz1", "lead1");
    expect(mockLeadFindFirst).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a contact and stores its resource name", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: true });
    mockLeadFindFirst.mockResolvedValue(LEAD);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ resourceName: "people/c1" }) });

    await syncLeadToGoogleContacts("biz1", "lead1");

    expect(mockLeadFindFirst.mock.calls[0][0].where).toEqual({ id: "lead1", businessId: "biz1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("people:createContact");
    expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { googleContactId: "people/c1" } });
  });

  it("updates the contact Petra created, using its current etag", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: true });
    mockLeadFindFirst.mockResolvedValue({ ...LEAD, googleContactId: "people/c1" });
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ etag: "abc" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ resourceName: "people/c1" }) });

    await syncLeadToGoogleContacts("biz1", "lead1");

    expect(fetchMock.mock.calls[0][0]).toContain("people/c1?personFields=metadata");
    expect(fetchMock.mock.calls[1][0]).toContain("people/c1:updateContact");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).etag).toBe("abc");
    expect(mockLeadUpdate).not.toHaveBeenCalled();
  });

  it("recreates the contact when it was deleted in Google", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: true });
    mockLeadFindFirst.mockResolvedValue({ ...LEAD, googleContactId: "people/c1" });
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ resourceName: "people/c2" }) });

    await syncLeadToGoogleContacts("biz1", "lead1");

    expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { googleContactId: "people/c2" } });
  });

  it("skips leads with no phone and no email, and never throws", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: true });
    mockLeadFindFirst.mockResolvedValue({ ...LEAD, phone: null });
    await syncLeadToGoogleContacts("biz1", "lead1");
    expect(fetchMock).not.toHaveBeenCalled();

    mockBusinessFindUnique.mockRejectedValue(new Error("db down"));
    await expect(syncLeadToGoogleContacts("biz1", "lead1")).resolves.toBeUndefined();
  });
});

describe("syncPendingLeadsToGoogleContacts", () => {
  it("refuses when the sync is off", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: false });
    await expect(syncPendingLeadsToGoogleContacts("biz1")).resolves.toEqual({ ok: false, reason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates one batch for leads without a contact and stores the ids in order", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: true });
    mockLeadFindMany.mockResolvedValue([
      { ...LEAD, id: "a" },
      { ...LEAD, id: "b" },
      { ...LEAD, id: "c" },
    ]);
    mockLeadCount.mockResolvedValue(4);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        createdPeople: [{ person: { resourceName: "people/1" } }, {}, { person: { resourceName: "people/3" } }],
      }),
    });

    const result = await syncPendingLeadsToGoogleContacts("biz1");

    expect(mockLeadFindMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz1", googleContactId: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("people:batchCreateContacts");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).contacts).toHaveLength(3);
    expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: "a" }, data: { googleContactId: "people/1" } });
    expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: "c" }, data: { googleContactId: "people/3" } });
    expect(mockLeadUpdate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, synced: 2, failed: 1, remaining: 4 });
  });

  it("reports a Google failure without touching leads", async () => {
    mockBusinessFindUnique.mockResolvedValue({ googleContactsSync: true });
    mockLeadFindMany.mockResolvedValue([{ ...LEAD, id: "a" }]);
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    await expect(syncPendingLeadsToGoogleContacts("biz1")).resolves.toEqual({ ok: false, reason: "google_error" });
    expect(mockLeadUpdate).not.toHaveBeenCalled();
  });
});
