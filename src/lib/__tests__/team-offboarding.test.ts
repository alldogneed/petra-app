const findUnique = jest.fn();
const count = jest.fn();
const deleteAllUserSessions = jest.fn();
const invalidateUserSessionCache = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: { platformUser: { findUnique: (...a: unknown[]) => findUnique(...a) }, businessUser: { count: (...a: unknown[]) => count(...a) } },
}));
jest.mock("@/lib/session", () => ({
  deleteAllUserSessions: (...a: unknown[]) => deleteAllUserSessions(...a),
  invalidateUserSessionCache: (...a: unknown[]) => invalidateUserSessionCache(...a),
}));

import { endBusinessAccess } from "../team-offboarding";

beforeEach(() => jest.clearAllMocks());

describe("endBusinessAccess", () => {
  test("no other active business → every session is deleted", async () => {
    findUnique.mockResolvedValue({ platformRole: null });
    count.mockResolvedValue(0);
    await expect(endBusinessAccess("u1")).resolves.toEqual({ loggedOut: true });
    expect(deleteAllUserSessions).toHaveBeenCalledWith("u1");
  });

  test("still active in another business → only the cache is dropped", async () => {
    findUnique.mockResolvedValue({ platformRole: null });
    count.mockResolvedValue(1);
    await expect(endBusinessAccess("u1")).resolves.toEqual({ loggedOut: false });
    expect(deleteAllUserSessions).not.toHaveBeenCalled();
    expect(invalidateUserSessionCache).toHaveBeenCalledWith("u1");
  });

  test("platform staff are never logged out by a tenant", async () => {
    findUnique.mockResolvedValue({ platformRole: "support" });
    count.mockResolvedValue(0);
    await expect(endBusinessAccess("u1")).resolves.toEqual({ loggedOut: false });
    expect(deleteAllUserSessions).not.toHaveBeenCalled();
  });
});
